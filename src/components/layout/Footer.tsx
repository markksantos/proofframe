import { Link } from 'react-router-dom';
import { ScanLine } from 'lucide-react';

const footerLinks = [
  { label: 'Home', to: '/' },
  { label: 'Scan', to: '/scan' },
  { label: 'Pricing', to: '/pricing' },
];

export default function Footer() {
  return (
    <footer className="bg-bg-secondary border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          {/* Left: Logo + tagline */}
          <div className="flex flex-col gap-2">
            <Link to="/" className="flex items-center gap-2">
              <ScanLine className="w-5 h-5 text-accent" />
              <span className="font-display font-bold text-lg text-text-primary">
                ProofFrame
              </span>
            </Link>
            <p className="text-sm text-text-secondary">
              AI-powered QA for video editors
            </p>
          </div>

          {/* Right: Nav links */}
          <div className="flex items-center gap-6">
            {footerLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="mt-8 pt-8 border-t border-border">
          <p className="text-xs text-text-muted text-center">
            &copy; 2025 ProofFrame. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
