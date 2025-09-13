import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Play, Download, Clock, Eye, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VideoPreviewCardProps {
  thumbnail: string;
  title: string;
  channel: string;
  duration: string;
  views: string;
  uploadDate: string;
  url: string; // Need video URL for direct API calls
  onDownload?: (quality: string, format: string) => void;
}

export function VideoPreviewCard({
  thumbnail,
  title,
  channel,
  duration,
  views,
  uploadDate,
  url,
  onDownload,
}: VideoPreviewCardProps) {
  const [selectedQuality, setSelectedQuality] = useState("1080p");
  const [selectedFormat, setSelectedFormat] = useState("mp4");
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [downloadSpeed, setDownloadSpeed] = useState("");
  const [downloadETA, setDownloadETA] = useState("");
  const [fileSize, setFileSize] = useState("");
  const [downloadedSize, setDownloadedSize] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const { toast } = useToast();

  const qualityOptions = [
    { value: "2160p", label: "2160p (4K)", size: "~2.5GB" },
    { value: "1440p", label: "1440p (2K)", size: "~1.8GB" },
    { value: "1080p", label: "1080p (HD)", size: "~800MB" },
    { value: "720p", label: "720p", size: "~400MB" },
    { value: "480p", label: "480p", size: "~200MB" },
    { value: "360p", label: "360p", size: "~100MB" },
  ];

  const formatOptions = [
    { value: "mp4", label: "MP4 (Video)" },
    { value: "webm", label: "WebM (Video)" },
    { value: "mp3", label: "MP3 (Audio Only)" },
    { value: "m4a", label: "M4A (Audio Only)" },
  ];

  // Cleanup EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const startRealTimeDownload = async () => {
    if (isDownloading || isCompleted) return;
    
    try {
      setIsDownloading(true);
      setDownloadProgress(0);
      setError(null);
      setDownloadSpeed("");
      setDownloadETA("");
      setFileSize("");
      setDownloadedSize("");
      
      // Step 1: Start download session
      console.log('Starting download session...');
      const response = await fetch('/api/start-download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: url,
          quality: selectedQuality,
          format: selectedFormat
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start download');
      }
      
      const result = await response.json();
      const currentSessionId = result.sessionId;
      setSessionId(currentSessionId);
      
      console.log(`Download session created: ${currentSessionId}`);
      
      // Step 2: Connect to SSE progress stream
      const eventSource = new EventSource(`/api/download-progress/${currentSessionId}`);
      eventSourceRef.current = eventSource;
      
      eventSource.onopen = () => {
        console.log('SSE connection opened for session:', currentSessionId);
      };
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('SSE progress update:', data);
          
          if (data.type === 'connected' || data.type === 'heartbeat') {
            return; // Ignore system messages
          }
          
          // Update progress UI with real data
          if (data.progress !== undefined) {
            setDownloadProgress(data.progress);
          }
          if (data.speed) {
            setDownloadSpeed(data.speed);
          }
          if (data.eta) {
            setDownloadETA(data.eta);
          }
          if (data.fileSize) {
            setFileSize(data.fileSize);
          }
          if (data.downloadedSize) {
            setDownloadedSize(data.downloadedSize);
          }
          
          // Handle completion
          if (data.status === 'completed') {
            console.log('Download completed!');
            setIsDownloading(false);
            setIsCompleted(true);
            eventSource.close();
            
            // Step 3: Trigger file download
            setTimeout(() => {
              downloadCompletedFile(currentSessionId);
            }, 1000);
          }
          
          // Handle errors
          if (data.status === 'error') {
            console.error('Download error:', data.error);
            setError(data.error || 'Download failed');
            setIsDownloading(false);
            eventSource.close();
            
            toast({
              title: "Download Failed",
              description: data.error || "An error occurred during download",
              variant: "destructive"
            });
          }
          
        } catch (parseError) {
          console.error('Failed to parse SSE message:', parseError);
        }
      };
      
      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        setError('Connection lost');
        setIsDownloading(false);
        eventSource.close();
        
        toast({
          title: "Connection Error",
          description: "Lost connection to download progress. Please try again.",
          variant: "destructive"
        });
      };
      
    } catch (error) {
      console.error('Failed to start download:', error);
      setError(error instanceof Error ? error.message : 'Failed to start download');
      setIsDownloading(false);
      
      toast({
        title: "Download Error",
        description: error instanceof Error ? error.message : "Failed to start download",
        variant: "destructive"
      });
    }
  };
  
  const downloadCompletedFile = async (sessionId: string) => {
    try {
      console.log(`Downloading completed file for session: ${sessionId}`);
      
      const response = await fetch(`/api/download-file/${sessionId}`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to download file');
      }
      
      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get('content-disposition');
      let filename = `video_${selectedQuality}.${selectedFormat}`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/); 
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      // Create download link
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      
      toast({
        title: "Download Complete! 🎉",
        description: `Successfully downloaded: ${filename}`,
      });
      
    } catch (error) {
      console.error('Failed to download completed file:', error);
      toast({
        title: "File Download Error",
        description: error instanceof Error ? error.message : "Failed to download completed file",
        variant: "destructive"
      });
    }
  };

  const getSelectedQualityInfo = () => {
    return qualityOptions.find(q => q.value === selectedQuality);
  };

  return (
    <Card className="max-w-md mx-auto overflow-hidden hover-elevate transition-all duration-300">
      {/* Video Thumbnail */}
      <div className="relative aspect-video bg-muted">
        <img
          src={thumbnail}
          alt={title}
          className="w-full h-full object-cover"
          data-testid="img-video-thumbnail"
        />
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200">
          <Play className="h-12 w-12 text-white" />
        </div>
        <Badge 
          variant="secondary" 
          className="absolute bottom-2 right-2 bg-black/70 text-white border-0"
          data-testid="badge-duration"
        >
          <Clock className="h-3 w-3 mr-1" />
          {duration}
        </Badge>
      </div>

      {/* Video Info */}
      <div className="p-4 space-y-4">
        <div>
          <h3 
            className="font-semibold text-foreground line-clamp-2 mb-2"
            data-testid="text-video-title"
          >
            {title}
          </h3>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span data-testid="text-channel-name">{channel}</span>
            <div className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              <span data-testid="text-view-count">{views}</span>
            </div>
            <span data-testid="text-upload-date">{uploadDate}</span>
          </div>
        </div>

        {/* Quality & Format Selection */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">
                Quality
              </label>
              <Select value={selectedQuality} onValueChange={setSelectedQuality}>
                <SelectTrigger data-testid="select-quality">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {qualityOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex justify-between items-center w-full">
                        <span>{option.label}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {option.size}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">
                Format
              </label>
              <Select value={selectedFormat} onValueChange={setSelectedFormat}>
                <SelectTrigger data-testid="select-format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {formatOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* File Size Info */}
          <div className="text-xs text-muted-foreground">
            Estimated size: <span className="font-medium">{getSelectedQualityInfo()?.size}</span>
          </div>
        </div>

        {/* Enhanced Real-time Download Progress */}
        {(isDownloading || isCompleted || error) && (
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {error ? "Download failed" : isCompleted ? "Download completed" : "Downloading..."}
              </span>
              <span className="font-medium">{Math.round(downloadProgress)}%</span>
            </div>
            <Progress value={downloadProgress} className="h-2" />
            
            {/* Real-time download stats */}
            {(isDownloading || isCompleted) && (
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                {downloadSpeed && (
                  <div className="flex justify-between">
                    <span>Speed:</span>
                    <span className="font-medium">{downloadSpeed}</span>
                  </div>
                )}
                {downloadETA && downloadETA !== 'completed' && downloadETA !== 'failed' && (
                  <div className="flex justify-between">
                    <span>ETA:</span>
                    <span className="font-medium">{downloadETA}</span>
                  </div>
                )}
                {downloadedSize && (
                  <div className="flex justify-between">
                    <span>Downloaded:</span>
                    <span className="font-medium">{downloadedSize}</span>
                  </div>
                )}
                {fileSize && (
                  <div className="flex justify-between">
                    <span>Total Size:</span>
                    <span className="font-medium">{fileSize}</span>
                  </div>
                )}
              </div>
            )}
            
            {/* Error display */}
            {error && (
              <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Download Button */}
        <Button
          onClick={startRealTimeDownload}
          disabled={isDownloading}
          className="w-full bg-primary hover:bg-primary/90"
          data-testid="button-download-video"
        >
          {isCompleted ? (
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Downloaded
            </div>
          ) : isDownloading ? (
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Downloading...
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Download {selectedFormat.toUpperCase()}
            </div>
          )}
        </Button>
      </div>
    </Card>
  );
}