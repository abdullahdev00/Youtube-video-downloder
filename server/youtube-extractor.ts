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
  
  // SIMPLIFIED: Use basic selectors that are known to work reliably
  if (format === 'mp4') {
    // Simple MP4 selector with fallbacks
    return `best[height<=${height}][ext=mp4]/bestvideo[height<=${height}]+bestaudio[ext=m4a]/best[height<=${height}]`;
  } else if (format === 'webm') {
    // Simple WebM selector
    return `best[height<=${height}][ext=webm]/bestvideo[height<=${height}]+bestaudio[ext=webm]/best[height<=${height}]`;
  } else {
    // Default fallback - use most compatible selector
    return `best[height<=${height}]`;
  }
}

function buildOutputTemplate(outputPath: string): string {
  // Replace extension with yt-dlp template to get actual format
  return outputPath.replace(/\.[^.]+$/, '.%(ext)s');
}

// NEW: Precise quality selection interfaces and functions
interface AvailableFormat {
  format_id: string;
  height?: number;
  width?: number;
  ext: string;
  vcodec?: string;
  acodec?: string;
  filesize?: number;
  protocol?: string;
}

interface QualitySelection {
  formatSelector: string;
  selectedHeight: number;
  selectedFormat: string;
  requested: { quality: string; format: string };
}

async function getAvailableFormats(url: string, userAgent: string): Promise<AvailableFormat[]> {
  const command = `yt-dlp --dump-json --no-warnings --extractor-args "youtube:player_client=android" --user-agent "${userAgent}" "${url}"`;
  
  try {
    const { stdout } = await execAsync(command, { 
      timeout: 30000,
      env: { ...process.env, PYTHONPATH: '/opt/virtualenvs/python3/lib/python3.10/site-packages' }
    });
    
    const data = JSON.parse(stdout);
    return data.formats || [];
  } catch (error) {
    console.error('Failed to get available formats:', error);
    return [];
  }
}

