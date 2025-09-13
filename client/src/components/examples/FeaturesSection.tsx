import { FeaturesSection } from '../FeaturesSection';
import { ThemeProvider } from '../ThemeProvider';

export default function FeaturesSectionExample() {
  return (
    <ThemeProvider>
      <div className="min-h-screen bg-background">
        <FeaturesSection />
      </div>
    </ThemeProvider>
  );
}