import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import axios from "axios";
import * as cheerio from "cheerio";
import { downloadRequestSchema, videoInfoSchema } from "@shared/schema";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";
import YouTubeExtractor from './youtube-extractor';
import { EventEmitter } from "events";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create temp directory for downloaded files
const TEMP_DIR = path.join(__dirname, '../temp_downloads');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Download session management
interface DownloadSession {
  id: string;
  videoId: string;
  url: string;
  quality: string;
  format: string;
  status: 'waiting' | 'downloading' | 'completed' | 'error';
  progress: number;
  speed?: string;
  eta?: string;
  fileSize?: string;
  downloadedSize?: string;
  error?: string;
  createdAt: Date;
  filePath?: string; // Path to downloaded file instead of buffer
}

class DownloadSessionManager extends EventEmitter {
  private sessions: Map<string, DownloadSession> = new Map();
  private connections: Map<string, any[]> = new Map();

  createSession(videoId: string, url: string, quality: string, format: string): string {
    const sessionId = `${videoId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const session: DownloadSession = {
      id: sessionId,
      videoId,
      url,
      quality,
      format,
      status: 'waiting',
      progress: 0,
      createdAt: new Date()
    };
    
    this.sessions.set(sessionId, session);
    console.log(`Created download session: ${sessionId}`);
    return sessionId;
  }

  updateProgress(sessionId: string, progress: Partial<DownloadSession>) {
    const session = this.sessions.get(sessionId);
    if (session) {
      Object.assign(session, progress);
      this.emit('progress', sessionId, session);
      
      // Broadcast to all connected clients for this session
      const connections = this.connections.get(sessionId) || [];
      const validConnections: any[] = [];
      
      connections.forEach(res => {
        // Fix: Use proper SSE connection health check instead of headersSent
        if (!res.writableEnded && !res.destroyed) {
          try {
            res.write(`data: ${JSON.stringify(session)}\n\n`);
            validConnections.push(res);
          } catch (error) {
            console.error('Failed to send SSE data:', error);
          }
        }
      });
      
      // Update connections list to remove dead connections
      if (validConnections.length !== connections.length) {
        this.connections.set(sessionId, validConnections);
      }
    }
  }

  getSession(sessionId: string): DownloadSession | undefined {
    return this.sessions.get(sessionId);
  }

  addConnection(sessionId: string, res: any) {
    if (!this.connections.has(sessionId)) {
      this.connections.set(sessionId, []);
    }
    this.connections.get(sessionId)!.push(res);
    
    // Send current session status immediately
    const session = this.sessions.get(sessionId);
    if (session) {
      try {
        res.write(`data: ${JSON.stringify(session)}\n\n`);
      } catch (error) {
        console.error('Failed to send initial SSE data:', error);
      }
    }
  }

  removeConnection(sessionId: string, res: any) {
    const connections = this.connections.get(sessionId);
    if (connections) {
      const index = connections.indexOf(res);
      if (index > -1) {
        connections.splice(index, 1);
      }
      if (connections.length === 0) {
        this.connections.delete(sessionId);
      }
    }
  }

  cleanupOldSessions() {
    const now = new Date();
    const maxAge = 2 * 60 * 60 * 1000; // 2 hours
    
    const sessionsToDelete: string[] = [];
    this.sessions.forEach((session, sessionId) => {
      if (now.getTime() - session.createdAt.getTime() > maxAge) {
        sessionsToDelete.push(sessionId);
      }
    });
    
    sessionsToDelete.forEach(sessionId => {
      this.cleanupSession(sessionId);
    });
  }

  cleanupSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    
    // Clean up file if exists
    if (session?.filePath) {
      try {
        if (fs.existsSync(session.filePath)) {
          fs.unlinkSync(session.filePath);
          console.log(`Cleaned up file: ${session.filePath}`);
        }
      } catch (error) {
        console.error(`Failed to cleanup file for session ${sessionId}:`, error);
      }
    }
    
    // Remove session and connections
    this.sessions.delete(sessionId);
    this.connections.delete(sessionId);
    console.log(`Cleaned up session: ${sessionId}`);
  }
}

const downloadManager = new DownloadSessionManager();

// Cleanup old sessions every hour
setInterval(() => {
  downloadManager.cleanupOldSessions();
}, 60 * 60 * 1000);

// Background download processor with real-time progress
async function processDownloadInBackground(
  sessionId: string, 
  url: string, 
  quality: string, 
  format: string, 
  videoId: string
) {
  try {
    console.log(`Starting background download for session: ${sessionId}`);
    
    // Update session status to downloading
    downloadManager.updateProgress(sessionId, { 
      status: 'downloading',
      progress: 0,
      speed: '0 KB/s',
      eta: 'calculating...'
    });

    try {
      // Create progress callback to emit real-time updates from yt-dlp
      const progressCallback = (progress: any) => {
        console.log(`Real progress for session ${sessionId}:`, progress);
        downloadManager.updateProgress(sessionId, {
          status: 'downloading',
          progress: progress.progress,
          speed: progress.speed,
          eta: progress.eta,
          downloadedSize: progress.downloadedSize,
          fileSize: progress.fileSize
        });
      };

      // Generate output file path
      const filename = `video_${videoId}_${quality}_${Date.now()}.${format}`;
      const filePath = path.join(TEMP_DIR, filename);
      
      // Start download with real-time progress tracking and capture actual file path
      const actualFilePath = await YouTubeExtractor.downloadVideoWithProgress(url, quality, format, filePath, progressCallback);
      
      // Mark as completed with the actual file path returned by yt-dlp
      downloadManager.updateProgress(sessionId, {
        status: 'completed',
        progress: 100,
        speed: '0 KB/s',
        eta: 'completed',
        downloadedSize: downloadManager.getSession(sessionId)?.fileSize || 'Unknown',
        filePath: actualFilePath
      });
      
      console.log(`Real progress download completed for session: ${sessionId}, file: ${actualFilePath}`);
      
    } catch (downloadError) {
      console.error('Real progress download failed:', downloadError);
      
      downloadManager.updateProgress(sessionId, {
        status: 'error',
        progress: 0,
        error: downloadError instanceof Error ? downloadError.message : String(downloadError),
        speed: '0 KB/s',
        eta: 'failed'
      });
    }
    
  } catch (error) {
    console.error('processDownloadInBackground error:', error);
    downloadManager.updateProgress(sessionId, {
      status: 'error',
      progress: 0,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Extract video ID from various YouTube URL formats
  const extractVideoId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w\-_]+)/,
      /youtube\.com\/embed\/([\w\-_]+)/,
      /youtube\.com\/v\/([\w\-_]+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  // Format duration from seconds to mm:ss
  const formatDuration = (seconds: number | string) => {
    const sec = typeof seconds === 'string' ? parseInt(seconds) : seconds;
    if (!sec || isNaN(sec)) return '00:00';
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Real YouTube video info extraction using yt-dlp with bot detection bypass
  const getRealYouTubeInfo = async (url: string) => {
    try {
      console.log('Getting video info using yt-dlp with bot detection bypass...');
      const scriptPath = path.join(__dirname, 'youtube_downloader.py');
      
      const result = await new Promise<any>((resolve, reject) => {
        const process = spawn('python3', [scriptPath, 'info', url], {
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 30000
        });
        
        let stdout = '';
        let stderr = '';
        
        process.stdout.on('data', (data) => {
          stdout += data.toString();
        });
        
        process.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        
        process.on('close', (code) => {
          try {
            if (code !== 0) {
              reject(new Error(`Process exited with code ${code}: ${stderr}`));
              return;
            }
            const result = JSON.parse(stdout);
            resolve(result);
          } catch (error) {
            reject(new Error(`Failed to parse result: ${error} - stdout: ${stdout}`));
          }
        });
        
        process.on('error', (error) => {
          reject(error);
        });
      });
      
      if (result.success) {
        console.log('Successfully got video info via yt-dlp');
        return {
          title: result.title,
          thumbnail: result.thumbnail,
          duration: formatDuration(result.duration),
          views: result.views?.toLocaleString() || '0',
          channel: result.channel,
          uploadDate: result.uploadDate,
          availableQualities: result.availableQualities,
          availableFormats: result.availableFormats,
        };
      } else {
        throw new Error(result.error || 'Failed to get video info');
      }
    } catch (error) {
      console.error('yt-dlp error:', error);
      throw error;
    }
  };

  // Fallback to OEmbed for basic info
  const getBasicYouTubeInfo = async (videoId: string, url: string) => {
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
      const response = await axios.get(oembedUrl, { timeout: 5000 });
      const data = response.data;
      
      return {
        title: data.title || `YouTube Video ${videoId}`,
        thumbnail: data.thumbnail_url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        duration: url.includes('/shorts/') ? '0:30' : '3:45',
        views: '1,234,567',
        channel: data.author_name || 'YouTube Channel',
        uploadDate: new Date().toLocaleDateString(),
        availableQualities: ['720p', '480p', '360p', 'best'],
        availableFormats: ['mp4', 'webm', 'mp3', 'm4a'],
      };
    } catch (error) {
      throw new Error('Failed to get video info');
    }
  };

  // Generate mock data based on video ID
  const generateMockData = (videoId: string, url: string) => {
    const isShorts = url.includes('/shorts/');
    return {
      title: isShorts ? `YouTube Short ${videoId}` : `YouTube Video ${videoId}`,
      thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      duration: isShorts ? '0:30' : '3:45',
      views: '1,234,567',
      channel: 'Demo Channel',
      uploadDate: new Date().toLocaleDateString(),
      availableQualities: ['720p', '480p', '360p', 'best'],
      availableFormats: ['mp4', 'webm', 'mp3', 'm4a'],
    };
  };

  // YouTube video info endpoint with enhanced bot detection bypass
  app.post("/api/video-info", async (req, res) => {
    try {
      const { url } = req.body;
      
      if (!url) {
        return res.status(400).json({ error: 'URL is required' });
      }

      console.log('Getting video info for:', url);
      
      try {
        // Use new YouTube extractor with multiple client strategies
        const videoInfo = await YouTubeExtractor.extractVideoInfo(url);
        
        // Format the response to match expected structure
        const formattedInfo = {
          title: videoInfo.title,
          thumbnail: videoInfo.thumbnail,
          duration: formatDuration(videoInfo.duration),
          views: '1,234,567', // Placeholder as yt-dlp may not provide this
          channel: 'YouTube Channel', // Placeholder
          uploadDate: new Date().toLocaleDateString(),
          availableQualities: videoInfo.formats.map(f => f.quality).filter((v, i, a) => a.indexOf(v) === i),
          availableFormats: videoInfo.formats.map(f => f.format).filter((v, i, a) => a.indexOf(v) === i),
          _note: "Enhanced bot detection bypass - multiple client strategies"
        };
        
        console.log('Successfully extracted video info with bot detection bypass');
        return res.json(formattedInfo);
      } catch (extractorError) {
        console.log('Enhanced extractor failed, trying OEmbed fallback:', extractorError);
        
        const videoId = extractVideoId(url);
        if (!videoId) {
          return res.status(400).json({ error: "Could not extract video ID from URL" });
        }
        
        try {
          // Fallback to basic YouTube info
          const videoInfo = await getBasicYouTubeInfo(videoId, url);
          console.log('Successfully got video info via OEmbed fallback');
          return res.json({
            ...videoInfo,
            _note: "OEmbed fallback - Limited info available"
          });
        } catch (oembedError) {
          console.log('OEmbed also failed, using mock data:', oembedError);
          
          // Final fallback to mock data
          const mockData = generateMockData(videoId, url);
          console.log('Returning mock data for demonstration');
          return res.json({
            ...mockData,
            _note: "Demo data - All YouTube APIs blocked. This shows UI functionality."
          });
        }
      }

    } catch (error: any) {
      console.error('Video info error:', error);
      res.status(500).json({ 
        error: "Failed to fetch video information. Please check the URL and try again." 
      });
    }
  });

  // SSE endpoint for real-time download progress
  app.get("/api/download-progress/:sessionId", (req, res) => {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json({ error: "Session ID is required" });
    }

    // Check if session exists
    const session = downloadManager.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Download session not found" });
    }

    // Set proper SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Critical: Flush headers to establish SSE connection
    res.flushHeaders();

    // Send initial connection message
    res.write('data: {"type": "connected", "message": "Progress stream connected"}\n\n');

    // Add this connection to session manager
    downloadManager.addConnection(sessionId, res);

    // Implement heartbeat mechanism to prevent connection timeouts
    const heartbeatInterval = setInterval(() => {
      if (!res.writableEnded && !res.destroyed) {
        try {
          res.write('data: {"type": "heartbeat"}\n\n');
        } catch (error) {
          console.error('Heartbeat failed:', error);
          clearInterval(heartbeatInterval);
          downloadManager.removeConnection(sessionId, res);
        }
      } else {
        clearInterval(heartbeatInterval);
      }
    }, 30000); // Send heartbeat every 30 seconds

    // Handle client disconnect
    req.on('close', () => {
      console.log(`SSE client disconnected for session: ${sessionId}`);
      clearInterval(heartbeatInterval);
      downloadManager.removeConnection(sessionId, res);
    });

    req.on('error', (error) => {
      console.error('SSE connection error:', error);
      clearInterval(heartbeatInterval);
      downloadManager.removeConnection(sessionId, res);
    });

    // Handle server-side connection close
    res.on('close', () => {
      console.log(`SSE response closed for session: ${sessionId}`);
      clearInterval(heartbeatInterval);
      downloadManager.removeConnection(sessionId, res);
    });
  });

  // Start download with session tracking
  app.post("/api/start-download", async (req, res) => {
    try {
      const result = downloadRequestSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid request parameters" });
      }

      const { url, quality, format } = result.data;
      const videoId = extractVideoId(url) || 'demo';
      
      // Create download session
      const sessionId = downloadManager.createSession(videoId, url, quality, format);
      
      // Return session ID immediately
      res.json({ 
        sessionId,
        message: "Download session created. Connect to progress stream.",
        progressUrl: `/api/download-progress/${sessionId}`
      });

      // Start download in background
      processDownloadInBackground(sessionId, url, quality, format, videoId);

    } catch (error: any) {
      console.error('Start download error:', error);
      res.status(500).json({ error: "Failed to start download." });
    }
  });

  // Download completed file using session ID
  app.get("/api/download-file/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const session = downloadManager.getSession(sessionId);
      
      if (!session) {
        return res.status(404).json({ error: "Download session not found" });
      }
      
      if (session.status !== 'completed') {
        return res.status(400).json({ 
          error: "Download not completed yet", 
          status: session.status,
          progress: session.progress 
        });
      }
      
      if (!session.filePath) {
        return res.status(404).json({ error: "Downloaded file not found" });
      }
      
      // Check if file still exists
      if (!fs.existsSync(session.filePath)) {
        return res.status(404).json({ error: "Downloaded file no longer available" });
      }
      
      const filename = `video_${session.videoId}_${session.quality}.${session.format}`;
      const fileStats = fs.statSync(session.filePath);
      
      // Set appropriate headers for file download
      const mimeTypes: {[key: string]: string} = {
        'mp4': 'video/mp4',
        'webm': 'video/webm',
        'mp3': 'audio/mpeg',
        'm4a': 'audio/mp4'
      };
      
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', mimeTypes[session.format] || 'application/octet-stream');
      res.setHeader('Content-Length', fileStats.size.toString());
      
      // Use createReadStream for memory-safe file delivery
      const fileStream = fs.createReadStream(session.filePath);
      
      fileStream.on('error', (error) => {
        console.error('File stream error:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: "Failed to stream file" });
        }
      });
      
      fileStream.on('end', () => {
        console.log(`File delivered successfully for session: ${sessionId}`);
        
        // Clean up session and file after successful delivery
        setTimeout(() => {
          downloadManager.cleanupSession(sessionId);
        }, 5000); // 5 second delay to ensure delivery is complete
      });
      
      fileStream.pipe(res);
      
    } catch (error) {
      console.error('Download file error:', error);
      res.status(500).json({ error: "Failed to deliver downloaded file" });
    }
  });

  // YouTube video download endpoint with enhanced bot detection bypass
  app.post("/api/download", async (req, res) => {
    try {
      const result = downloadRequestSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid request parameters" });
      }

      const { url, quality, format } = result.data;

      if (!url) {
        return res.status(400).json({ error: 'URL is required' });
      }

      const videoId = extractVideoId(url) || 'demo';
      console.log(`Enhanced download requested: ${format} in ${quality} quality`);
      
      try {
        // Validate inputs
        const validQualities = ['best', '1080p', '720p', '480p', '360p', '240p', '144p'];
        const validFormats = ['mp4', 'webm', 'mp3', 'm4a'];
        
        if (!validQualities.includes(quality)) {
          throw new Error('Invalid quality parameter');
        }
        
        if (!validFormats.includes(format)) {
          throw new Error('Invalid format parameter');
        }
        
        // Use enhanced YouTube extractor with multiple client strategies
        const buffer = await YouTubeExtractor.downloadVideo(url, quality, format);
        
        const filename = `video_${videoId}_${quality}.${format}`;
        console.log(`Enhanced download completed: ${filename}`);
        
        // Set appropriate headers for file download
        const mimeTypes: {[key: string]: string} = {
          'mp4': 'video/mp4',
          'webm': 'video/webm',
          'mp3': 'audio/mpeg',
          'm4a': 'audio/mp4'
        };
        
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', mimeTypes[format] || 'application/octet-stream');
        res.setHeader('Content-Length', buffer.length.toString());
        
        // Send the file buffer directly
        res.send(buffer);
        return;
        
      } catch (downloadError) {
        console.error('Enhanced download failed:', downloadError);
        
        // Fallback: Return error response with detailed information
        res.json({
          success: false,
          message: `Download failed: ${downloadError instanceof Error ? downloadError.message : String(downloadError)}`,
          note: "Enhanced bot detection bypass failed. YouTube's 2025 protection is very aggressive.",
          filename: `video_${videoId}.${format}`,
          format: format,
          quality: quality,
          videoId: videoId,
          error: downloadError instanceof Error ? downloadError.message : String(downloadError),
          _suggestion: "Try different quality settings or try again later when YouTube's rate limiting resets."
        });
      }

    } catch (error: any) {
      console.error('Download error:', error);
      res.status(500).json({ error: "Failed to process download request." });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
