import { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, RefreshCw, ScanLine } from 'lucide-react';
import useScan from '../hooks/useScan.ts';
import { getRemaining } from '../lib/rate-limiter.ts';
import { getAnalysisMode } from '../lib/scan-settings.ts';
import type { AnalysisMode } from '../lib/scan-settings.ts';
import AnimatedSection from '../components/ui/AnimatedSection.tsx';
import Button from '../components/ui/Button.tsx';
import UploadZone from '../components/scan/UploadZone.tsx';
import ScanSettings from '../components/scan/ScanSettings.tsx';
import ScanProgress from '../components/scan/ScanProgress.tsx';
import ScanResults from '../components/scan/ScanResults.tsx';

const VIDEO_EXTENSIONS = ['mp4', 'mov', 'webm'];

export default function Scan() {
  const { progress, result, error, startScan, resetScan, cancelScan } =
    useScan();
  const [scanType, setScanType] = useState<'image' | 'video'>('image');
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>(getAnalysisMode);

  const remaining = getRemaining();

  const handleFileSelected = useCallback(
    (file: File) => {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      const type = VIDEO_EXTENSIONS.includes(ext) ? 'video' : 'image';
      setScanType(type);
      // Only use Gemini mode for video; images always use local
      const mode = type === 'video' ? analysisMode : 'local';
      startScan(file, mode);
    },
    [startScan, analysisMode],
  );

  const isProcessing =
    progress.stage === 'loading' ||
    progress.stage === 'extracting' ||
    progress.stage === 'transcribing' ||
    progress.stage === 'scanning' ||
    progress.stage === 'spellchecking' ||
    progress.stage === 'analyzing';

  return (
    <section className="min-h-screen py-16 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Page header */}
        <AnimatedSection className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <ScanLine className="w-8 h-8 text-accent" />
            <h1 className="font-display text-3xl md:text-4xl font-bold text-text-primary">
              Scan Your Media
            </h1>
          </div>
          <p className="text-text-secondary max-w-xl mx-auto">
            Upload an image or video to scan for spelling errors in burned-in
            text. We'll OCR every frame and flag any issues.
          </p>

          {/* Remaining scans indicator */}
          <div className="mt-4">
            <span className="text-text-muted text-xs font-mono">
              {remaining} scan{remaining !== 1 ? 's' : ''} remaining this hour
            </span>
          </div>
        </AnimatedSection>

        {/* Stage-driven content */}
        <AnimatePresence mode="wait">
          {/* Idle: settings + upload zone */}
          {progress.stage === 'idle' && !error && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <ScanSettings onModeChange={setAnalysisMode} />
              <UploadZone onFileSelected={handleFileSelected} />
            </motion.div>
          )}

          {/* Processing stages */}
          {isProcessing && (
            <motion.div
              key="progress"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <ScanProgress
                progress={progress}
                onCancel={cancelScan}
                scanType={scanType}
                analysisMode={scanType === 'video' ? analysisMode : 'local'}
              />
            </motion.div>
          )}

          {/* Complete: results */}
          {progress.stage === 'complete' && result && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <ScanResults result={result} onReset={resetScan} />
            </motion.div>
          )}

          {/* Error state */}
          {progress.stage === 'error' && error && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="max-w-lg mx-auto"
            >
              <div className="bg-error-muted border border-error/30 rounded-2xl p-8 text-center">
                <AlertCircle className="w-12 h-12 text-error mx-auto mb-4" />
                <h2 className="text-text-primary font-semibold text-lg mb-2">
                  Scan Failed
                </h2>
                <p className="text-text-secondary text-sm mb-6">{error}</p>
                <Button variant="primary" size="md" onClick={resetScan}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
