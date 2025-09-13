import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Play, Download, Clock, Eye, CheckCircle } from "lucide-react";

interface VideoPreviewCardProps {
  thumbnail: string;
  title: string;
  channel: string;
  duration: string;
  views: string;
  uploadDate: string;
  onDownload?: (quality: string, format: string) => void;
}

export function VideoPreviewCard({
  thumbnail,
  title,
  channel,
  duration,
  views,
  uploadDate,
  onDownload,
}: VideoPreviewCardProps) {
  const [selectedQuality, setSelectedQuality] = useState("1080p");
  const [selectedFormat, setSelectedFormat] = useState("mp4");
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

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

  const handleDownload = () => {
    if (isDownloading || isCompleted) return;
    
    setIsDownloading(true);
    setDownloadProgress(0);
    
    // Simulate download progress
    const interval = setInterval(() => {
      setDownloadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsDownloading(false);
          setIsCompleted(true);
          console.log(`Download completed: ${selectedQuality} ${selectedFormat}`);
          return 100;
        }
        return prev + Math.random() * 15;
      });
    }, 200);

    onDownload?.(selectedQuality, selectedFormat);
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

        {/* Download Progress */}
        {(isDownloading || isCompleted) && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {isCompleted ? "Download completed" : "Downloading..."}
              </span>
              <span className="font-medium">{Math.round(downloadProgress)}%</span>
            </div>
            <Progress value={downloadProgress} className="h-2" />
          </div>
        )}

        {/* Download Button */}
        <Button
          onClick={handleDownload}
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