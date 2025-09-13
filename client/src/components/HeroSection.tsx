import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, ClipboardType, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import backgroundShapes from "@assets/generated_images/Floating_geometric_background_shapes_2b8086c4.png";

export function HeroSection() {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.includes("youtube.com") || text.includes("youtu.be")) {
        setUrl(text);
        toast({
          title: "URL pasted successfully",
          description: "YouTube URL detected from clipboard",
        });
      } else {
        toast({
          title: "No YouTube URL found",
          description: "Please copy a YouTube URL to your clipboard",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Clipboard access denied",
        description: "Please paste the URL manually",
        variant: "destructive",
      });
    }
  };

  const handleDownload = () => {
    if (!url) {
      toast({
        title: "URL required",
        description: "Please enter a YouTube URL first",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    // Simulate processing
    setTimeout(() => {
      setIsLoading(false);
      console.log("Download initiated for:", url);
      toast({
        title: "Processing started",
        description: "Your video is being prepared for download",
      });
    }, 2000);
  };

  const clearUrl = () => {
    setUrl("");
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 pt-16 md:pt-20 overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/10 to-background">
        <img 
          src={backgroundShapes} 
          alt="" 
          className="absolute inset-0 w-full h-full object-cover opacity-20 animate-pulse"
          style={{ animationDuration: "8s" }}
        />
      </div>

      {/* Floating geometric shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-16 h-16 bg-primary/20 rounded-full animate-bounce" style={{ animationDuration: "3s" }} />
        <div className="absolute top-3/4 right-1/4 w-12 h-12 bg-primary/30 transform rotate-45" style={{ animation: "spin 15s linear infinite" }} />
        <div className="absolute bottom-1/4 left-1/3 w-8 h-8 bg-primary/25 rounded-full animate-ping" style={{ animationDuration: "4s" }} />
      </div>

      {/* Content */}
      <div className="relative z-10 text-center max-w-4xl mx-auto">
        {/* Hero Text */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
            Download YouTube Videos
            <span className="text-primary block">Instantly & Free</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
            Fast, secure, and reliable YouTube video downloader. 
            Support for HD quality, multiple formats, and batch downloads.
          </p>
        </div>

        {/* URL Input Interface */}
        <div className="max-w-2xl mx-auto mb-12">
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-primary to-primary/80 rounded-lg blur opacity-75 group-hover:opacity-100 transition duration-200" />
            <div className="relative bg-background rounded-lg p-2 border border-border/50">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Input
                    type="url"
                    placeholder="ClipboardType YouTube URL here... (e.g., https://youtube.com/watch?v=...)"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="h-12 pr-20 text-base border-0 focus-visible:ring-1 focus-visible:ring-primary bg-muted/50"
                    data-testid="input-youtube-url"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                    {url && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover-elevate"
                        onClick={clearUrl}
                        data-testid="button-clear-url"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover-elevate"
                      onClick={handlePaste}
                      data-testid="button-paste-url"
                    >
                      <ClipboardType className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Button
                  size="lg"
                  onClick={handleDownload}
                  disabled={isLoading}
                  className="h-12 px-8 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                  data-testid="button-download"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Processing...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Download className="h-5 w-5" />
                      Download
                    </div>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Trust Indicators */}
        <div className="flex flex-wrap justify-center items-center gap-8 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 bg-chart-2 rounded-full" />
            <span data-testid="text-downloads-count">50M+ Downloads</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 bg-chart-2 rounded-full" />
            <span data-testid="text-formats-supported">All Formats Supported</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 bg-chart-2 rounded-full" />
            <span data-testid="text-no-registration">No Registration Required</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 bg-chart-2 rounded-full" />
            <span data-testid="text-secure-fast">100% Secure & Fast</span>
          </div>
        </div>
      </div>
    </section>
  );
}