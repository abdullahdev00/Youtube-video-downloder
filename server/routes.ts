import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import youtubedl from "youtube-dl-exec";
import { downloadRequestSchema, videoInfoSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // YouTube video info endpoint using youtube-dl-exec
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

      // Fetch video info using yt-dlp
      const info = await youtubedl(url, {
        dumpSingleJson: true,
        noCheckCertificates: true,
        noWarnings: true,
        preferFreeFormats: true,
        addHeader: [
          'referer:youtube.com',
          'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        ]
      });
      
      if (!info || typeof info === 'string' || !info.title) {
        return res.status(400).json({ error: "Video not found or unavailable" });
      }

      // Format duration from seconds to mm:ss
      const formatDuration = (seconds: number) => {
        if (!seconds) return '00:00';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
      };

      const videoInfo = {
        title: (info as any).title,
        thumbnail: (info as any).thumbnail || '',
        duration: formatDuration((info as any).duration),
        views: (info as any).view_count?.toLocaleString() || '0',
        channel: (info as any).uploader || (info as any).channel || 'Unknown',
        uploadDate: (info as any).upload_date ? new Date((info as any).upload_date).toLocaleDateString() : 'Unknown',
        availableQualities: ['720p', '480p', '360p', 'best'],
        availableFormats: ['mp4', 'webm', 'mp3', 'm4a'],
      };

      res.json(videoInfo);
    } catch (error: any) {
      console.error('Video info error:', error);
      res.status(500).json({ 
        error: "Failed to fetch video information. Please check the URL and try again." 
      });
    }
  });

  // YouTube video download endpoint using youtube-dl-exec
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

      // Get video info for filename
      const info = await youtubedl(url, {
        dumpSingleJson: true,
        noCheckCertificates: true,
        noWarnings: true
      });
      
      const title = (info as any).title?.replace(/[^\w\s]/gi, '') || 'video';
      const filename = `${title}.${format}`;
      
      // Set headers
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', format === 'mp3' || format === 'm4a' ? `audio/${format}` : `video/${format}`);
      
      // Configure download options based on format and quality
      const downloadOptions: any = {
        noCheckCertificates: true,
        noWarnings: true,
        addHeader: [
          'referer:youtube.com',
          'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        ]
      };
      
      if (format === 'mp3') {
        downloadOptions.extractAudio = true;
        downloadOptions.audioFormat = 'mp3';
        downloadOptions.audioQuality = '192K';
      } else if (format === 'm4a') {
        downloadOptions.extractAudio = true;
        downloadOptions.audioFormat = 'm4a';
        downloadOptions.audioQuality = '192K';
      } else {
        // Video download
        if (quality === '720p') {
          downloadOptions.format = 'best[height<=720]';
        } else if (quality === '480p') {
          downloadOptions.format = 'best[height<=480]';
        } else if (quality === '360p') {
          downloadOptions.format = 'best[height<=360]';
        } else {
          downloadOptions.format = 'best';
        }
      }
      
      // Stream the download directly to response
      const process = youtubedl.exec(url, {
        ...downloadOptions,
        output: '-'
      });
      
      process.stdout?.pipe(res);
      
      process.on('error', (error) => {
        console.error('Download error:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: "Failed to download video" });
        }
      });
      
      process.on('close', (code) => {
        if (code !== 0 && !res.headersSent) {
          res.status(500).json({ error: "Download failed" });
        }
      });

    } catch (error: any) {
      console.error('Download error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to download video. Please try again." });
      }
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
