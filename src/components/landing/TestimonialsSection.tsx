import { Quote } from 'lucide-react';
import AnimatedSection from '../ui/AnimatedSection';
import Card from '../ui/Card';
import { testimonials } from '../../data/landing';

export default function TestimonialsSection() {
  return (
    <section className="py-24">
      <div className="max-w-7xl mx-auto px-4">
        <AnimatedSection>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-center mb-4">
            Trusted by Video Professionals
          </h2>
          <p className="text-text-secondary text-center text-lg max-w-2xl mx-auto mb-16">
            Hear from editors and studios who ship with confidence.
          </p>
        </AnimatedSection>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((testimonial) => (
            <AnimatedSection key={testimonial.name}>
              <Card className="h-full">
                <div className="flex flex-col gap-5">
                  <Quote className="w-8 h-8 text-accent opacity-40" />

                  <p className="text-text-secondary leading-relaxed italic">
                    &ldquo;{testimonial.quote}&rdquo;
                  </p>

                  <div className="flex items-center gap-3 mt-auto pt-4 border-t border-border">
                    {/* Avatar circle with initials */}
                    <div className="w-10 h-10 rounded-full bg-accent-muted text-accent font-display font-bold text-sm flex items-center justify-center shrink-0">
                      {testimonial.avatar}
                    </div>
                    <div>
                      <p className="font-semibold text-text-primary text-sm">
                        {testimonial.name}
                      </p>
                      <p className="text-text-muted text-xs">
                        {testimonial.role}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}
