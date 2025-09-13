import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import ytdl from "ytdl-core";
import { downloadRequestSchema, videoInfoSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // YouTube video info endpoint
  app.post("/api/video-info", async (req, res) => {
    try {
      const { url } = req.body;
      
      if (!url || !ytdl.validateURL(url)) {
        return res.status(400).json({ error: "Invalid YouTube URL" });
      }

      const info = await ytdl.getInfo(url);
      const videoDetails = info.videoDetails;
      
      // Get available formats
      const formats = ytdl.filterFormats(info.formats, 'videoandaudio');
      const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
      
      const availableQualities = Array.from(new Set(formats.map(f => f.qualityLabel).filter(Boolean)));
      const availableFormats = ['mp4', 'webm', 'mp3', 'm4a'];

      const videoInfo = {
        title: videoDetails.title,
        thumbnail: videoDetails.thumbnails[videoDetails.thumbnails.length - 1]?.url || '',
        duration: new Date(parseInt(videoDetails.lengthSeconds) * 1000).toISOString().substr(14, 5),
        views: parseInt(videoDetails.viewCount).toLocaleString(),
        channel: videoDetails.author.name,
        uploadDate: new Date(videoDetails.publishDate).toLocaleDateString(),
        availableQualities,
        availableFormats,
      };

      res.json(videoInfo);
    } catch (error) {
      console.error('Video info error:', error);
      res.status(500).json({ error: "Failed to fetch video information" });
    }
  });

  // YouTube video download endpoint
  app.post("/api/download", async (req, res) => {
    try {
      const result = downloadRequestSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid request parameters" });
      }

      const { url, quality, format } = result.data;

      if (!ytdl.validateURL(url)) {
        return res.status(400).json({ error: "Invalid YouTube URL" });
      }

      const info = await ytdl.getInfo(url);
      const title = info.videoDetails.title.replace(/[^\w\s]/gi, '');

      // Set appropriate headers for download
      const filename = `${title}.${format}`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      if (format === 'mp3' || format === 'm4a') {
        // Audio only download
        res.setHeader('Content-Type', `audio/${format}`);
        const audioFormat = ytdl.chooseFormat(info.formats, { 
          quality: 'highestaudio',
          filter: 'audioonly'
        });
        
        ytdl(url, { format: audioFormat }).pipe(res);
      } else {
        // Video download
        res.setHeader('Content-Type', `video/${format}`);
        const videoFormat = ytdl.chooseFormat(info.formats, { 
          quality: quality === '720p' ? 'highest' : quality,
          filter: 'videoandaudio'
        });
        
        ytdl(url, { format: videoFormat }).pipe(res);
      }

    } catch (error) {
      console.error('Download error:', error);
      res.status(500).json({ error: "Failed to download video" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
