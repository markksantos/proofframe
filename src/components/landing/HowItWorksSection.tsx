import AnimatedSection from '../ui/AnimatedSection';
import { steps } from '../../data/landing';

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-24">
      <div className="max-w-7xl mx-auto px-4">
        <AnimatedSection>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-center mb-4">
            How It Works
          </h2>
          <p className="text-text-secondary text-center text-lg max-w-2xl mx-auto mb-16">
            Three simple steps from upload to error-free delivery.
          </p>
        </AnimatedSection>

        <AnimatedSection>
          <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-12 md:gap-0">
            {/* Connecting line - horizontal on desktop, vertical on mobile */}
            <div className="hidden md:block absolute top-1/2 left-[15%] right-[15%] h-px border-t-2 border-dashed border-border -translate-y-1/2 z-0" />
            <div className="md:hidden absolute top-0 bottom-0 left-6 w-px border-l-2 border-dashed border-border z-0" />

            {steps.map((step) => (
              <div
                key={step.step}
                className="relative z-10 flex flex-row md:flex-col items-center md:items-center gap-4 md:gap-3 flex-1 md:text-center pl-12 md:pl-0"
              >
                {/* Number badge */}
                <div className="absolute left-0 md:relative md:left-auto w-12 h-12 rounded-full bg-accent text-bg-primary font-display text-lg font-bold flex items-center justify-center shrink-0 shadow-lg shadow-accent/20">
                  {step.step}
                </div>

                <div className="flex flex-col gap-1 md:items-center">
                  <h3 className="font-display text-xl font-bold text-text-primary">
                    {step.title}
                  </h3>
                  <p className="text-text-secondary leading-relaxed max-w-xs">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
