import { ScanLine, Film, BookOpen, FileText } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import AnimatedSection from '../ui/AnimatedSection';
import Card from '../ui/Card';
import { features } from '../../data/landing';

const iconMap: Record<string, LucideIcon> = {
  ScanLine,
  Film,
  BookOpen,
  FileText,
};

export default function FeaturesSection() {
  return (
    <section className="py-24">
      <div className="max-w-7xl mx-auto px-4">
        <AnimatedSection>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-center mb-4">
            Everything You Need to QA Like a Pro
          </h2>
          <p className="text-text-secondary text-center text-lg max-w-2xl mx-auto mb-16">
            A purpose-built toolkit for catching burned-in text errors at every
            stage of post-production.
          </p>
        </AnimatedSection>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature) => {
            const Icon = iconMap[feature.icon];
            return (
              <AnimatedSection key={feature.title}>
                <Card className="h-full">
                  <div className="flex flex-col gap-4">
                    <div className="w-12 h-12 rounded-xl bg-accent-muted flex items-center justify-center">
                      {Icon && <Icon className="w-6 h-6 text-accent" />}
                    </div>
                    <h3 className="font-display text-lg font-bold text-text-primary">
                      {feature.title}
                    </h3>
                    <p className="text-text-secondary leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </Card>
              </AnimatedSection>
            );
          })}
        </div>
      </div>
    </section>
  );
}
