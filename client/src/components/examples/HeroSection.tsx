import { HeroSection } from '../HeroSection';
import { ThemeProvider } from '../ThemeProvider';
import { Toaster } from "@/components/ui/toaster";

export default function HeroSectionExample() {
  return (
    <ThemeProvider>
      <div className="min-h-screen bg-background">
        <HeroSection />
        <Toaster />
      </div>
    </ThemeProvider>
  );
}