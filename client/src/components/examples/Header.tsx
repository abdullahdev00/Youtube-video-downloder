import { Header } from '../Header';
import { ThemeProvider } from '../ThemeProvider';

export default function HeaderExample() {
  return (
    <ThemeProvider>
      <div className="min-h-screen bg-background">
        <Header />
        <div className="pt-20 p-8">
          <p className="text-muted-foreground">Header component with theme toggle and mobile menu</p>
        </div>
      </div>
    </ThemeProvider>
  );
}