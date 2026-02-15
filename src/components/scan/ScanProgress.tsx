import { motion } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';
import type { ScanProgress as ScanProgressType, ScanStage } from '../../types/index.ts';
import type { AnalysisMode } from '../../lib/scan-settings.ts';
import ProgressBar from '../ui/ProgressBar.tsx';
import Button from '../ui/Button.tsx';

interface ScanProgressProps {
  progress: ScanProgressType;
  onCancel: () => void;
  scanType?: 'image' | 'video';
  analysisMode?: AnalysisMode;
}

interface StepDef {
  stage: ScanStage;
  label: string;
}

const IMAGE_STEPS: StepDef[] = [
  { stage: 'loading', label: 'Loading' },
  { stage: 'scanning', label: 'Scanning' },
  { stage: 'spellchecking', label: 'Spell Checking' },
];

const VIDEO_LOCAL_STEPS: StepDef[] = [
  { stage: 'loading', label: 'Loading' },
  { stage: 'extracting', label: 'Extracting' },
  { stage: 'transcribing', label: 'Transcribing' },
  { stage: 'scanning', label: 'Scanning' },
  { stage: 'analyzing', label: 'Analyzing' },
];

const VIDEO_GEMINI_STEPS: StepDef[] = [
  { stage: 'loading', label: 'Uploading' },
  { stage: 'analyzing', label: 'Analyzing (Gemini)' },
  { stage: 'extracting', label: 'Extracting Frames' },
];

function getStageIndex(stage: ScanStage, steps: StepDef[]): number {
  const idx = steps.findIndex((s) => s.stage === stage);
  return idx >= 0 ? idx : -1;
}

function getSteps(scanType: string, analysisMode: string): StepDef[] {
  if (scanType !== 'video') return IMAGE_STEPS;
  return analysisMode === 'gemini' ? VIDEO_GEMINI_STEPS : VIDEO_LOCAL_STEPS;
}

export default function ScanProgress({
  progress,
  onCancel,
  scanType = 'image',
  analysisMode = 'local',
}: ScanProgressProps) {
  const STEPS = getSteps(scanType, analysisMode);
  const currentIndex = getStageIndex(progress.stage, STEPS);

  const frameProgress =
    progress.totalFrames > 0
      ? Math.round((progress.currentFrame / progress.totalFrames) * 100)
      : 0;

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Scanning animation */}
      <div className="relative mb-8 rounded-xl bg-bg-secondary border border-border overflow-hidden h-32">
        {/* Scanning line effect */}
        <motion.div
          className="absolute left-0 right-0 h-0.5 bg-accent shadow-[0_0_8px_var(--color-accent)]"
          animate={{
            top: ['0%', '100%', '0%'],
          }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        {/* Background grid pattern */}
        <div className="absolute inset-0 opacity-5">
          <div
            className="w-full h-full"
            style={{
              backgroundImage:
                'linear-gradient(var(--color-accent) 1px, transparent 1px), linear-gradient(90deg, var(--color-accent) 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
          />
        </div>
        {/* Centered status message */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.p
            key={progress.message}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-text-secondary text-sm font-mono"
          >
            {progress.message}
          </motion.p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="space-y-3 mb-8">
        {STEPS.map((step, index) => {
          const isComplete = currentIndex > index;
          const isCurrent = currentIndex === index;

          return (
            <motion.div
              key={step.stage}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-center gap-3"
            >
              {/* Step icon */}
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border transition-colors ${
                  isComplete
                    ? 'bg-accent border-accent'
                    : isCurrent
                      ? 'border-accent bg-accent-muted'
                      : 'border-border bg-bg-tertiary'
                }`}
              >
                {isComplete ? (
                  <Check className="w-4 h-4 text-bg-primary" />
                ) : isCurrent ? (
                  <Loader2 className="w-4 h-4 text-accent animate-spin" />
                ) : (
                  <span className="text-xs text-text-muted font-mono">
                    {index + 1}
                  </span>
                )}
              </div>

              {/* Step label */}
              <span
                className={`text-sm font-medium ${
                  isComplete
                    ? 'text-text-secondary'
                    : isCurrent
                      ? 'text-accent'
                      : 'text-text-muted'
                }`}
              >
                {step.label}
              </span>

              {/* Current step indicator line */}
              {isCurrent && (
                <motion.div
                  layoutId="active-step-bar"
                  className="h-0.5 flex-1 bg-accent rounded-full"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.3 }}
                  style={{ originX: 0 }}
                />
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Frame progress bar */}
      {progress.totalFrames > 0 && (
        <div className="mb-6">
          <ProgressBar
            progress={frameProgress}
            label={`Frame ${progress.currentFrame} / ${progress.totalFrames}`}
          />
        </div>
      )}

      {/* Cancel button */}
      <div className="flex justify-center">
        <Button variant="ghost" size="md" onClick={onCancel}>
          Cancel Scan
        </Button>
      </div>
    </div>
  );
}
