import { Card, CardContent } from "@/components/ui/card";
import { Download, Zap, Shield, Video, Music, Users, Clock, Globe } from "lucide-react";

const features = [
  {
    icon: Download,
    title: "Multiple Formats",
    description: "Download videos in MP4, WebM, or extract audio in MP3, AAC formats with various quality options."
  },
  {
    icon: Zap,
    title: "Lightning Fast",
    description: "Advanced processing servers ensure your downloads complete in seconds, not minutes."
  },
  {
    icon: Shield,
    title: "100% Secure",
    description: "No malware, no viruses. Your privacy is protected with SSL encryption and no data storage."
  },
  {
    icon: Video,
    title: "HD Quality",
    description: "Download videos up to 4K resolution maintaining original quality and clarity."
  },
  {
    icon: Music,
    title: "Audio Extraction",
    description: "Extract high-quality audio from videos in multiple formats for your music library."
  },
  {
    icon: Users,
    title: "No Registration",
    description: "Start downloading immediately without creating accounts or providing personal information."
  },
  {
    icon: Clock,
    title: "Batch Downloads",
    description: "Download multiple videos simultaneously with our premium batch processing feature."
  },
  {
    icon: Globe,
    title: "Mobile Friendly",
    description: "Access from any device - desktop, tablet, or mobile. Responsive design for all screens."
  }
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 bg-muted/30">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Why Choose YTDownloader Pro?
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Powerful features designed to give you the best YouTube downloading experience
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => {
            const IconComponent = feature.icon;
            return (
              <Card 
                key={index} 
                className="hover-elevate transition-all duration-300 border/50"
                data-testid={`card-feature-${index}`}
              >
                <CardContent className="p-6 text-center">
                  <div className="mb-4 inline-flex items-center justify-center w-12 h-12 bg-primary/10 rounded-lg">
                    <IconComponent className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2" data-testid={`text-feature-title-${index}`}>
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed" data-testid={`text-feature-description-${index}`}>
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Stats Section */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <div className="text-2xl md:text-3xl font-bold text-primary mb-1" data-testid="text-stat-downloads">
              50M+
            </div>
            <div className="text-sm text-muted-foreground">Downloads</div>
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-bold text-primary mb-1" data-testid="text-stat-users">
              2M+
            </div>
            <div className="text-sm text-muted-foreground">Happy Users</div>
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-bold text-primary mb-1" data-testid="text-stat-formats">
              15+
            </div>
            <div className="text-sm text-muted-foreground">Formats</div>
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-bold text-primary mb-1" data-testid="text-stat-uptime">
              99.9%
            </div>
            <div className="text-sm text-muted-foreground">Uptime</div>
          </div>
        </div>
      </div>
    </section>
  );
}