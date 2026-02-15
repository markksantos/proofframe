import { RotateCcw, FileDown } from 'lucide-react';
import type { ScanResult } from '../../types/index.ts';
import { generateReport } from '../../lib/pdf-report.ts';
import Button from '../ui/Button.tsx';
import ResultsSummary from './ResultsSummary.tsx';
import ImageResultView from './ImageResultView.tsx';
import VideoResultView from './VideoResultView.tsx';
import CustomDictionaryPanel from './CustomDictionaryPanel.tsx';

interface ScanResultsProps {
  result: ScanResult;
  onReset: () => void;
}

export default function ScanResults({ result, onReset }: ScanResultsProps) {
  return (
    <div className="space-y-6">
      {/* Actions bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" size="md" onClick={onReset}>
          <RotateCcw className="w-4 h-4 mr-2" />
          New Scan
        </Button>
        <Button
          variant="secondary"
          size="md"
          onClick={() => generateReport(result)}
        >
          <FileDown className="w-4 h-4 mr-2" />
          Export PDF Report
        </Button>
      </div>

      {/* Summary stats */}
      <ResultsSummary result={result} />

      {/* Custom dictionary */}
      <CustomDictionaryPanel />

      {/* Result view (image or video) */}
      {result.type === 'image' ? (
        <ImageResultView result={result} />
      ) : (
        <VideoResultView result={result} />
      )}
    </div>
  );
}
