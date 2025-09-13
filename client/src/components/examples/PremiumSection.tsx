import { PremiumSection } from '../PremiumSection';
import { ThemeProvider } from '../ThemeProvider';

export default function PremiumSectionExample() {
  return (
    <ThemeProvider>
      <div className="min-h-screen bg-background">
        <PremiumSection />
      </div>
    </ThemeProvider>
  );
}