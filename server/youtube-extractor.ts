import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

// Quality mapping utility functions
interface QualityMapping {
  [key: string]: number;
}

const QUALITY_MAP: QualityMapping = {
  '2160p': 2160,
  '1440p': 1440,
  '1080p': 1080,
  '720p': 720,
  '480p': 480,
  '360p': 360
};

function parseQualityHeight(quality: string): number {
  if (quality === 'best') return 9999;
  return QUALITY_MAP[quality] || 720; // Default to 720p if unknown
}

function buildFormatSelector(quality: string, format: string): string {
  const height = parseQualityHeight(quality);
  
  if (format === 'mp4') {
    // For MP4, prefer H.264/AAC for compatibility
    if (height >= 1080) {
      // High quality: merge separate video/audio streams with codec constraints
      return `bestvideo[height<=${height}][vcodec^=avc1][ext=mp4]+bestaudio[acodec^=mp4a][ext=m4a]/bestvideo[height<=${height}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=${height}]+bestaudio/best[height<=${height}]`;
    } else {
      // Lower quality: prefer progressive but allow merging
      return `best[height<=${height}][ext=mp4]/bestvideo[height<=${height}][vcodec^=avc1][ext=mp4]+bestaudio[acodec^=mp4a]/best[height<=${height}]`;
    }
  } else if (format === 'webm') {
    // For WebM, prefer VP9/Opus
    return `bestvideo[height<=${height}][ext=webm]+bestaudio[ext=webm]/bestvideo[height<=${height}]+bestaudio/best[height<=${height}]`;
  } else {
    // Default fallback
    return `bestvideo[height<=${height}]+bestaudio/best[height<=${height}]`;
  }
}

