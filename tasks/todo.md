# ProofFrame — Implementation Checklist

## Phase 1: Project Scaffolding
- [x] Vite + React-TS scaffold
- [x] Install all deps (tesseract.js, ffmpeg, nspell, jspdf, framer-motion, lucide-react, tailwind v4)
- [x] Configure vite.config.ts (COOP/COEP headers, ffmpeg optimizeDeps exclusion, tailwind plugin)
- [x] Configure netlify.toml
- [x] Set up index.html with Google Fonts
- [x] Create src/index.css with Tailwind v4 @theme
- [x] Create src/types/index.ts
- [x] Set up routing (BrowserRouter, lazy routes)

## Phase 2: Shared Components & Layout
- [x] Layout.tsx
- [x] Navbar.tsx (glassmorphism, mobile hamburger)
- [x] Footer.tsx
- [x] AnimatedSection.tsx
- [x] Button.tsx (polymorphic, variants)
- [x] Card.tsx
- [x] ProgressBar.tsx
- [x] LoadingSpinner.tsx

## Phase 3: Landing Page
- [x] landing.ts + pricing.ts data files
- [x] Landing.tsx page
- [x] HeroSection.tsx
- [x] DemoSection.tsx (interactive scan animation)
- [x] ProblemSection.tsx
- [x] FeaturesSection.tsx
- [x] HowItWorksSection.tsx
- [x] TestimonialsSection.tsx
- [x] PricingPreview.tsx

## Phase 4: Core Engine
- [x] ocr.ts (Tesseract.js v7 singleton)
- [x] video-extractor.ts (FFmpeg WASM)
- [x] spell-checker.ts (nspell + skip rules)
- [x] frame-dedup.ts (Levenshtein)
- [x] custom-dictionary.ts (localStorage CRUD)
- [x] rate-limiter.ts (hourly tracking)
- [x] pdf-report.ts (jsPDF)
- [x] Dictionary files copied to public/dictionaries/

## Phase 5: Scan Page
- [x] useScan.ts hook (orchestrator)
- [x] Scan.tsx page (state machine UI)
- [x] UploadZone.tsx (drag-and-drop)
- [x] ScanProgress.tsx (step indicator)
- [x] ScanResults.tsx (result switcher)
- [x] ImageResultView.tsx (bbox overlays)
- [x] VideoResultView.tsx (timeline strip)
- [x] ErrorSidebar.tsx (error list)
- [x] CustomDictionaryPanel.tsx
- [x] ResultsSummary.tsx

## Phase 6: Pricing Page
- [x] PricingPage.tsx (cards, comparison table, FAQ accordion)

## Phase 7: Verification
- [x] TypeScript compiles clean (npx tsc -b)
- [x] Vite build succeeds (npm run build)
- [x] Dev server starts
- [ ] Manual test: image scan with PNG
- [ ] Manual test: video scan with MP4
- [ ] Manual test: PDF report export
- [ ] Manual test: custom dictionary add/remove
- [ ] Responsive mobile check

## Phase 8: Polish
- [x] Fix Button link variant `w-full` bug (motion.div wrapper now detects w-full)
- [x] Add SharedArrayBuffer check before video scanning
- [x] Add zero-byte file validation in UploadZone
- [x] Add scroll-to-top on route change (ScrollToTop component in App.tsx)
- [x] Add global focus-visible outline styles (index.css)
- [x] Add focus-visible styles to Navbar links
- [x] Add error bbox pulse animation (animate-pulse-error)
- [x] Replace Navbar raw CTA Link with Button component
- [x] Fix DemoSection key prop (use word + position)
- [x] Fix PricingPage comparison table index-based keys
- [x] TypeScript compiles clean after polish
- [x] Vite build succeeds after polish
