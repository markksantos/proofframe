import { useState, useRef, useEffect, useCallback } from 'react';
import type { ScanResult, SpellingError } from '../../types/index.ts';
import { addCustomWord } from '../../lib/custom-dictionary.ts';
import ErrorSidebar from './ErrorSidebar.tsx';

interface ImageResultViewProps {
  result: ScanResult;
}

export default function ImageResultView({ result }: ImageResultViewProps) {
  const frame = result.frames[0];
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
  const [selectedError, setSelectedError] = useState<SpellingError | undefined>(
    undefined
  );

  // Track displayed image dimensions via ResizeObserver
  useEffect(() => {
    const img = imageRef.current;
    if (!img) return;

    const updateSize = () => {
      setDisplaySize({
        width: img.clientWidth,
        height: img.clientHeight,
      });
    };

    const observer = new ResizeObserver(updateSize);
    observer.observe(img);

    // Also update on load
    img.addEventListener('load', updateSize);

    return () => {
      observer.disconnect();
      img.removeEventListener('load', updateSize);
    };
  }, []);

  const handleAddToDictionary = useCallback((word: string) => {
    addCustomWord(word);
  }, []);

  const handleBboxClick = useCallback((error: SpellingError) => {
    setSelectedError(error);
  }, []);

  if (!frame) return null;

  const errors = frame.errors;
  const originalWidth = result.imageWidth ?? 1;
  const originalHeight = result.imageHeight ?? 1;
  const scaleX = displaySize.width / originalWidth;
  const scaleY = displaySize.height / originalHeight;

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Image with overlays */}
      <div className="flex-1 min-w-0" ref={containerRef}>
        <div className="relative inline-block w-full">
          <img
            ref={imageRef}
            src={result.imageUrl}
            alt={result.fileName}
            className="w-full h-auto rounded-xl border border-border"
          />

          {/* Error bounding box overlays */}
          {displaySize.width > 0 &&
            errors.map((error, index) => {
              const isSelected =
                selectedError &&
                selectedError.word === error.word &&
                selectedError.bbox.x0 === error.bbox.x0 &&
                selectedError.bbox.y0 === error.bbox.y0;

              return (
                <div
                  key={`${error.word}-${error.bbox.x0}-${error.bbox.y0}-${index}`}
                  onClick={() => handleBboxClick(error)}
                  className={`absolute cursor-pointer border-2 rounded-sm transition-colors ${
                    isSelected
                      ? 'border-accent bg-accent/20'
                      : 'border-error bg-error/15 hover:bg-error/25 animate-pulse-error'
                  }`}
                  style={{
                    left: error.bbox.x0 * scaleX,
                    top: error.bbox.y0 * scaleY,
                    width: (error.bbox.x1 - error.bbox.x0) * scaleX,
                    height: (error.bbox.y1 - error.bbox.y0) * scaleY,
                  }}
                  title={`"${error.word}" - Click to highlight`}
                />
              );
            })}
        </div>
      </div>

      {/* Error sidebar */}
      <div className="lg:w-80 shrink-0">
        <ErrorSidebar
          errors={errors}
          onAddToDictionary={handleAddToDictionary}
          selectedError={selectedError}
        />
      </div>
    </div>
  );
}
