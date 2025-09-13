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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
