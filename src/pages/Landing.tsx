import HeroSection from '../components/landing/HeroSection';
import DemoSection from '../components/landing/DemoSection';
import ProblemSection from '../components/landing/ProblemSection';
import FeaturesSection from '../components/landing/FeaturesSection';
import HowItWorksSection from '../components/landing/HowItWorksSection';
import TestimonialsSection from '../components/landing/TestimonialsSection';
import PricingPreview from '../components/landing/PricingPreview';

export default function Landing() {
  return (
    <main>
      <HeroSection />
      <DemoSection />
      <ProblemSection />
      <FeaturesSection />
      <HowItWorksSection />
      <TestimonialsSection />
      <PricingPreview />
    </main>
  );
}
