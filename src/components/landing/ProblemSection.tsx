import { AlertTriangle, Clock, SearchX } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import AnimatedSection from '../ui/AnimatedSection';
import Card from '../ui/Card';
import { problems } from '../../data/landing';

const iconMap: Record<string, LucideIcon> = {
  AlertTriangle,
  Clock,
  SearchX,
};

export default function ProblemSection() {
  return (
    <section className="py-24">
      <div className="max-w-7xl mx-auto px-4">
        <AnimatedSection>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-center mb-4">
            The Problems We Solve
          </h2>
          <p className="text-text-secondary text-center text-lg max-w-2xl mx-auto mb-16">
            Video editors face costly QA gaps that no existing tool addresses.
          </p>
        </AnimatedSection>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {problems.map((problem, index) => {
            const Icon = iconMap[problem.icon];
            return (
              <AnimatedSection key={problem.title}>
                <Card className="h-full">
                  <div
                    className="flex flex-col gap-4"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className="w-12 h-12 rounded-xl bg-error-muted flex items-center justify-center">
                      {Icon && <Icon className="w-6 h-6 text-error" />}
                    </div>
                    <h3 className="font-display text-xl font-bold text-text-primary">
                      {problem.title}
                    </h3>
                    <p className="text-text-secondary leading-relaxed">
                      {problem.description}
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