function buildOutputTemplate(outputPath: string): string {
  // Replace extension with yt-dlp template to get actual format
  return outputPath.replace(/\.[^.]+$/, '.%(ext)s');
}

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

  // New method for downloading with real-time progress
  async downloadVideoWithProgress(
    url: string, 
    quality: string = '720p', 
    format: string = 'mp4',
    outputPath: string,
    progressCallback?: (progress: any) => void,
    timeoutMs: number = 30 * 60 * 1000 // 30 minutes default
  ): Promise<string> {
    const userAgent = this.getRandomUserAgent();
    await this.delay(Math.random() * 2000 + 1000);

    const strategies = [
      () => this.downloadWithProgressAndroidClient(url, quality, format, userAgent, outputPath, progressCallback, timeoutMs),
      () => this.downloadWithProgressIOSClient(url, quality, format, userAgent, outputPath, progressCallback, timeoutMs),
      () => this.downloadWithProgressWebClient(url, quality, format, userAgent, outputPath, progressCallback, timeoutMs)
    ];

    let lastError: Error | null = null;

    for (const strategy of strategies) {
      try {
        await strategy();
        
        // Check for the actual output file with potential different extension
        const basePath = outputPath.replace(/\.[^.]+$/, '');
        const possibleExtensions = ['mp4', 'webm', 'mkv', 'avi', 'mov', 'flv'];
        let foundFile = null;
        
        // First check the exact path
        if (fs.existsSync(outputPath)) {
          foundFile = outputPath;
        } else {
          // Check for files with different extensions
          for (const ext of possibleExtensions) {
            const testPath = `${basePath}.${ext}`;
            if (fs.existsSync(testPath)) {
              foundFile = testPath;
              break;
            }
          }
        }
        
        if (foundFile) {
          console.log(`Download completed successfully: ${foundFile}`);
          return foundFile; // Return the actual file path
        }
      } catch (error) {
        lastError = error as Error;
        console.error(`Download strategy with progress failed:`, (error as Error).message);
        await this.delay(2000);
      }
    }

    throw lastError || new Error('All download strategies with progress failed');
  }

  private async downloadWithAndroidClient(url: string, quality: string, format: string, userAgent: string, outputPath: string): Promise<void> {
    const qualitySelector = buildFormatSelector(quality, format);
    const outputTemplate = buildOutputTemplate(outputPath);
    const mergeFormat = format === 'mp4' ? '--merge-output-format mp4' : '';
    const command = `yt-dlp --extractor-args "youtube:player_client=android" --user-agent "${userAgent}" -f "${qualitySelector}" ${mergeFormat} -o "${outputTemplate}" "${url}"`;
    
    await execAsync(command, { timeout: 120000 });
  }

  private async downloadWithIOSClient(url: string, quality: string, format: string, userAgent: string, outputPath: string): Promise<void> {
    const qualitySelector = buildFormatSelector(quality, format);
    const outputTemplate = buildOutputTemplate(outputPath);
    const mergeFormat = format === 'mp4' ? '--merge-output-format mp4' : '';
    const command = `yt-dlp --extractor-args "youtube:player_client=ios" --user-agent "${userAgent}" -f "${qualitySelector}" ${mergeFormat} -o "${outputTemplate}" "${url}"`;
    
    await execAsync(command, { timeout: 120000 });
  }

  private async downloadWithWebClient(url: string, quality: string, format: string, userAgent: string, outputPath: string): Promise<void> {
    const qualitySelector = buildFormatSelector(quality, format);
    const outputTemplate = buildOutputTemplate(outputPath);
    const mergeFormat = format === 'mp4' ? '--merge-output-format mp4' : '';
    const command = `yt-dlp --extractor-args "youtube:player_client=web" --user-agent "${userAgent}" --add-header "Accept-Language:en-US,en;q=0.9" -f "${qualitySelector}" ${mergeFormat} -o "${outputTemplate}" "${url}"`;
    
    await execAsync(command, { timeout: 120000 });
  }

  // Progress-enabled download methods using spawn for real-time progress
  private async downloadWithProgressAndroidClient(
    url: string, 
    quality: string, 
    format: string, 
    userAgent: string, 
    outputPath: string, 
    progressCallback?: (progress: any) => void,
    timeoutMs: number = 30 * 60 * 1000 // 30 minutes default
  ): Promise<string> {
    const qualitySelector = buildFormatSelector(quality, format);
    const outputTemplate = buildOutputTemplate(outputPath);
    
    const args = [
      '--extractor-args', 'youtube:player_client=android',
      '--user-agent', userAgent,
      '-f', qualitySelector,
      '-o', outputTemplate,
      '--newline', // Force progress output on new lines
      '--progress', // Show progress
      '--no-colors', // Disable colors for easier parsing
      url
    ];
    
    // Add merge format for MP4 compatibility
    if (format === 'mp4') {
      args.splice(-1, 0, '--merge-output-format', 'mp4');
    }

    return new Promise((resolve, reject) => {
      const ytdlpProcess = spawn('yt-dlp', args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stderr = '';
      let timeoutHandle: NodeJS.Timeout | null = null;
      
      ytdlpProcess.stderr.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;
        
        // Parse progress from yt-dlp output
        this.parseProgressOutput(chunk, progressCallback);
      });

      ytdlpProcess.stdout.on('data', (data) => {
        // Sometimes progress goes to stdout
        const chunk = data.toString();
        this.parseProgressOutput(chunk, progressCallback);
      });

      ytdlpProcess.on('close', (code) => {
        // Clear timeout on completion
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
        }
        
        if (code === 0) {
          // Find the actual output file with potential different extension
          const basePath = outputPath.replace(/\.[^.]+$/, '');
          const possibleExtensions = ['mp4', 'webm', 'mkv', 'avi', 'mov', 'flv'];
          let foundFile = null;
          
          // First check the exact path
          if (fs.existsSync(outputPath)) {
            foundFile = outputPath;
          } else {
            // Check for files with different extensions
            for (const ext of possibleExtensions) {
              const testPath = `${basePath}.${ext}`;
              if (fs.existsSync(testPath)) {
                foundFile = testPath;
                break;
              }
            }
          }
          
          if (foundFile) {
            resolve(foundFile);
          } else {
            reject(new Error('Downloaded file not found after Android client completion'));
          }
        } else {
          reject(new Error(`yt-dlp Android client failed with code ${code}: ${stderr}`));
        }
      });

      ytdlpProcess.on('error', (error) => {
        // Clear timeout on error
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
        }
        reject(new Error(`yt-dlp Android client process error: ${error.message}`));
      });

      // Set timeout with proper cleanup
      timeoutHandle = setTimeout(() => {
        ytdlpProcess.kill();
        reject(new Error(`yt-dlp Android client download timeout after ${timeoutMs / 1000}s`));
      }, timeoutMs);
    });
  }

  private async downloadWithProgressIOSClient(
    url: string, 
    quality: string, 
    format: string, 
    userAgent: string, 
    outputPath: string, 
    progressCallback?: (progress: any) => void,
    timeoutMs: number = 30 * 60 * 1000 // 30 minutes default
  ): Promise<string> {
    const qualitySelector = buildFormatSelector(quality, format);
    const outputTemplate = buildOutputTemplate(outputPath);
    
    const args = [
      '--extractor-args', 'youtube:player_client=ios',
      '--user-agent', userAgent,
      '-f', qualitySelector,
      '-o', outputTemplate,
      '--newline',
      '--progress',
      '--no-colors',
      url
    ];
    
    // Add merge format for MP4 compatibility
    if (format === 'mp4') {
      args.splice(-1, 0, '--merge-output-format', 'mp4');
    }

    return new Promise((resolve, reject) => {
      const ytdlpProcess = spawn('yt-dlp', args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stderr = '';
      let timeoutHandle: NodeJS.Timeout | null = null;
      
      ytdlpProcess.stderr.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;
        this.parseProgressOutput(chunk, progressCallback);
      });

      ytdlpProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        this.parseProgressOutput(chunk, progressCallback);
      });

      ytdlpProcess.on('close', (code) => {
        // Clear timeout on completion
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
        }
        
        if (code === 0) {
          // Find the actual output file with potential different extension
          const basePath = outputPath.replace(/\.[^.]+$/, '');
          const possibleExtensions = ['mp4', 'webm', 'mkv', 'avi', 'mov', 'flv'];
          let foundFile = null;
          
          // First check the exact path
          if (fs.existsSync(outputPath)) {
            foundFile = outputPath;
          } else {
            // Check for files with different extensions
            for (const ext of possibleExtensions) {
              const testPath = `${basePath}.${ext}`;
              if (fs.existsSync(testPath)) {
                foundFile = testPath;
                break;
              }
            }
          }
          
          if (foundFile) {
            resolve(foundFile);
          } else {
            reject(new Error('Downloaded file not found after iOS client completion'));
          }
        } else {
          reject(new Error(`yt-dlp iOS client failed with code ${code}: ${stderr}`));
        }
      });

      ytdlpProcess.on('error', (error) => {
        // Clear timeout on error
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
        }
        reject(new Error(`yt-dlp iOS client process error: ${error.message}`));
      });

      // Set timeout with proper cleanup
      timeoutHandle = setTimeout(() => {
        ytdlpProcess.kill();
        reject(new Error(`yt-dlp iOS client download timeout after ${timeoutMs / 1000}s`));
      }, timeoutMs);
    });
  }

  private async downloadWithProgressWebClient(
    url: string, 
    quality: string, 
    format: string, 
    userAgent: string, 
    outputPath: string, 
    progressCallback?: (progress: any) => void,
    timeoutMs: number = 30 * 60 * 1000 // 30 minutes default
  ): Promise<string> {
    const qualitySelector = buildFormatSelector(quality, format);
    const outputTemplate = buildOutputTemplate(outputPath);
    
    const args = [
      '--extractor-args', 'youtube:player_client=web',
      '--user-agent', userAgent,
      '--add-header', 'Accept-Language:en-US,en;q=0.9',
      '-f', qualitySelector,
      '-o', outputTemplate,
      '--newline',
      '--progress',
      '--no-colors',
      url
    ];
    
    // Add merge format for MP4 compatibility
    if (format === 'mp4') {
      args.splice(-1, 0, '--merge-output-format', 'mp4');
    }

    return new Promise((resolve, reject) => {
      const ytdlpProcess = spawn('yt-dlp', args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stderr = '';
      let timeoutHandle: NodeJS.Timeout | null = null;
      
      ytdlpProcess.stderr.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;
        this.parseProgressOutput(chunk, progressCallback);
      });

      ytdlpProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        this.parseProgressOutput(chunk, progressCallback);
      });

      ytdlpProcess.on('close', (code) => {
        // Clear timeout on completion
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
        }
        
        if (code === 0) {
          // Find the actual output file with potential different extension
          const basePath = outputPath.replace(/\.[^.]+$/, '');
          const possibleExtensions = ['mp4', 'webm', 'mkv', 'avi', 'mov', 'flv'];
          let foundFile = null;
          
          // First check the exact path
          if (fs.existsSync(outputPath)) {
            foundFile = outputPath;
          } else {
            // Check for files with different extensions
            for (const ext of possibleExtensions) {
              const testPath = `${basePath}.${ext}`;
              if (fs.existsSync(testPath)) {
                foundFile = testPath;
                break;
              }
            }
          }
          
          if (foundFile) {
            resolve(foundFile);
          } else {
            reject(new Error('Downloaded file not found after Web client completion'));
          }
        } else {
          reject(new Error(`yt-dlp Web client failed with code ${code}: ${stderr}`));
        }
      });

      ytdlpProcess.on('error', (error) => {
        // Clear timeout on error
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
        }
        reject(new Error(`yt-dlp Web client process error: ${error.message}`));
      });

      // Set timeout with proper cleanup
      timeoutHandle = setTimeout(() => {
        ytdlpProcess.kill();
        reject(new Error(`yt-dlp Web client download timeout after ${timeoutMs / 1000}s`));
      }, timeoutMs);
    });
  }

  // Parse yt-dlp progress output and extract meaningful data
  private parseProgressOutput(chunk: string, progressCallback?: (progress: any) => void): void {
    if (!progressCallback) return;

    const lines = chunk.split('\n');
    
    for (const line of lines) {
      // yt-dlp progress format: [download] 45.2% of 123.45MB at 1.23MB/s ETA 00:45
      const progressMatch = line.match(/\[download\]\s+(\d+\.?\d*)%\s+of\s+([\d\.]+\w+)(?:\s+at\s+([\d\.]+\w+\/s))?(?:\s+ETA\s+(\d+:\d+))?/);
      
      if (progressMatch) {
        const [, percent, totalSize, speed, eta] = progressMatch;
        
        const progress = {
          progress: parseFloat(percent),
          fileSize: totalSize,
          speed: speed || 'calculating...',
          eta: eta || 'calculating...',
          downloadedSize: this.calculateDownloadedSize(parseFloat(percent), totalSize)
        };
        
        progressCallback(progress);
      }
      
      // Also check for file size info
      const sizeMatch = line.match(/\[download\] Destination:\s+(.+)/);
      if (sizeMatch) {
        // File destination found - could be useful info
        console.log(`Download destination: ${sizeMatch[1]}`);
      }
    }
  }

  private calculateDownloadedSize(percent: number, totalSize: string): string {
    try {
      const match = totalSize.match(/([\d\.]+)(\w+)/);
      if (match) {
        const [, size, unit] = match;
        const downloadedAmount = (parseFloat(size) * percent / 100).toFixed(2);
        return `${downloadedAmount}${unit}`;
      }
    } catch (error) {
      console.error('Error calculating downloaded size:', error);
    }
    return 'calculating...';
  }
}

export default new YouTubeExtractor();