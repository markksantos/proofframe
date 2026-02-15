import type { Feature, Testimonial } from '../types/index.ts';

export const problems = [
  {
    icon: 'AlertTriangle',
    title: 'Missed Typos in Final Exports',
    description:
      'A single misspelled word in a burned-in lower third can erode client trust overnight. By the time the error surfaces, the video is already published and the damage is done.',
  },
  {
    icon: 'Clock',
    title: 'Manual Frame-by-Frame Review Takes Hours',
    description:
      'Scrubbing through an entire timeline to spot-check every text element is tedious and error-prone. Even the most careful editor will miss something after hours of repetitive review.',
  },
  {
    icon: 'SearchX',
    title: 'No Automated Tool for Burned-In Text Verification',
    description:
      'Subtitle files can be spell-checked, but burned-in titles, name supers, and on-screen graphics have no automated QA pipeline. Until now, there was simply no tool built for this.',
  },
] as const;

export const features: Feature[] = [
  {
    icon: 'ScanLine',
    title: 'OCR-Powered Detection',
    description:
      'Our AI engine reads every frame of your video, extracting burned-in text with sub-pixel accuracy. No subtitle file needed — if it is on screen, ProofFrame will find it.',
  },
  {
    icon: 'Film',
    title: 'Video & Image Support',
    description:
      'Drop in an MP4 timeline export or a single screenshot and get results in seconds. ProofFrame handles both workflows so you can QA at any stage of production.',
  },
  {
    icon: 'BookOpen',
    title: 'Smart Spell Check',
    description:
      'Context-aware spell checking goes beyond basic dictionaries. Add client names, brand terms, and industry jargon to a custom dictionary so real words never get flagged.',
  },
  {
    icon: 'FileText',
    title: 'Instant QA Reports',
    description:
      'Generate a polished PDF report with every detected error, its timecode, and suggested fixes. Share it with clients or attach it to your project archive in one click.',
  },
];

export const steps = [
  {
    step: 1,
    title: 'Upload',
    description:
      'Drag and drop your video file or screenshot into ProofFrame. We accept MP4, MOV, PNG, JPEG, and TIFF — no conversion required.',
  },
  {
    step: 2,
    title: 'Scan',
    description:
      'Our AI extracts every visible word from each frame, then runs it through context-aware spell checking and grammar analysis in seconds.',
  },
  {
    step: 3,
    title: 'Review',
    description:
      'See every error highlighted directly on the frame with suggested fixes. Jump to the exact timecode, approve or dismiss each flag, and export your QA report.',
  },
] as const;

export const testimonials: Testimonial[] = [
  {
    name: 'Sarah Medina',
    role: 'Senior Editor at Clearcut Post',
    quote:
      'We deliver dozens of videos a week and ProofFrame catches things our tired eyes miss on the tenth review pass. It paid for itself the first time it saved us from a client-facing typo.',
    avatar: 'SA',
  },
  {
    name: 'Jordan Akiyama',
    role: 'Freelance Motion Graphics Artist',
    quote:
      'I work solo, so there is no second pair of eyes on my projects. ProofFrame is like having a dedicated QA person on every job. The custom dictionary alone is a game changer for brand work.',
    avatar: 'JO',
  },
  {
    name: 'Priya Okonkwo',
    role: 'Post-Production Supervisor at Reel South Studios',
    quote:
      'Before ProofFrame, our QC process was a spreadsheet and a prayer. Now we run every master through the tool before delivery. Turnaround is faster, and client confidence has never been higher.',
    avatar: 'PR',
  },
];
