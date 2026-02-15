import { useState, useRef, useCallback } from 'react';
import type { DragEvent, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, AlertCircle } from 'lucide-react';
import Button from '../ui/Button.tsx';

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.tiff', '.webp'];
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm'];
const ACCEPTED_EXTENSIONS = [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS];
const ACCEPT_STRING = ACCEPTED_EXTENSIONS.join(',');

const IMAGE_MAX_SIZE = 50 * 1024 * 1024; // 50MB
const VIDEO_MAX_SIZE = 500 * 1024 * 1024; // 500MB

interface UploadZoneProps {
  onFileSelected: (file: File) => void;
}

function getFileExtension(name: string): string {
  return '.' + (name.split('.').pop()?.toLowerCase() ?? '');
}

function isImageFile(name: string): boolean {
  return IMAGE_EXTENSIONS.includes(getFileExtension(name));
}

function isVideoFile(name: string): boolean {
  return VIDEO_EXTENSIONS.includes(getFileExtension(name));
}

function validateFile(file: File): string | null {
  if (file.size === 0) {
    return 'File appears to be empty.';
  }

  const ext = getFileExtension(file.name);

  if (!ACCEPTED_EXTENSIONS.includes(ext)) {
    return `Unsupported file format "${ext}". Accepted: PNG, JPEG, TIFF, WebP, MP4, MOV, WebM.`;
  }

  if (isImageFile(file.name) && file.size > IMAGE_MAX_SIZE) {
    return 'Image file is too large. Maximum size is 50MB.';
  }

  if (isVideoFile(file.name) && file.size > VIDEO_MAX_SIZE) {
    return 'Video file is too large. Maximum size is 500MB.';
  }

  return null;
}

export default function UploadZone({ onFileSelected }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      const error = validateFile(file);
      if (error) {
        setValidationError(error);
        return;
      }
      setValidationError(null);
      onFileSelected(file);
    },
    [onFileSelected]
  );

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
      // Reset input so the same file can be re-selected
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    },
    [handleFile]
  );

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <motion.div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        animate={{
          borderColor: isDragging
            ? 'var(--color-accent)'
            : 'var(--color-border)',
          scale: isDragging ? 1.02 : 1,
        }}
        whileHover={{ borderColor: 'var(--color-border-hover)' }}
        transition={{ duration: 0.2 }}
        className="relative cursor-pointer rounded-2xl border-2 border-dashed border-border bg-bg-secondary p-12 text-center transition-colors"
      >
        {/* Drag overlay */}
        <AnimatePresence>
          {isDragging && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 rounded-2xl bg-accent-muted z-10 flex items-center justify-center"
            >
              <p className="text-accent font-semibold text-lg">
                Drop your file here
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col items-center gap-4">
          <motion.div
            animate={{ y: isDragging ? -4 : 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            <Upload className="w-12 h-12 text-text-muted" />
          </motion.div>

          <div>
            <p className="text-text-primary font-semibold text-lg">
              Drag & drop your file here
            </p>
            <p className="text-text-secondary text-sm mt-1">
              or click to browse
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-2 mt-2">
            {['PNG', 'JPEG', 'TIFF', 'MP4', 'MOV'].map((fmt) => (
              <span
                key={fmt}
                className="px-2 py-0.5 text-xs font-mono rounded bg-bg-tertiary text-text-muted"
              >
                {fmt}
              </span>
            ))}
          </div>

          <p className="text-text-muted text-xs mt-1">
            Images up to 50MB &middot; Videos up to 500MB
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_STRING}
          onChange={handleInputChange}
          className="hidden"
          aria-label="Upload file"
        />
      </motion.div>

      {/* Validation error */}
      <AnimatePresence>
        {validationError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mt-4 flex items-center gap-2 rounded-lg bg-error-muted px-4 py-3 text-error text-sm"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{validationError}</span>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto text-error"
              onClick={(e) => {
                e.stopPropagation();
                setValidationError(null);
              }}
            >
              Dismiss
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
