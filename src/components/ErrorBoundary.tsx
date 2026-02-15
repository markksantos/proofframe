import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-error-muted mb-6">
            <AlertTriangle className="w-8 h-8 text-error" />
          </div>
          <h1 className="font-display text-2xl font-bold text-text-primary mb-3">
            Something went wrong
          </h1>
          <p className="text-text-secondary mb-6">
            An unexpected error occurred. Try refreshing the page or going back to the home page.
          </p>
          {this.state.error && (
            <p className="text-text-muted text-xs font-mono bg-bg-secondary border border-border rounded-lg p-3 mb-6 break-all">
              {this.state.error.message}
            </p>
          )}
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-bg-secondary border border-border text-text-primary text-sm font-medium hover:border-border-hover transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Refresh
            </button>
            <Link
              to="/"
              onClick={() => this.setState({ hasError: false, error: null })}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-bg-primary text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Home className="w-4 h-4" />
              Home
            </Link>
          </div>
        </div>
      </div>
    );
  }
}
