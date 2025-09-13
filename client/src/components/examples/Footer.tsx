import { Footer } from '../Footer';
import { ThemeProvider } from '../ThemeProvider';

export default function FooterExample() {
  return (
    <ThemeProvider>
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex-1 p-8">
          <p className="text-muted-foreground">Footer component with links and trust indicators</p>
        </div>
        <Footer />
      </div>
    </ThemeProvider>
  );
}