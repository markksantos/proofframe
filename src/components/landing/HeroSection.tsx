import { motion } from 'framer-motion';
import AnimatedSection from '../ui/AnimatedSection';
import Button from '../ui/Button';

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Radial gradient background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-accent-muted blur-[120px] opacity-60" />
      </div>

      <AnimatedSection className="relative z-10 max-w-7xl mx-auto px-4 py-20 flex flex-col items-center text-center">
        <h1 className="font-display text-4xl md:text-6xl font-bold text-text-primary leading-tight max-w-4xl">
          Catch Every Typo Before Your Client Does
        </h1>

        <p className="mt-6 text-text-secondary text-lg max-w-2xl">
          AI-powered QA that scans your videos and images for spelling errors in
          burned-in text. No more frame-by-frame manual review.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-4">
          <Button variant="primary" size="lg" to="/scan">
            Start Scanning Free
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => {
              document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            See How It Works
          </Button>
        </div>

        {/* Animated mockup */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: 'easeOut' }}
          className="mt-16 w-full max-w-lg"
        >
          <div className="relative bg-bg-secondary border border-border rounded-2xl p-8 shadow-2xl">
            {/* Mock frame label */}
            <div className="flex items-center gap-2 mb-6">
              <div className="w-3 h-3 rounded-full bg-error opacity-80" />
              <div className="w-3 h-3 rounded-full bg-warning opacity-80" />
              <div className="w-3 h-3 rounded-full bg-accent opacity-80" />
              <span className="ml-2 text-text-muted text-xs font-mono">
                lower_third_v3.png
              </span>
            </div>

            {/* Mock burned-in text area */}
            <div className="relative bg-bg-tertiary rounded-lg px-6 py-10 flex items-center justify-center">
              <span className="font-display text-2xl md:text-3xl font-bold tracking-wide text-text-primary">
                COMING{' '}
                <span className="relative inline-block">
                  {/* The misspelled word */}
                  <span className="relative z-10">SOOM</span>
                  {/* Red underline */}
                  <motion.span
                    className="absolute left-0 right-0 bottom-0 h-[3px] bg-error rounded-full"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.5, delay: 1.0 }}
                    style={{ originX: 0 }}
                  />
                  {/* Suggestion badge floating above */}
                  <motion.span
                    className="absolute -top-10 left-1/2 -translate-x-1/2 bg-accent text-bg-primary text-sm font-semibold px-3 py-1 rounded-lg whitespace-nowrap shadow-lg"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 1.5 }}
                  >
                    SOON
                    <span className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-accent" />
                  </motion.span>
                </span>
              </span>
            </div>

            {/* Status bar */}
            <motion.div
              className="mt-4 flex items-center gap-2 text-xs text-accent font-mono"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 1.8 }}
            >
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              1 error found
            </motion.div>
          </div>
        </motion.div>
      </AnimatedSection>
    </section>
  );
}
