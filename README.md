<div align="center">

# 🔍 ProofFrame

**OCR-powered spell checker for burned-in text in videos and images**

[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind](https://img.shields.io/badge/Tailwind-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

[Features](#-features) · [Getting Started](#-getting-started) · [Tech Stack](#️-tech-stack)

</div>

---

## ✨ Features

- **Video & Image OCR** — Extract text from MP4, MOV, WebM videos and static images
- **Frame-by-Frame Analysis** — Scans every frame of video for burned-in text using Tesseract.js
- **Spell Checking** — Detects spelling errors in extracted text with nspell dictionary
- **AI-Powered Analysis** — Optional Hugging Face Transformers integration for advanced text understanding
- **FFmpeg Video Processing** — Client-side video frame extraction with @ffmpeg/ffmpeg
- **PDF Export** — Generate detailed reports of findings with jsPDF
- **Local & Cloud Modes** — Choose between local OCR processing or cloud-based Gemini analysis for videos
- **Rate Limiting** — Built-in scan quota management to control usage
- **Animated UI** — Smooth Framer Motion animations for progress and results
- **Responsive Design** — Tailwind CSS 4 with dark mode support

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/markksantos/proofframe.git

# Navigate to project directory
cd proofframe

# Install dependencies
npm install

# Start development server
npm run dev
```

## 🛠️ Tech Stack

| Category | Technology |
|----------|-----------|
| Frontend | React 19, TypeScript 5.9 |
| Build Tool | Vite 7 |
| Styling | Tailwind CSS 4 |
| Routing | React Router DOM 7 |
| Animations | Framer Motion 12 |
| OCR | Tesseract.js 7 |
| Video Processing | FFmpeg.js (WASM) |
| AI/ML | Hugging Face Transformers 3 |
| Spell Check | nspell 2 |
| PDF Generation | jsPDF 4 |
| Icons | Lucide React |

## 📁 Project Structure

```
proofframe/
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── layout/         # Layout components (Header, Footer, etc.)
│   │   ├── scan/           # Scan-specific components (UploadZone, Results, etc.)
│   │   └── ui/             # Generic UI components (Button, Spinner, etc.)
│   ├── pages/              # Route pages
│   │   ├── Landing.tsx     # Landing page with features
│   │   ├── Scan.tsx        # Main scan interface
│   │   ├── PricingPage.tsx # Pricing tiers
│   │   └── NotFound.tsx    # 404 page
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utility functions and helpers
│   ├── types/              # TypeScript type definitions
│   ├── data/               # Static data and constants
│   ├── assets/             # Images, fonts, etc.
│   ├── App.tsx             # Root component with routing
│   └── main.tsx            # Application entry point
├── public/                 # Static assets
└── package.json
```

## 🎯 How It Works

1. **Upload** — User uploads an image or video file
2. **Extract** — FFmpeg extracts frames from video (or uses image directly)
3. **OCR** — Tesseract.js performs optical character recognition on each frame
4. **Spell Check** — nspell validates extracted text against English dictionary
5. **Report** — Results displayed with flagged errors and frame timestamps
6. **Export** — Generate PDF report of all findings

## 📄 License

MIT License © 2025 Mark Santos
