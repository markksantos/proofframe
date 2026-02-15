import { useState, useEffect, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import AnimatedSection from '../ui/AnimatedSection';

interface ErrorBadge {
  word: string;
  suggestion: string;
  left: string;
  top: string;
}

const errors: ErrorBadge[] = [
  { word: 'oevr', suggestion: 'over', left: '62%', top: '45%' },
];

export default function DemoSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: '-100px' });
  const [scanComplete, setScanComplete] = useState(false);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (isInView && !scanning && !scanComplete) {
      setScanning(true);
      const timer = setTimeout(() => {
        setScanning(false);
        setScanComplete(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isInView, scanning, scanComplete]);

  return (
    <section className="py-24">
      <AnimatedSection className="max-w-7xl mx-auto px-4">
        <h2 className="font-display text-3xl md:text-5xl font-bold text-center mb-4">
          See It In Action
        </h2>
        <p className="text-text-secondary text-center text-lg max-w-2xl mx-auto mb-12">
          Watch ProofFrame scan a frame and surface spelling errors in seconds.
        </p>

        <div
          ref={containerRef}
          className="max-w-3xl mx-auto"
        >
          <div className="relative bg-bg-secondary border border-border rounded-2xl overflow-hidden shadow-2xl">
            {/* Mock frame header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-bg-tertiary">
              <div className="w-3 h-3 rounded-full bg-error opacity-80" />
              <div className="w-3 h-3 rounded-full bg-warning opacity-80" />
              <div className="w-3 h-3 rounded-full bg-accent opacity-80" />
              <span className="ml-2 text-text-muted text-xs font-mono">
                Frame 247 &mdash; 00:00:10:03
              </span>
            </div>

            {/* Mock video frame */}
            <div className="relative bg-bg-primary px-8 py-16 md:px-12 md:py-20 overflow-hidden">
              {/* The text content */}
              <p className="font-display text-xl md:text-2xl text-text-primary text-center leading-relaxed select-none">
                The quick brown fox jumps{' '}
                <span className="relative inline-block">
                  <span
                    className={`relative z-10 transition-colors duration-300 ${
                      scanComplete ? 'text-error' : ''
                    }`}
                  >
                    oevr
                  </span>
                  {scanComplete && (
                    <>
                      <motion.span
                        className="absolute left-0 right-0 bottom-0 h-[3px] bg-error rounded-full"
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 0.3 }}
                        style={{ originX: 0 }}
                      />
                    </>
                  )}
                </span>{' '}
                the lazy dog
              </p>

              {/* Scanning line */}
              {scanning && (
                <motion.div
                  className="absolute left-0 right-0 h-[2px] bg-accent shadow-[0_0_12px_2px_rgba(0,191,166,0.5)] z-20"
                  initial={{ top: '0%' }}
                  animate={{ top: '100%' }}
                  transition={{ duration: 2, ease: 'linear' }}
                />
              )}

              {/* Error badges */}
              {scanComplete &&
                errors.map((err) => (
                  <motion.div
                    key={`${err.word}-${err.left}`}
                    className="absolute z-30"
                    style={{ left: err.left, top: err.top }}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, delay: 0.2 }}
                  >
                    <div className="bg-accent text-bg-primary text-xs font-semibold px-2 py-1 rounded-md shadow-lg whitespace-nowrap -translate-x-1/2 -translate-y-full">
                      {err.suggestion}
                      <span className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-accent" />
                    </div>
                  </motion.div>
                ))}
            </div>

            {/* Status bar */}
            <div className="flex items-center gap-3 px-4 py-3 border-t border-border bg-bg-tertiary">
              {scanning && (
                <motion.div
                  className="flex items-center gap-2 text-xs font-mono text-accent"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                  Scanning frame...
                </motion.div>
              )}
              {scanComplete && (
                <motion.div
                  className="flex items-center gap-2 text-xs font-mono text-error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <span className="w-2 h-2 rounded-full bg-error" />
                  1 spelling error detected &mdash; &quot;oevr&quot; &rarr; &quot;over&quot;
                </motion.div>
              )}
              {!scanning && !scanComplete && (
                <div className="flex items-center gap-2 text-xs font-mono text-text-muted">
                  <span className="w-2 h-2 rounded-full bg-text-muted" />
                  Ready to scan
                </div>
              )}
            </div>
          </div>
        </div>
      </AnimatedSection>
    </section>
  );
}
