import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { video_info, stream } from "play-dl";
import { downloadRequestSchema, videoInfoSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // YouTube video info endpoint using play-dl
  app.post("/api/video-info", async (req, res) => {
    try {
      const { url } = req.body;
      
      if (!url || !url.includes('youtube.com/watch') && !url.includes('youtu.be/')) {
        return res.status(400).json({ error: "Invalid YouTube URL" });
      }

      const info = await video_info(url);
      
      if (!info) {
        return res.status(400).json({ error: "Video not found or unavailable" });
      }

      // Format duration from seconds to mm:ss
      const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
      };

      const videoInfo = {
        title: info.video_details.title,
        thumbnail: info.video_details.thumbnails?.[0]?.url || '',
        duration: formatDuration(info.video_details.durationInSec),
        views: info.video_details.views?.toLocaleString() || '0',
        channel: info.video_details.channel?.name || 'Unknown',
        uploadDate: info.video_details.uploadedAt || 'Unknown',
        availableQualities: ['720p', '480p', '360p', 'highest'],
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

  // YouTube video download endpoint using play-dl
  app.post("/api/download", async (req, res) => {
    try {
      const result = downloadRequestSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid request parameters" });
      }

      const { url, quality, format } = result.data;

      if (!url || !url.includes('youtube.com/watch') && !url.includes('youtu.be/')) {
        return res.status(400).json({ error: "Invalid YouTube URL" });
      }

      const info = await video_info(url);
      
      if (!info) {
        return res.status(400).json({ error: "Video not found or unavailable" });
      }
      
      const title = info.video_details.title?.replace(/[^\w\s]/gi, '') || 'video';

      // Set appropriate headers for download
      const filename = `${title}.${format}`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      if (format === 'mp3' || format === 'm4a') {
        // Audio only download
        res.setHeader('Content-Type', `audio/${format}`);
        const audioStream = await stream(url, {
          quality: 2
        });
        
        audioStream.stream.pipe(res);
      } else {
        // Video download
        res.setHeader('Content-Type', `video/${format}`);
        const videoStream = await stream(url, {
          quality: quality === '720p' ? 1 : quality === '480p' ? 2 : 3
        });
        
        videoStream.stream.pipe(res);
      }

    } catch (error: any) {
      console.error('Download error:', error);
      res.status(500).json({ error: "Failed to download video. Please try again." });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
