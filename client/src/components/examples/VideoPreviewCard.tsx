import { VideoPreviewCard } from '../VideoPreviewCard';
import { ThemeProvider } from '../ThemeProvider';

export default function VideoPreviewCardExample() {
  const handleDownload = (quality: string, format: string) => {
    console.log(`Download requested: ${quality} ${format}`);
  };

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-background p-8">
        <VideoPreviewCard
          thumbnail="https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg"
          title="Rick Astley - Never Gonna Give You Up (Official Video)"
          channel="Rick Astley"
          duration="3:33"
          views="1.4B views"
          uploadDate="Oct 25, 2009"
          onDownload={handleDownload}
        />
      </div>
    </ThemeProvider>
  );
}