import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { ScanResult, FrameResult, VideoError } from '../../types/index.ts';
import { addCustomWord } from '../../lib/custom-dictionary.ts';
import ErrorSidebar from './ErrorSidebar.tsx';
import VideoErrorSidebar from './VideoErrorSidebar.tsx';

interface VideoResultViewProps {
  result: ScanResult;
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/** Returns color class for timeline thumbnail border based on error severity. */
function getFrameBorderColor(frame: FrameResult): string {
  const videoErrors = frame.videoErrors ?? [];
  if (videoErrors.some((e) => e.severity === 'error')) return 'border-error';
  if (videoErrors.some((e) => e.severity === 'warning')) return 'border-warning';
  if (frame.errors.length > 0) return 'border-error';
  return 'border-border hover:border-border-hover';
}

/** Returns color class for bbox overlay based on video error type. */
function getBboxColor(error: VideoError): string {
  switch (error.type) {
    case 'mismatch':
      return 'border-error bg-error/15 hover:bg-error/25';
    case 'spelling':
      return 'border-error bg-error/15 hover:bg-error/25';
    case 'timing':
      return 'border-yellow-400 bg-yellow-400/15 hover:bg-yellow-400/25';
    default:
      return 'border-warning bg-warning/15 hover:bg-warning/25';
  }
}

export default function VideoResultView({ result }: VideoResultViewProps) {
  const [selectedFrameIndex, setSelectedFrameIndex] = useState(0);
  const [selectedErrorIndex, setSelectedErrorIndex] = useState<
    number | undefined
  >(undefined);
  const [showTranscript, setShowTranscript] = useState(false);
  const previewRef = useRef<HTMLImageElement>(null);
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });

  const selectedFrame: FrameResult | undefined =
    result.frames[selectedFrameIndex];

  const hasVideoErrors =
    result.frames.some((f) => (f.videoErrors ?? []).length > 0);
  const hasTranscript = !!result.transcript?.text;

  // Track preview image dimensions
  useEffect(() => {
    const img = previewRef.current;
    if (!img) return;

    const updateSize = () => {
      setPreviewSize({
        width: img.clientWidth,
        height: img.clientHeight,
      });
    };

    const observer = new ResizeObserver(updateSize);
    observer.observe(img);
    img.addEventListener('load', updateSize);

    return () => {
      observer.disconnect();
      img.removeEventListener('load', updateSize);
    };
  }, [selectedFrameIndex]);

  const handleAddToDictionary = useCallback((word: string) => {
    addCustomWord(word);
  }, []);

  const handleFrameSelect = useCallback((index: number) => {
    setSelectedFrameIndex(index);
    setSelectedErrorIndex(undefined);
  }, []);

  if (result.frames.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-text-secondary">
          No frames with text were detected in this video.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Timeline strip */}
      <div className="w-full overflow-x-auto pb-2">
        <div className="flex gap-3 min-w-max px-1">
          {result.frames.map((frame, index) => {
            const isSelected = index === selectedFrameIndex;
            const errorCount =
              (frame.videoErrors ?? []).length || frame.errors.length;
            const borderColor = isSelected
              ? 'border-accent'
              : getFrameBorderColor(frame);

            return (
              <motion.button
                key={frame.frameIndex}
                onClick={() => handleFrameSelect(index)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`relative shrink-0 rounded-lg overflow-hidden border-2 transition-colors focus:outline-none ${borderColor}`}
              >
                <img
                  src={frame.thumbnailUrl}
                  alt={`Frame ${frame.frameIndex + 1}`}
                  className="w-28 h-16 object-cover"
                />

                {/* Frame number & timestamp overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 py-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-white font-mono">
                      #{frame.frameIndex + 1}
                    </span>
                    <span className="text-[10px] text-white/80 font-mono">
                      {formatTimestamp(frame.timestamp)}
                    </span>
                  </div>
                </div>

                {/* Error count badge */}
                {errorCount > 0 && (
                  <div className="absolute top-1 right-1 bg-error text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {errorCount}
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Selected frame preview + errors */}
      {selectedFrame && (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Frame preview with overlays */}
          <div className="flex-1 min-w-0">
            <div className="relative inline-block w-full">
              <img
                ref={previewRef}
                src={selectedFrame.thumbnailUrl}
                alt={`Frame ${selectedFrame.frameIndex + 1}`}
                className="w-full h-auto rounded-xl border border-border"
              />

              {/* Bounding box overlays for video errors with bbox */}
              {previewSize.width > 0 &&
                hasVideoErrors &&
                (selectedFrame.videoErrors ?? []).map((error, index) => {
                  if (!error.bbox) return null;
                  const img = previewRef.current;
                  if (!img) return null;
                  const naturalW = img.naturalWidth || 1;
                  const naturalH = img.naturalHeight || 1;
                  const scaleX = previewSize.width / naturalW;
                  const scaleY = previewSize.height / naturalH;

                  return (
                    <div
                      key={`ve-${error.type}-${index}`}
                      onClick={() => setSelectedErrorIndex(index)}
                      className={`absolute cursor-pointer border-2 rounded-sm transition-colors ${
                        selectedErrorIndex === index
                          ? 'border-accent bg-accent/20'
                          : getBboxColor(error)
                      }`}
                      style={{
                        left: error.bbox.x0 * scaleX,
                        top: error.bbox.y0 * scaleY,
                        width:
                          (error.bbox.x1 - error.bbox.x0) * scaleX,
                        height:
                          (error.bbox.y1 - error.bbox.y0) * scaleY,
                      }}
                      title={error.message}
                    />
                  );
                })}

              {/* Legacy bounding box overlays for spelling-only errors (image compat) */}
              {previewSize.width > 0 &&
                !hasVideoErrors &&
                selectedFrame.errors.map((error, index) => {
                  const img = previewRef.current;
                  if (!img) return null;
                  const naturalW = img.naturalWidth || 1;
                  const naturalH = img.naturalHeight || 1;
                  const scaleX = previewSize.width / naturalW;
                  const scaleY = previewSize.height / naturalH;

                  return (
                    <div
                      key={`${error.word}-${error.bbox.x0}-${error.bbox.y0}-${index}`}
                      className="absolute cursor-pointer border-2 rounded-sm transition-colors border-error bg-error/15 hover:bg-error/25"
                      style={{
                        left: error.bbox.x0 * scaleX,
                        top: error.bbox.y0 * scaleY,
                        width: (error.bbox.x1 - error.bbox.x0) * scaleX,
                        height: (error.bbox.y1 - error.bbox.y0) * scaleY,
                      }}
                      title={`"${error.word}"`}
                    />
                  );
                })}
            </div>

            <p className="text-text-muted text-xs font-mono mt-2">
              Frame {selectedFrame.frameIndex + 1} &middot;{' '}
              {formatTimestamp(selectedFrame.timestamp)}
            </p>
          </div>

          {/* Error sidebar */}
          <div className="lg:w-80 shrink-0">
            {hasVideoErrors ? (
              <VideoErrorSidebar
                errors={selectedFrame.videoErrors ?? []}
                onAddToDictionary={handleAddToDictionary}
                selectedErrorIndex={selectedErrorIndex}
              />
            ) : (
              <ErrorSidebar
                errors={selectedFrame.errors}
                onAddToDictionary={handleAddToDictionary}
              />
            )}
          </div>
        </div>
      )}

      {/* Collapsible transcript panel */}
      {hasTranscript && (
        <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-bg-tertiary transition-colors"
          >
            <span className="text-text-primary font-medium text-sm">
              Transcript
            </span>
            {showTranscript ? (
              <ChevronUp className="w-4 h-4 text-text-muted" />
            ) : (
              <ChevronDown className="w-4 h-4 text-text-muted" />
            )}
          </button>
          {showTranscript && (
            <div className="px-6 pb-4">
              <p className="text-text-secondary text-sm leading-relaxed whitespace-pre-wrap">
                {result.transcript!.text}
              </p>
              {result.transcript!.language && (
                <p className="text-text-muted text-xs mt-2">
                  Language: {result.transcript!.language}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
