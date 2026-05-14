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

## Phase 9: Video Scan Reliability Fix
- [x] Research Claude/Gemini video analysis options and existing repos
- [x] Inspect current local and Gemini video scan failure modes
- [x] Decide whether to repair Gemini, replace it, or strengthen local analysis
- [x] Implement the smallest reliable video scan fix
- [x] Verify with a synthetic video containing known on-screen text mistakes
- [x] Run TypeScript/build verification
- [x] Document findings and remaining product risks

### Phase 9 Review
- Fixed the primary OCR bug: Tesseract was returning page text but no word-level data because `blocks` output was not requested, leaving spell-checking with an empty word list.
- Improved video sampling from fixed 1 FPS to a bounded adaptive plan, with denser sampling for short clips and a max frame budget for longer videos.
- Removed pre-analysis duplicate frame dropping so one-letter caption changes are not discarded before spell-checking.
- Delayed Whisper initialization until after audio extraction confirms an audio track exists, so silent text-only videos can still be scanned.
- Relaxed spell-check skip rules so longer all-caps title/lower-third text is checked while short acronyms remain ignored.
- Fixed OpenRouter video payload shape from `video_url` to documented `videoUrl`, and preserved cloud suggested corrections in results.
- Verified in Chrome against `/tmp/proofframe-video-mistake.mp4`: scan completed, found 2 spelling issues (`mispelled`, `SALEE`), and showed suggestions.
- `npm run build` passes. `npm run lint` still fails on pre-existing project lint issues in `DemoSection.tsx`, `VideoResultView.tsx`, `Button.tsx`, and `transcriber.ts`.

## Phase 10: User-Raised Video Scan Runtime Errors
- [x] Fix local mode Whisper timestamp failure (`output_attentions=True` error)
- [x] Fix or bypass Gemini/OpenRouter browser `Failed to fetch`
- [x] Verify video scans complete in local mode
- [x] Verify cloud mode error handling or replacement path
- [x] Run build verification
- [x] Document result

### Phase 10 Review
- Local browser video scanning no longer uses Whisper/audio transcription. Browser-side Whisper word timestamps failed on the current model export, and ffmpeg.wasm audio handling could crash with `RuntimeError: memory access out of bounds`.
- Replaced scanner frame extraction with native browser video/canvas capture so MP4s with audio tracks can still be sampled for OCR.
- Kept Gemini/OpenRouter as an attempted cloud pass, but if it fails (`Failed to fetch`, invalid key, provider issue, large upload), the scan automatically falls back to local OCR instead of failing the whole job.
- Verified local mode with `/tmp/proofframe-video-mistake-audio.mp4`: scan completed and found `mispelled` and `SALEE`.
- Verified Gemini mode fallback with a fake OpenRouter key: scan still completed through local fallback and found the same 2 spelling issues.
- `npm run build` passes.

## Phase 11: Image OCR False Positive Reduction
- [x] Suppress low-confidence OCR fragments from decorative/background text
- [x] Preserve high-confidence typo detection for real title text
- [x] Run targeted spell-check verification
- [x] Run build verification
- [x] Document result

### Phase 11 Review
- Added OCR quality filtering before dictionary checks: words below 60% confidence or tiny OCR boxes are ignored.
- This suppresses screenshot false positives like low-confidence `gre` and `py` from blurred bill details.
- Targeted verification still reports high-confidence real typos like `mispelled` and `SALEE`.
- `npm run build` passes.

## Phase 12: Video OCR False Positive Reduction
- [x] Suppress isolated OCR fragments from faces/background texture
- [x] Make Gemini fallback visible in result summary
- [x] Preserve real subtitle/title typo detection
- [x] Run build verification
- [x] Document result

### Phase 12 Review
- Two-letter OCR fragments such as `Ka` are now skipped before spell checking, which removes the face/background texture false positive shown in the screenshot.
- Video spell checking now ignores isolated OCR words unless they are prominent standalone text or have nearby same-line text context.
- If Gemini analysis fails and the app uses local OCR fallback, the result summary now displays a fallback note so the output is not mistaken for Gemini's judgment.
- Targeted verification: `Ka` is skipped, `mispelled` and `SALEE` still report as errors, and `anybody` remains correct.
- `npm run build` passes.

