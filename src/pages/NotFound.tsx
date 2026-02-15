import { FileQuestion, Home, ArrowLeft } from 'lucide-react';
import Button from '../components/ui/Button.tsx';

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-bg-secondary border border-border mb-6">
          <FileQuestion className="w-8 h-8 text-text-muted" />
        </div>
        <h1 className="font-display text-4xl font-bold text-text-primary mb-2">
          404
        </h1>
        <p className="text-text-secondary mb-8">
          This page doesn't exist. It may have been moved or the URL might be incorrect.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="secondary"
            size="md"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </Button>
          <Button variant="primary" size="md" to="/">
            <Home className="w-4 h-4" />
            Home
          </Button>
        </div>
      </div>
    </div>
  );
}
