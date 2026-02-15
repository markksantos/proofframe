import { motion } from 'framer-motion';

interface ProgressBarProps {
  progress: number;
  label?: string;
}

export default function ProgressBar({
  progress,
  label,
}: ProgressBarProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className="w-full">
      {/* Label row */}
      {(label !== undefined) && (
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-text-secondary">{label}</span>
          <span className="text-sm font-mono text-text-secondary">
            {Math.round(clampedProgress)}%
          </span>
        </div>
      )}

      {/* Bar */}
      <div className="w-full h-2 bg-bg-tertiary rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-accent"
          initial={{ width: 0 }}
          animate={{ width: `${clampedProgress}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>

      {/* Percentage below when no label */}
      {label === undefined && (
        <div className="flex justify-end mt-1">
          <span className="text-sm font-mono text-text-secondary">
            {Math.round(clampedProgress)}%
          </span>
        </div>
      )}
    </div>
  );
}