## Phase 13: Real Video Proofing Pipeline
- [x] Add local Node scan backend with upload, polling, and artifact endpoints
- [x] Store scan job files under `.proofframe/jobs/<scanId>/`
- [x] Extract audio and dense timestamped frames with native ffmpeg/ffprobe
- [x] Add normalized transcription provider abstraction for OpenAI, Deepgram, and AssemblyAI
- [x] Build consensus transcript requiring at least 2 successful providers for audio-aware proofing
- [x] OCR frames server-side and group visible text into time-ranged visual segments
- [x] Align visual text segments against consensus transcript windows
- [x] Emit grouped spelling, mismatch, missing caption, timing, and unreadable text issues
- [x] Add server-side AI evidence judge via OpenRouter Gemini
- [x] Update UI from Local/Gemini to Visual-only/Audio-aware proofing
- [x] Show providers, consensus confidence, judge status, degraded status, and evidence in results
- [x] Add unit tests for consensus, visual segment grouping, alignment, and dedupe behavior
- [x] Run build/lint/test verification and document remaining provider limits

### Phase 13 Notes
- The current local path is visual OCR spell-checking only. It does not transcribe audio or compare spoken words to on-screen captions.
- Gemini mode attempts one-shot audio/video reasoning, but it is not a controlled pipeline and can silently fall back to local OCR if unavailable.
- The next fix should make transcript generation and alignment first-class instead of continuing to tune OCR false positives.

### Phase 13 Review
- Implemented a local Node analysis API with upload, polling, delete, health, and artifact endpoints.
- Video scans now use native ffmpeg/ffprobe server-side instead of browser ffmpeg.wasm.
- Added OpenAI, Deepgram, and AssemblyAI transcription provider adapters normalized into one transcript shape.
- Added consensus transcript merging and degraded audio-aware behavior when fewer than two providers succeed.
- Added server OCR, visual text segment grouping, spell checking, transcript alignment, missing caption/timing/mismatch/unreadable issue generation, and optional OpenRouter evidence judging.
- Updated the scan UI to Visual-only scan vs Audio-aware proofing and added completeness/provider/judge/degraded reporting.
- Added unit coverage for consensus merging, text-over-time grouping, mismatch detection, and deduped spelling issues.
- Verified with generated visual-only video: `SALEE TODAY` returns one grouped spelling issue over the visible time range.
- Verified degraded audio-aware behavior with no audio/provider keys: scan completes, reports degraded state, and shows skipped providers.
- `npm test`, `npm run lint`, and `npm run build` pass.
- Remaining limit from this phase was provider setup friction; Phase 14 replaced `.env` provider keys with BYOK OpenRouter.

## Phase 14: BYOK OpenRouter-Only Provider Setup
- [x] Restore OpenRouter API key input in scan settings
- [x] Store the key locally in the user's browser instead of `.env`
- [x] Pass the key to the local backend only for the active scan
- [x] Replace direct OpenAI/Deepgram/AssemblyAI provider keys with three OpenRouter STT models
- [x] Use the same OpenRouter key for optional Gemini evidence judging
- [x] Remove dotenv loading from the local backend startup path
- [x] Verify visual-only scans still work without a key
- [x] Verify audio-aware scans degrade clearly when no key is provided
- [x] Run build, lint, and tests

### Phase 14 Review
- The settings page now has a BYOK OpenRouter field. It stores the key in localStorage and sends it to the local backend during scan submission.
- Audio-aware proofing now runs consensus across OpenRouter STT models: `google/chirp-3`, `openai/gpt-4o-mini-transcribe`, and `openai/whisper-large-v3`.
- The OpenRouter key is also used for the optional Gemini evidence judge.
- Server health now reports BYOK support instead of checking `.env` provider keys.
- Visual-only scans complete without a key.
- Audio-aware scans without a key complete in degraded mode and show all three OpenRouter transcription models as skipped.
- OpenRouter's dedicated transcription endpoint currently returns transcript text, not word timestamps, so v1 approximates word timing across the audio duration for alignment.
- `npm test`, `npm run lint`, and `npm run build` pass.

## Phase 15: Automatic Best-Available Scan UX
- [x] Remove the user-facing Visual-only vs Audio-aware mode selector
- [x] Keep a single optional OpenRouter BYOK field
- [x] Make video scans request the full audio-aware pipeline automatically
- [x] Degrade to visual text checking when no key or no audio is available
- [x] Keep scan completeness/degraded status in results instead of exposing a pre-scan choice
- [x] Run build, lint, tests, and a no-key backend smoke test

### Phase 15 Review
- ProofFrame no longer asks users to choose an analysis mode before scanning.
- Videos automatically request transcript-aware proofing; the backend reports degraded results when the key is missing and still performs visible text proofing.
- The scan settings panel now only asks for the optional OpenRouter API key.
- No-key synthetic video smoke test completed with one visible-text spelling issue and a degraded note.
- `npm test`, `npm run lint`, and `npm run build` pass.

