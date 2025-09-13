#!/usr/bin/env python3
import yt_dlp
import json
import sys
import os
import tempfile
from pathlib import Path

# Quality mapping utility functions
QUALITY_MAP = {
    '2160p': 2160,
    '1440p': 1440, 
    '1080p': 1080,
    '720p': 720,
    '480p': 480,
    '360p': 360
}

def parse_quality_height(quality):
    """Convert UI quality string to height number"""
    if quality == 'best':
        return 9999
    return QUALITY_MAP.get(quality, 720)  # Default to 720p if unknown

def build_format_selector(quality, format_type):
    """Build proper yt-dlp format selector"""
    height = parse_quality_height(quality)
    
    if format_type == 'mp4':
        if height >= 1080:
            # High quality: merge separate streams with codec constraints
            return f'bestvideo[height<={height}][vcodec^=avc1][ext=mp4]+bestaudio[acodec^=mp4a][ext=m4a]/bestvideo[height<={height}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<={height}]+bestaudio/best[height<={height}]'
        else:
            # Lower quality: prefer progressive but allow merging  
            return f'best[height<={height}][ext=mp4]/bestvideo[height<={height}][vcodec^=avc1][ext=mp4]+bestaudio[acodec^=mp4a]/best[height<={height}]'
    elif format_type == 'webm':
        # For WebM, prefer VP9/Opus
        return f'bestvideo[height<={height}][ext=webm]+bestaudio[ext=webm]/bestvideo[height<={height}]+bestaudio/best[height<={height}]'
    else:
        # Default fallback
        return f'bestvideo[height<={height}]+bestaudio/best[height<={height}]'

def download_video(url, quality='best', format_type='mp4', output_dir='/tmp/downloads'):
    """
    Download YouTube video with advanced bot detection bypass
    """
    try:
        # Create output directory
        Path(output_dir).mkdir(parents=True, exist_ok=True)
        
        # Build proper format selector
        format_selector = build_format_selector(quality, format_type)
        
        # Configure yt-dlp with bot detection bypass settings
        ydl_opts = {
            'format': format_selector,
            'outtmpl': f'{output_dir}/%(title)s.%(ext)s',
            
            # Bot detection bypass options (2025)
            'use_po_token': True,  # Essential for 2025 bot detection bypass
            'http_headers': {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
            },
            
            # Retry and timeout settings
            'retries': 3,
            'socket_timeout': 30,
            'sleep_interval': 2,
            'max_sleep_interval': 5,
            
            # Critical: Route all output to stderr to keep stdout clean for JSON
            'quiet': True,
            'no_warnings': True,
            'logger': None,  # Disable default logger
            
            # Additional bypass options (DASH/HLS enabled for high quality)
            'extractor_args': {
                'youtube': {
                    'player_client': ['android', 'web'],  # Use multiple clients
                }
            }
        }
        
        # Handle audio formats
        if format_type in ['mp3', 'm4a']:
            ydl_opts.update({
                'format': 'bestaudio/best',
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': format_type,
                    'preferredquality': '192',
                }],
            })
        elif format_type == 'mp4':
            # Add merge format for MP4 compatibility
            ydl_opts['merge_output_format'] = 'mp4'
            # Add ffmpeg options for better HTML5 playback
            ydl_opts['postprocessor_args'] = ['-movflags', '+faststart']
        
        # Download the video
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # Extract info first to get filename
            info = ydl.extract_info(url, download=False)
            if info is None:
                raise Exception("Failed to extract video information")
                
            title = info.get('title', 'Unknown')
            duration = info.get('duration', 0)
            
            # Download the video
            ydl.download([url])
            
            # Find the downloaded file
            for file in Path(output_dir).iterdir():
                if file.is_file() and title.replace('/', '_') in file.name:
                    return {
                        'success': True,
                        'filename': file.name,
                        'filepath': str(file),
                        'title': title,
                        'duration': duration,
                        'format': format_type,
                        'quality': quality
                    }
            
            # Fallback: return the most recent file
            files = list(Path(output_dir).iterdir())
            if files:
                latest_file = max(files, key=os.path.getctime)
                return {
                    'success': True,
                    'filename': latest_file.name,
                    'filepath': str(latest_file),
                    'title': title,
                    'duration': duration,
                    'format': format_type,
                    'quality': quality
                }
            
            raise Exception("Downloaded file not found")
            
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'message': f'Download failed: {str(e)}'
        }

def get_video_info(url):
    """
    Get video information with bot detection bypass
    """
    try:
        ydl_opts = {
            'quiet': True,
            'use_po_token': True,
            'http_headers': {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
            'socket_timeout': 15,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            if info is None:
                raise Exception("Failed to extract video information")
            
            # Extract available formats
            formats = info.get('formats', [])
            qualities = set()
            format_types = set()
            
            for fmt in formats:
                if fmt.get('height'):
                    qualities.add(f"{fmt['height']}p")
                if fmt.get('ext'):
                    format_types.add(fmt['ext'])
            
            return {
                'success': True,
                'title': info.get('title', 'Unknown'),
                'thumbnail': info.get('thumbnail', ''),
                'duration': info.get('duration', 0),
                'views': info.get('view_count', 0),
                'channel': info.get('uploader', 'Unknown'),
                'uploadDate': info.get('upload_date', 'Unknown'),
                'availableQualities': sorted(list(qualities), key=lambda x: int(x[:-1]), reverse=True) or ['720p', '480p', '360p'],
                'availableFormats': list(format_types) or ['mp4', 'webm', 'mp3', 'm4a'],
            }
            
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'message': f'Failed to get video info: {str(e)}'
        }

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'success': False, 'error': 'Missing arguments'}))
        sys.exit(1)
    
    action = sys.argv[1]
    
    if action == 'info':
        url = sys.argv[2]
        result = get_video_info(url)
        print(json.dumps(result))
        
    elif action == 'download':
        url = sys.argv[2]
        quality = sys.argv[3] if len(sys.argv) > 3 else 'best'
        format_type = sys.argv[4] if len(sys.argv) > 4 else 'mp4'
        result = download_video(url, quality, format_type)
        print(json.dumps(result))
        
    else:
        print(json.dumps({'success': False, 'error': 'Invalid action'}))
        sys.exit(1)