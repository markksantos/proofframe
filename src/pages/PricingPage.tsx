import { useState } from 'react';
import { Check, ChevronDown, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { pricingTiers, faqItems } from '../data/pricing.ts';
import AnimatedSection from '../components/ui/AnimatedSection.tsx';
import Button from '../components/ui/Button.tsx';
import Card from '../components/ui/Card.tsx';

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-border">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left"
      >
        <span className="text-text-primary font-medium pr-4">{question}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0"
        >
          <ChevronDown className="w-5 h-5 text-text-muted" />
        </motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="pb-5 text-text-secondary leading-relaxed">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <AnimatedSection>
        <div className="pt-20 pb-12 text-center max-w-3xl mx-auto px-4">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-text-primary mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-text-secondary text-lg">
            Start for free. Upgrade when you need more power. No hidden fees, no surprises.
          </p>
        </div>
      </AnimatedSection>

      {/* Pricing Cards */}
      <AnimatedSection>
        <div className="max-w-7xl mx-auto px-4 pb-20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
            {pricingTiers.map((tier) => (
              <Card
                key={tier.name}
                className={`relative flex flex-col ${
                  tier.highlighted
                    ? 'border-accent md:scale-105 md:-my-4'
                    : ''
                }`}
              >
                {tier.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-bg-primary text-xs font-bold px-3 py-1 rounded-full">
                    Most Popular
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="font-display text-xl font-bold text-text-primary mb-2">
                    {tier.name}
                  </h3>
                  <p className="text-text-secondary text-sm mb-4">
                    {tier.description}
                  </p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-text-primary">
                      {tier.price}
                    </span>
                    <span className="text-text-muted text-sm">
                      {tier.period}
                    </span>
                  </div>
                </div>

                <ul className="flex-1 space-y-3 mb-8">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                      <span className="text-text-secondary text-sm">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <Button
                  variant={tier.highlighted ? 'primary' : 'secondary'}
                  size="lg"
                  to="/scan"
                  className="w-full text-center"
                >
                  {tier.cta}
                </Button>
              </Card>
            ))}
          </div>
        </div>
      </AnimatedSection>

      {/* Feature Comparison */}
      <AnimatedSection>
        <div className="max-w-4xl mx-auto px-4 pb-20">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-text-primary text-center mb-12">
            Compare Plans
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-text-muted font-normal py-3 pr-4">
                    Feature
                  </th>
                  {pricingTiers.map((tier) => (
                    <th
                      key={tier.name}
                      className={`text-center font-semibold py-3 px-4 ${
                        tier.highlighted ? 'text-accent' : 'text-text-primary'
                      }`}
                    >
                      {tier.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: 'Image scanning', free: true, pro: true, team: true },
                  { feature: 'Video scanning', free: false, pro: true, team: true },
                  { feature: 'Scans per hour', free: '10', pro: 'Unlimited', team: 'Unlimited' },
                  { feature: 'Custom dictionary', free: false, pro: true, team: true },
                  { feature: 'PDF reports', free: false, pro: true, team: true },
                  { feature: 'Team sharing', free: false, pro: false, team: true },
                  { feature: 'API access', free: false, pro: false, team: true },
                  { feature: 'Priority support', free: false, pro: false, team: true },
                ].map((row) => (
                  <tr key={row.feature} className="border-b border-border">
                    <td className="text-text-secondary py-3 pr-4">{row.feature}</td>
                    {[row.free, row.pro, row.team].map((val, colIdx) => (
                      <td key={`${row.feature}-${colIdx}`} className="text-center py-3 px-4">
                        {typeof val === 'boolean' ? (
                          val ? (
                            <Check className="w-4 h-4 text-accent mx-auto" />
                          ) : (
                            <span className="text-text-muted">—</span>
                          )
                        ) : (
                          <span className={colIdx === 1 ? 'text-accent font-medium' : 'text-text-secondary'}>
                            {val}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </AnimatedSection>

      {/* FAQ */}
      <AnimatedSection>
        <div className="max-w-3xl mx-auto px-4 pb-20">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-text-primary text-center mb-12">
            Frequently Asked Questions
          </h2>
          <div>
            {faqItems.map((item) => (
              <FAQItem key={item.question} question={item.question} answer={item.answer} />
            ))}
          </div>
        </div>
      </AnimatedSection>

      {/* Trust / CTA */}
      <AnimatedSection>
        <div className="max-w-3xl mx-auto px-4 pb-24 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-accent" />
            <span className="text-text-secondary text-sm">
              All processing happens in your browser. Your files never leave your machine.
            </span>
          </div>
          <Button variant="primary" size="lg" to="/scan">
            Start Scanning Free
          </Button>
        </div>
      </AnimatedSection>
    </div>
  );
}
