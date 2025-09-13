import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

interface VideoInfo {
  title: string;
  thumbnail: string;
  duration: number;
  formats: Array<{
    quality: string;
    format: string;
    filesize?: string;
    url?: string;
  }>;
}

class YouTubeExtractor {
  private userAgents: string[] = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  ];

  private getRandomUserAgent(): string {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async extractVideoInfo(url: string): Promise<VideoInfo> {
    // Add random delay to avoid rate limiting
    await this.delay(Math.random() * 2000 + 1000);

    const userAgent = this.getRandomUserAgent();
    
    // Multiple extraction strategies
    const strategies = [
      this.extractWithAndroidClient.bind(this),
      this.extractWithIOSClient.bind(this),
      this.extractWithWebClient.bind(this),
      this.extractWithEmbedMethod.bind(this),
      this.extractWithOEmbed.bind(this)
    ];

    let lastError: Error | null = null;

    for (const strategy of strategies) {
      try {
        console.log(`Trying extraction strategy: ${strategy.name}`);
        const result = await strategy(url, userAgent);
        if (result) return result;
      } catch (error) {
        console.error(`Strategy ${strategy.name} failed:`, (error as Error).message);
        lastError = error as Error;
        await this.delay(1000); // Wait before next strategy
      }
    }

    throw lastError || new Error('All extraction strategies failed');
  }

  private async extractWithAndroidClient(url: string, userAgent: string): Promise<VideoInfo> {
    const command = `yt-dlp --dump-json --no-warnings --extractor-args "youtube:player_client=android" --user-agent "${userAgent}" "${url}"`;
    
    try {
      const { stdout } = await execAsync(command, { 
        timeout: 30000,
        env: { ...process.env, PYTHONPATH: '/opt/virtualenvs/python3/lib/python3.10/site-packages' }
      });
      
      const data = JSON.parse(stdout);
      return this.formatVideoInfo(data);
    } catch (error) {
      throw new Error(`Android client extraction failed: ${(error as Error).message}`);
    }
  }

  private async extractWithIOSClient(url: string, userAgent: string): Promise<VideoInfo> {
    const command = `yt-dlp --dump-json --no-warnings --extractor-args "youtube:player_client=ios" --user-agent "${userAgent}" "${url}"`;
    
    try {
      const { stdout } = await execAsync(command, { timeout: 30000 });
      const data = JSON.parse(stdout);
      return this.formatVideoInfo(data);
    } catch (error) {
      throw new Error(`iOS client extraction failed: ${(error as Error).message}`);
    }
  }

  private async extractWithWebClient(url: string, userAgent: string): Promise<VideoInfo> {
    const command = `yt-dlp --dump-json --no-warnings --extractor-args "youtube:player_client=web" --user-agent "${userAgent}" --add-header "Accept-Language:en-US,en;q=0.9" "${url}"`;
    
    try {
      const { stdout } = await execAsync(command, { timeout: 30000 });
      const data = JSON.parse(stdout);
      return this.formatVideoInfo(data);
    } catch (error) {
      throw new Error(`Web client extraction failed: ${(error as Error).message}`);
    }
  }

  private async extractWithEmbedMethod(url: string, userAgent: string): Promise<VideoInfo> {
    const videoId = this.extractVideoId(url);
    if (!videoId) throw new Error('Invalid YouTube URL');

    const embedUrl = `https://www.youtube.com/embed/${videoId}`;
    const command = `yt-dlp --dump-json --no-warnings --user-agent "${userAgent}" "${embedUrl}"`;
    
    try {
      const { stdout } = await execAsync(command, { timeout: 30000 });
      const data = JSON.parse(stdout);
      return this.formatVideoInfo(data);
    } catch (error) {
      throw new Error(`Embed extraction failed: ${(error as Error).message}`);
    }
  }

  private async extractWithOEmbed(url: string): Promise<VideoInfo> {
    const videoId = this.extractVideoId(url);
    if (!videoId) throw new Error('Invalid YouTube URL');

    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    
    try {
      const response = await fetch(oembedUrl);
      if (!response.ok) throw new Error('OEmbed request failed');
      
      const data = await response.json();
      return {
        title: data.title || 'Unknown Title',
        thumbnail: data.thumbnail_url || '',
        duration: 0, // OEmbed doesn't provide duration
        formats: [] // OEmbed doesn't provide format info
      };
    } catch (error) {
      throw new Error(`OEmbed extraction failed: ${(error as Error).message}`);
    }
  }

  private extractVideoId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) return match[1];
    }

    return null;
  }

  private formatVideoInfo(data: any): VideoInfo {
    return {
      title: data.title || 'Unknown Title',
      thumbnail: data.thumbnail || data.thumbnails?.[0]?.url || '',
      duration: data.duration || 0,
      formats: (data.formats || [])
        .filter((f: any) => f.vcodec !== 'none' && f.acodec !== 'none')
        .map((f: any) => ({
          quality: f.height ? `${f.height}p` : f.quality || 'Unknown',
          format: f.ext || 'mp4',
          filesize: f.filesize ? this.formatFileSize(f.filesize) : undefined,
          url: f.url
        }))
        .slice(0, 10) // Limit to 10 formats
    };
  }

  private formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  async downloadVideo(url: string, quality: string = '720p', format: string = 'mp4'): Promise<Buffer> {
    const userAgent = this.getRandomUserAgent();
    await this.delay(Math.random() * 2000 + 1000);

    const outputPath = `/tmp/video_${Date.now()}.${format}`;
    
    const strategies = [
      () => this.downloadWithAndroidClient(url, quality, format, userAgent, outputPath),
      () => this.downloadWithIOSClient(url, quality, format, userAgent, outputPath),
      () => this.downloadWithWebClient(url, quality, format, userAgent, outputPath)
    ];

    let lastError: Error | null = null;

    for (const strategy of strategies) {
      try {
        await strategy();
        
        if (fs.existsSync(outputPath)) {
          const buffer = fs.readFileSync(outputPath);
          fs.unlinkSync(outputPath); // Cleanup
          return buffer;
        }
      } catch (error) {
        lastError = error as Error;
        console.error(`Download strategy failed:`, (error as Error).message);
        await this.delay(2000);
      }
    }

    throw lastError || new Error('All download strategies failed');
  }

  private async downloadWithAndroidClient(url: string, quality: string, format: string, userAgent: string, outputPath: string): Promise<void> {
    const qualitySelector = quality === 'best' ? 'best' : `best[height<=${quality.replace('p', '')}]`;
    const command = `yt-dlp --extractor-args "youtube:player_client=android" --user-agent "${userAgent}" -f "${qualitySelector}" -o "${outputPath}" "${url}"`;
    
    await execAsync(command, { timeout: 120000 });
  }

  private async downloadWithIOSClient(url: string, quality: string, format: string, userAgent: string, outputPath: string): Promise<void> {
    const qualitySelector = quality === 'best' ? 'best' : `best[height<=${quality.replace('p', '')}]`;
    const command = `yt-dlp --extractor-args "youtube:player_client=ios" --user-agent "${userAgent}" -f "${qualitySelector}" -o "${outputPath}" "${url}"`;
    
    await execAsync(command, { timeout: 120000 });
  }

  private async downloadWithWebClient(url: string, quality: string, format: string, userAgent: string, outputPath: string): Promise<void> {
    const qualitySelector = quality === 'best' ? 'best' : `best[height<=${quality.replace('p', '')}]`;
    const command = `yt-dlp --extractor-args "youtube:player_client=web" --user-agent "${userAgent}" --add-header "Accept-Language:en-US,en;q=0.9" -f "${qualitySelector}" -o "${outputPath}" "${url}"`;
    
    await execAsync(command, { timeout: 120000 });
  }
}

export default new YouTubeExtractor();