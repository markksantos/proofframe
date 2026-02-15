import { Check } from 'lucide-react';
import AnimatedSection from '../ui/AnimatedSection';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { pricingTiers } from '../../data/pricing';

export default function PricingPreview() {
  return (
    <section className="py-24">
      <div className="max-w-7xl mx-auto px-4">
        <AnimatedSection>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-center mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-text-secondary text-center text-lg max-w-2xl mx-auto mb-16">
            Choose the plan that fits your workflow. Upgrade or downgrade anytime.
          </p>
        </AnimatedSection>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {pricingTiers.map((tier) => (
            <AnimatedSection key={tier.name}>
              <Card
                className={`h-full relative ${
                  tier.highlighted
                    ? 'border-accent md:scale-105 md:shadow-2xl md:shadow-accent/10'
                    : ''
                }`}
              >
                {/* Most Popular badge */}
                {tier.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-bg-primary text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                    Most Popular
                  </div>
                )}

                <div className="flex flex-col gap-5 h-full">
                  {/* Tier name */}
                  <h3 className="font-display text-xl font-bold text-text-primary">
                    {tier.name}
                  </h3>

                  {/* Price */}
                  <div className="flex items-baseline gap-1">
                    <span className="font-display text-4xl font-bold text-text-primary">
                      {tier.price}
                    </span>
                    <span className="text-text-muted text-sm">
                      {tier.period}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-text-secondary text-sm leading-relaxed">
                    {tier.description}
                  </p>

                  {/* Feature list */}
                  <ul className="flex flex-col gap-3 flex-1">
                    {tier.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2 text-sm"
                      >
                        <Check className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                        <span className="text-text-secondary">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA button */}
                  <Button
                    variant={tier.highlighted ? 'primary' : 'secondary'}
                    size="lg"
                    to={tier.name === 'Team' ? '/pricing' : '/scan'}
                    className="w-full mt-auto"
                  >
                    {tier.cta}
                  </Button>
                </div>
              </Card>
            </AnimatedSection>
          ))}
        </div>

        <AnimatedSection>
          <p className="text-text-muted text-center text-sm mt-10">
            Start for free. No credit card required.
          </p>
          <div className="text-center mt-4">
            <Button variant="ghost" to="/pricing">
              Compare all plan details &rarr;
            </Button>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
