import type { PricingTier } from '../types/index.ts';

export const pricingTiers: PricingTier[] = [
  {
    name: 'Free',
    price: '$0',
    period: '/month',
    description:
      'Perfect for trying ProofFrame on individual screenshots and quick checks.',
    features: [
      '10 scans per hour',
      'Image files only (PNG, JPEG, TIFF)',
      'Basic spell check',
      'On-screen error highlighting',
      'Community support',
    ],
    cta: 'Get Started',
  },
  {
    name: 'Pro',
    price: '$12',
    period: '/month',
    description:
      'Everything you need to QA full video timelines with confidence.',
    features: [
      'Unlimited scans',
      'Video + image support (MP4, MOV, PNG, JPEG, TIFF)',
      'Custom dictionary for brand terms',
      'Exportable PDF QA reports',
      'Priority processing queue',
      'Timecode-linked error navigation',
    ],
    cta: 'Start Free Trial',
    highlighted: true,
  },
  {
    name: 'Team',
    price: '$29',
    period: '/month',
    description:
      'Collaborative QA for post-production teams and studios.',
    features: [
      'Everything in Pro',
      'Shared team dictionaries',
      'Project-level scan history',
      'API access for pipeline integration',
      'Dedicated account support',
      'SSO and role-based permissions',
    ],
    cta: 'Contact Sales',
  },
];

export const faqItems = [
  {
    question: 'How does the OCR text detection work?',
    answer:
      'ProofFrame uses an AI-powered optical character recognition engine optimized for video frames. It analyzes each frame to detect and extract burned-in text — titles, lower thirds, name supers, and on-screen graphics — then feeds the extracted text through our spell-checking pipeline.',
  },
  {
    question: 'What file formats are supported?',
    answer:
      'ProofFrame accepts MP4 and MOV video files as well as PNG, JPEG, and TIFF image files. You can upload a full timeline export or a single frame screenshot. No file conversion or special encoding is required.',
  },
  {
    question: 'Is my footage kept private?',
    answer:
      'Image proofing runs entirely client-side in your browser — those files are never uploaded. Video proofing sends your file to the analysis server only to extract and OCR frames; the job and all its artifacts are deleted when you finish or start a new scan, and your OpenRouter key is used only for that scan and never stored server-side.',
  },
  {
    question: 'How accurate is the spell checking?',
    answer:
      'Detection accuracy depends on text clarity and resolution, but ProofFrame reliably catches misspellings, doubled words, and inconsistent casing in standard video title cards and lower thirds. You can fine-tune results by adding client-specific terms to your custom dictionary to eliminate false positives.',
  },
  {
    question: 'Can I add custom words and brand names to the dictionary?',
    answer:
      'Yes. Pro and Team plans include a fully editable custom dictionary. Add client names, product terms, technical jargon, or any word you want ProofFrame to treat as correct. Your dictionary syncs across all your scans and can be shared with team members on the Team plan.',
  },
] as const;