function selectFormatByQuality(formats: AvailableFormat[], desiredHeight: number, container: string): QualitySelection {
  console.log(`Selecting format for desired height: ${desiredHeight}, container: ${container}`);
  
  const requested = { 
    quality: Object.keys(QUALITY_MAP).find(k => QUALITY_MAP[k] === desiredHeight) || `${desiredHeight}p`, 
    format: container 
  };

  // Filter out formats that are too high quality (never go above requested)
  const availableFormats = formats.filter(f => 
    f.height && f.height <= desiredHeight && f.ext && f.format_id
  );

  // 1. Try to find progressive format with exact container match
  let progressive = availableFormats.filter(f => 
    f.vcodec && f.vcodec !== 'none' && 
    f.acodec && f.acodec !== 'none' && 
    f.ext === container
  );
  
  if (progressive.length > 0) {
    // Get the highest quality progressive format
    const selected = progressive.reduce((best, current) => 
      (current.height || 0) > (best.height || 0) ? current : best
    );
    console.log(`Selected progressive format: ${selected.format_id} (${selected.height}p, ${selected.ext})`);
    return {
      formatSelector: selected.format_id,
      selectedHeight: selected.height || 0,
      selectedFormat: selected.ext,
      requested
    };
  }

  // 2. Try progressive with any container
  progressive = availableFormats.filter(f => 
    f.vcodec && f.vcodec !== 'none' && 
    f.acodec && f.acodec !== 'none'
  );
  
  if (progressive.length > 0) {
    const selected = progressive.reduce((best, current) => 
      (current.height || 0) > (best.height || 0) ? current : best
    );
    console.log(`Selected progressive format (any container): ${selected.format_id} (${selected.height}p, ${selected.ext})`);
    return {
      formatSelector: selected.format_id,
      selectedHeight: selected.height || 0,
      selectedFormat: selected.ext,
      requested
    };
  }

  // 3. Merge separate video and audio streams
  const videoFormats = availableFormats.filter(f => 
    f.vcodec && f.vcodec !== 'none' && (!f.acodec || f.acodec === 'none')
  );
  
  const audioFormats = formats.filter(f => 
    f.acodec && f.acodec !== 'none' && (!f.vcodec || f.vcodec === 'none')
  );

  if (videoFormats.length > 0 && audioFormats.length > 0) {
    // Pick best video under desired height
    const selectedVideo = videoFormats.reduce((best, current) => 
      (current.height || 0) > (best.height || 0) ? current : best
    );
    
    // Pick compatible audio format
    let selectedAudio;
    if (container === 'mp4') {
      selectedAudio = audioFormats.find(f => f.acodec?.includes('mp4a') || f.ext === 'm4a') || audioFormats[0];
    } else {
      selectedAudio = audioFormats.find(f => f.ext === 'webm' || f.acodec?.includes('opus')) || audioFormats[0];
    }
    
    const formatSelector = `${selectedVideo.format_id}+${selectedAudio.format_id}`;
    console.log(`Selected merged format: ${formatSelector} (${selectedVideo.height}p video + ${selectedAudio.ext} audio)`);
    
    return {
      formatSelector,
      selectedHeight: selectedVideo.height || 0,
      selectedFormat: selectedVideo.ext,
      requested
    };
  }

  // 4. Fallback to best available under desired height
  if (availableFormats.length > 0) {
    const selected = availableFormats.reduce((best, current) => 
      (current.height || 0) > (best.height || 0) ? current : best
    );
    console.log(`Fallback format selected: ${selected.format_id} (${selected.height}p, ${selected.ext})`);
    return {
      formatSelector: selected.format_id,
      selectedHeight: selected.height || 0,
      selectedFormat: selected.ext,
      requested
    };
  }

  // 5. Ultimate fallback - use old selector
  console.warn(`No suitable formats found, using fallback selector`);
  return {
    formatSelector: `best[height<=${desiredHeight}]`,
    selectedHeight: desiredHeight,
    selectedFormat: container,
    requested
  };
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
        
        // Check for actual output file with potential different extension
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
          const buffer = fs.readFileSync(foundFile);
          fs.unlinkSync(foundFile); // Cleanup
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
    // Use precise quality selection
    const desiredHeight = parseQualityHeight(quality);
    const availableFormats = await getAvailableFormats(url, userAgent);
    const selection = selectFormatByQuality(availableFormats, desiredHeight, format);
    
    console.log(`Quality selection - Requested: ${selection.requested.quality} (${selection.requested.format}), Selected: ${selection.selectedHeight}p (${selection.selectedFormat})`);
    
    const outputTemplate = buildOutputTemplate(outputPath);
    const command = `yt-dlp --extractor-args "youtube:player_client=android" --user-agent "${userAgent}" -f "${selection.formatSelector}" -o "${outputTemplate}" "${url}"`;
    
    await execAsync(command, { timeout: 600000 }); // 10 minutes for high quality downloads
  }

  private async downloadWithIOSClient(url: string, quality: string, format: string, userAgent: string, outputPath: string): Promise<void> {
    // Use precise quality selection
    const desiredHeight = parseQualityHeight(quality);
    const availableFormats = await getAvailableFormats(url, userAgent);
    const selection = selectFormatByQuality(availableFormats, desiredHeight, format);
    
    console.log(`Quality selection - Requested: ${selection.requested.quality} (${selection.requested.format}), Selected: ${selection.selectedHeight}p (${selection.selectedFormat})`);
    
    const outputTemplate = buildOutputTemplate(outputPath);
    const command = `yt-dlp --extractor-args "youtube:player_client=ios" --user-agent "${userAgent}" -f "${selection.formatSelector}" -o "${outputTemplate}" "${url}"`;
    
    await execAsync(command, { timeout: 600000 }); // 10 minutes for high quality downloads
  }

  private async downloadWithWebClient(url: string, quality: string, format: string, userAgent: string, outputPath: string): Promise<void> {
    // Use precise quality selection
    const desiredHeight = parseQualityHeight(quality);
    const availableFormats = await getAvailableFormats(url, userAgent);
    const selection = selectFormatByQuality(availableFormats, desiredHeight, format);
    
    console.log(`Quality selection - Requested: ${selection.requested.quality} (${selection.requested.format}), Selected: ${selection.selectedHeight}p (${selection.selectedFormat})`);
    
    const outputTemplate = buildOutputTemplate(outputPath);
    const command = `yt-dlp --extractor-args "youtube:player_client=web" --user-agent "${userAgent}" --add-header "Accept-Language:en-US,en;q=0.9" -f "${selection.formatSelector}" -o "${outputTemplate}" "${url}"`;
    
    await execAsync(command, { timeout: 600000 }); // 10 minutes for high quality downloads
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
    // Use precise quality selection
    const desiredHeight = parseQualityHeight(quality);
    const availableFormats = await getAvailableFormats(url, userAgent);
    const selection = selectFormatByQuality(availableFormats, desiredHeight, format);
    
    console.log(`Progress Quality selection - Requested: ${selection.requested.quality} (${selection.requested.format}), Selected: ${selection.selectedHeight}p (${selection.selectedFormat})`);
    
    const outputTemplate = buildOutputTemplate(outputPath);
    
    const args = [
      '--extractor-args', 'youtube:player_client=android',
      '--user-agent', userAgent,
      '-f', selection.formatSelector,
      '-o', outputTemplate,
      '--newline', // Force progress output on new lines
      '--progress', // Show progress
      '--no-colors', // Disable colors for easier parsing
      url
    ];
    
    // REMOVED: Don't force MP4 merge as it causes codec/container mismatches
    // Let yt-dlp choose compatible container naturally

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
    // Use precise quality selection
    const desiredHeight = parseQualityHeight(quality);
    const availableFormats = await getAvailableFormats(url, userAgent);
    const selection = selectFormatByQuality(availableFormats, desiredHeight, format);
    
    console.log(`Progress iOS Quality selection - Requested: ${selection.requested.quality} (${selection.requested.format}), Selected: ${selection.selectedHeight}p (${selection.selectedFormat})`);
    
    const outputTemplate = buildOutputTemplate(outputPath);
    
    const args = [
      '--extractor-args', 'youtube:player_client=ios',
      '--user-agent', userAgent,
      '-f', selection.formatSelector,
      '-o', outputTemplate,
      '--newline',
      '--progress',
      '--no-colors',
      url
    ];
    
    // REMOVED: Don't force MP4 merge as it causes codec/container mismatches
    // Let yt-dlp choose compatible container naturally

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
    // Use precise quality selection
    const desiredHeight = parseQualityHeight(quality);
    const availableFormats = await getAvailableFormats(url, userAgent);
    const selection = selectFormatByQuality(availableFormats, desiredHeight, format);
    
    console.log(`Progress Web Quality selection - Requested: ${selection.requested.quality} (${selection.requested.format}), Selected: ${selection.selectedHeight}p (${selection.selectedFormat})`);
    
    const outputTemplate = buildOutputTemplate(outputPath);
    
    const args = [
      '--extractor-args', 'youtube:player_client=web',
      '--user-agent', userAgent,
      '--add-header', 'Accept-Language:en-US,en;q=0.9',
      '-f', selection.formatSelector,
      '-o', outputTemplate,
      '--newline',
      '--progress',
      '--no-colors',
      url
    ];
    
    // REMOVED: Don't force MP4 merge as it causes codec/container mismatches
    // Let yt-dlp choose compatible container naturally

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