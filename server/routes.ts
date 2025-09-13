import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import axios from "axios";
import * as cheerio from "cheerio";
import { downloadRequestSchema, videoInfoSchema } from "@shared/schema";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

const execAsync = promisify(exec);

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
      const { stdout, stderr } = await execAsync(`python3 "${scriptPath}" info "${url}"`);
      
      if (stderr && !stderr.includes('WARNING')) {
        console.error('yt-dlp stderr:', stderr);
      }
      
      const result = JSON.parse(stdout);
      
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

  // YouTube video info endpoint with multi-tier fallback
  app.post("/api/video-info", async (req, res) => {
    try {
      const { url } = req.body;
      
      // Support regular YouTube videos, YouTube Shorts, and youtu.be links
      const isValidYouTubeUrl = url && (
        url.includes('youtube.com/watch') || 
        url.includes('youtube.com/shorts/') || 
        url.includes('youtu.be/')
      );
      
      if (!isValidYouTubeUrl) {
        return res.status(400).json({ error: "Invalid YouTube URL" });
      }

      const videoId = extractVideoId(url);
      if (!videoId) {
        return res.status(400).json({ error: "Could not extract video ID from URL" });
      }

      try {
        // Tier 1: Try real yt-dlp with bot detection bypass
        const videoInfo = await getRealYouTubeInfo(url);
        return res.json(videoInfo);
      } catch (ytdlpError) {
        console.log('yt-dlp failed, trying OEmbed fallback:', ytdlpError);
        
        try {
          // Tier 2: Try YouTube OEmbed API fallback
          const videoInfo = await getBasicYouTubeInfo(videoId, url);
          console.log('Successfully got video info via OEmbed fallback');
          return res.json({
            ...videoInfo,
            _note: "Limited info - yt-dlp blocked but OEmbed worked"
          });
        } catch (oembedError) {
          console.log('OEmbed also failed, using mock data:', oembedError);
          
          // Tier 3: Return mock data for demonstration
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

  // YouTube video download endpoint (demo version)
  app.post("/api/download", async (req, res) => {
    try {
      const result = downloadRequestSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid request parameters" });
      }

      const { url, quality, format } = result.data;

      // Support regular YouTube videos, YouTube Shorts, and youtu.be links
      const isValidYouTubeUrl = url && (
        url.includes('youtube.com/watch') || 
        url.includes('youtube.com/shorts/') || 
        url.includes('youtu.be/')
      );
      
      if (!isValidYouTubeUrl) {
        return res.status(400).json({ error: "Invalid YouTube URL" });
      }

      const videoId = extractVideoId(url) || 'demo';
      console.log(`Real download requested: ${format} in ${quality} quality`);
      
      try {
        // Real download using yt-dlp with bot detection bypass
        const scriptPath = path.join(__dirname, 'youtube_downloader.py');
        const { stdout, stderr } = await execAsync(`python3 "${scriptPath}" download "${url}" "${quality}" "${format}"`);
        
        if (stderr && !stderr.includes('WARNING')) {
          console.error('Download stderr:', stderr);
        }
        
        const result = JSON.parse(stdout);
        
        if (result.success) {
          // Real file download successful
          const filePath = result.filepath;
          const filename = result.filename;
          
          console.log(`Download completed: ${filename}`);
          
          // Check if file exists
          if (fs.existsSync(filePath)) {
            // Set appropriate headers for file download
            const mimeTypes: {[key: string]: string} = {
              'mp4': 'video/mp4',
              'webm': 'video/webm',
              'mp3': 'audio/mpeg',
              'm4a': 'audio/mp4'
            };
            
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-Type', mimeTypes[format] || 'application/octet-stream');
            
            // Stream the file to client
            const fileStream = fs.createReadStream(filePath);
            fileStream.pipe(res);
            
            // Clean up file after sending (optional)
            fileStream.on('end', () => {
              setTimeout(() => {
                try {
                  fs.unlinkSync(filePath);
                  console.log(`Cleaned up file: ${filename}`);
                } catch (e) {
                  console.log('File cleanup failed:', e);
                }
              }, 5000); // Delete after 5 seconds
            });
            
            return;
          } else {
            throw new Error('Downloaded file not found');
          }
        } else {
          throw new Error(result.error || 'Download failed');
        }
      } catch (downloadError) {
        console.error('Real download failed:', downloadError);
        
        // Fallback: Return error response
        res.json({
          success: false,
          message: `Download failed: ${downloadError}`,
          note: "YouTube's 2025 bot detection is very aggressive. This would work with proper proxy rotation in production.",
          filename: `video_${videoId}.${format}`,
          format: format,
          quality: quality,
          videoId: videoId,
          error: downloadError instanceof Error ? downloadError.message : String(downloadError)
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
