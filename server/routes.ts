import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import ytdl from "@distube/ytdl-core";
import { downloadRequestSchema, videoInfoSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // YouTube video info endpoint with retry logic
  app.post("/api/video-info", async (req, res) => {
    const maxRetries = 3;
    const retryDelay = 1000;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const { url } = req.body;
        
        if (!url || !ytdl.validateURL(url)) {
          return res.status(400).json({ error: "Invalid YouTube URL" });
        }

        const info = await ytdl.getInfo(url, {
          requestOptions: {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
          }
        });
        
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

        return res.json(videoInfo);
      } catch (error: any) {
        console.error(`Video info error (attempt ${attempt}/${maxRetries}):`, error);
        
        // Check if it's a 410 error or similar blocking
        if (error.statusCode === 410 || error.statusCode === 403) {
          if (attempt < maxRetries) {
            console.log(`Retrying in ${retryDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          } else {
            return res.status(503).json({ 
              error: "YouTube is temporarily blocking requests. Please try again later." 
            });
          }
        }
        
        // For other errors, return immediately
        if (attempt === maxRetries) {
          return res.status(500).json({ 
            error: "Failed to fetch video information. Please check the URL and try again." 
          });
        }
        
        // Wait before retry for other errors
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  });

  // YouTube video download endpoint with improved error handling
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

      const info = await ytdl.getInfo(url, {
        requestOptions: {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        }
      });
      
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
        
        ytdl(url, { 
          format: audioFormat,
          requestOptions: {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
          }
        }).pipe(res);
      } else {
        // Video download
        res.setHeader('Content-Type', `video/${format}`);
        const videoFormat = ytdl.chooseFormat(info.formats, { 
          quality: quality === '720p' ? 'highest' : quality,
          filter: 'videoandaudio'
        });
        
        ytdl(url, { 
          format: videoFormat,
          requestOptions: {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
          }
        }).pipe(res);
      }

    } catch (error: any) {
      console.error('Download error:', error);
      
      if (error.statusCode === 410 || error.statusCode === 403) {
        res.status(503).json({ error: "YouTube is temporarily blocking downloads. Please try again later." });
      } else {
        res.status(500).json({ error: "Failed to download video. Please try again." });
      }
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