## Phase 16: User-Raised Video Result Bug Fixes
- [x] Reproduce latest uploaded-video result state from `.proofframe/jobs`
- [x] Confirm broken frame previews are caused by the artifact endpoint returning 404 for existing frame files
- [x] Confirm raw OpenRouter billing errors are leaking into result/provider UI
- [x] Confirm fallback visual scan is too loose for `unreadable_text` warnings
- [x] Fix artifact serving for frame and crop previews
- [x] Sanitize OpenRouter transcription errors and show clear degraded notes
- [x] Skip the AI judge when transcript-aware proofing is unavailable
- [x] Tighten unreadable-text detection so low-confidence visual fallback does not invent issues
- [x] Verify artifact URLs, smoke scan behavior, build, lint, and tests
- [x] Document review and lessons

### Phase 16 Review
- Fixed broken frame/crop previews by allowing Express to serve artifact files stored under `.proofframe`. Existing artifact URLs now return JPEGs instead of 404.
- Sanitized OpenRouter transcription failures so billing/auth/rate-limit problems show as plain user-facing degraded states instead of raw JSON error payloads.
- Removed raw provider errors from native UI tooltips and changed failed provider chips to "unavailable" rather than scary red internal failures.
- Skipped the AI evidence judge when transcript-aware proofing is unavailable. This avoids reporting "AI judge: ran" when the scan had no transcript to judge against.
- Tightened `unreadable_text` generation so visual fallback does not turn ordinary low-confidence OCR into false warnings.
- Verified with the user's existing artifact URLs, a generated audio-video smoke scan with an invalid OpenRouter key, browser reload, `npm test`, `npm run lint`, and `npm run build`.

## Phase 17: Caption OCR Partial-Word False Positive Fix
- [x] Inspect latest uploaded-video job and OCR words around the reported `Ame` false positive
- [x] Identify whether spell checking is running on partial subtitle OCR fragments instead of caption-level text
- [x] Patch server-side video spell checking to suppress partial-word caption fragments without hiding real typos
- [x] Keep browser/image spell checking behavior aligned where needed
- [x] Add regression tests for partial-word captions and real typo preservation
- [x] Verify against the latest job/result, smoke scan, build, lint, and tests
- [x] Document review and lessons

### Phase 17 Review
- The latest uploaded-video job showed Tesseract correctly reading `America just` in one frame, then reading only `Ame` in a neighboring blurred/transition frame. ProofFrame treated that one-frame fragment as a real caption word.
- A second false positive, `buat`, had the same shape: a one-frame OCR artifact with surrounding noisy text, not stable on-screen copy.
- Added `shouldSpellCheckVisualSegment()` so video spell checking ignores noisy one-frame fragments unless the OCR result is a clean high-confidence phrase.
- The same rule keeps stable repeated typo text eligible for spell checking, so real video typo detection still works.
- Regression result on the user's uploaded file: `0` issues, no `Ame`, no `buat`.
- Regression result on synthetic typo video: still catches `SALEE`.
- `npm test`, `npm run lint`, and `npm run build` pass.

## Phase 18: Edited Overlay Proofing Boundary
- [x] Inspect latest screen-recording scan errors and OCR layout
- [x] Add line-level visual text segmentation before spelling and transcript alignment
- [x] Suppress embedded screen-recording/UI text from proofing
- [x] Preserve spelling checks for intentional edited overlay/title text
- [x] Limit transcript mismatch checks to caption-like text instead of every edited overlay
- [x] Clean up repeated degraded/provider summary UI
- [x] Add regression tests for background UI text vs edited overlay text
- [x] Verify latest screen-recording video no longer flags UI text
- [x] Run build, lint, tests, and document lessons

### Phase 18 Review
- The latest screen-recording job was producing 82 false issues because ProofFrame grouped whole-frame OCR and compared embedded Airtable/browser text to the transcript.
- Reworked video OCR grouping into line-level visual text segments, with frame-density metadata so the scanner can distinguish dense source-media text from large edited overlay text.
- Updated proofing eligibility so captions, titles, and callouts can still be spell-checked even when they do not match speech, while dense embedded screen-recording UI text is suppressed.
- Changed transcript mismatch/timing checks so they only run for caption-like proofing text; edited titles/callouts are not treated as transcript mismatches by default.
- Simplified the results summary to show one provider/completeness line instead of repeating the same degraded OpenRouter message and listing every failed provider chip.
- Regression replay against `.proofframe/jobs/c8007d0c-3e31-4724-b519-39a92fc7ea65/result.json`: previous result had 82 issues; the new deterministic pass returns 0 issues.
- `npm test`, `npm run lint`, and `npm run build` pass.
