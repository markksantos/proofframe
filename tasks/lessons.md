# ProofFrame — Lessons Learned

## TypeScript Strict Mode Issues
- `verbatimModuleSyntax: true` requires `import type` for all type-only imports
- Tesseract.js v7 `Page` type doesn't have a `words` property — words are nested in `blocks.paragraphs.lines.words`
- Tesseract.js v7 does not return `blocks` by default. Pass `worker.recognize(image, {}, { text: true, blocks: true })`; otherwise `data.text` can look correct while word-level spell checking receives an empty word list.
- `@ffmpeg/ffmpeg` `readFile()` returns `FileData` (Uint8Array with ArrayBufferLike), which TypeScript's strict mode won't accept as `BlobPart`. Fix: `new Uint8Array(frameData as Uint8Array)` creates a new typed array with a proper `ArrayBuffer`
- framer-motion `motion.create(Link)` causes `onAnimationStart` type conflicts between React DOM and framer-motion. Simpler solution: wrap `Link` in `motion.div` instead of creating a motion-wrapped component

## Video QA Pipeline
- Do not drop near-duplicate video frames before spell checking. One-character caption mistakes are intentionally high-similarity frame changes.
- Initialize Whisper only after audio extraction confirms audio exists; silent title-card videos should still scan through OCR/spell check.
- Prefer bounded adaptive frame sampling over fixed 1 FPS for video QA. Short clips need denser sampling; long clips need a max frame budget.
- OpenRouter video inputs use `videoUrl` with `type: 'video_url'`; `video_url` is not the documented request shape.
- Browser-side Whisper word timestamps can fail when the model export lacks cross attentions. Treat transcript analysis as optional; OCR/spell-check should still complete without audio.
- ffmpeg.wasm can crash on normal MP4s with audio tracks. Prefer native browser video/canvas frame capture for local uploaded-file frame extraction.
- Cloud model calls should not be the single point of failure for scan completion. If OpenRouter/Gemini fails, fall back to local OCR and still return evidence.
- Low-confidence OCR words from decorative/background imagery create noisy spelling false positives. Gate spell-check inputs by OCR confidence and minimum bounding-box size before dictionary lookup.
- Gemini fallback must be visible in the UI. If a user selected Gemini but the app used local OCR fallback, the summary should say that explicitly.
- For video OCR, do not spell-check isolated tiny fragments from faces/background texture. Require line context or prominent standalone text before treating OCR words as caption/title evidence.
- False-positive filtering is not enough to make video proofing useful. The core product needs an audio transcription + timestamp alignment pipeline, then separate checks for transcript mismatch, missing captions, timing, and visual spelling.
- ProofFrame's product goal is editor-grade video proofing, not generic OCR. The system should watch and listen to the video, understand the intended captions/on-screen text, verify timing and wording against speech, and return evidence-backed issues that a video editor can trust.
- For production-grade video proofing, one transcription pass is not enough. Use multiple ASR/model providers, merge them into a confidence-scored consensus transcript, then compare tracked on-screen text segments across time against that transcript. The unit of analysis should be a text segment over a time range, not a single sampled frame.
- For the near-term BYOK product, prefer a single OpenRouter key collected in the settings UI over `.env` provider keys. OpenRouter can handle dedicated transcription and multimodal judging, which reduces setup friction even if word-level timestamps require local approximation.
- Do not make users choose internal analysis modes like "visual-only" vs "audio-aware." ProofFrame should automatically run the best available proofing path based on file type and available key, then clearly report what was checked and whether anything degraded.
- Express `res.sendFile()` treats dot-directories as hidden by default. ProofFrame artifacts live under `.proofframe`, so frame/crop preview responses need `dotfiles: 'allow'` or the UI will show broken images even though the files exist.
- Never expose raw provider failure payloads in result UI or native `title` tooltips. Sanitize OpenRouter errors into user-facing states like invalid key, needs audio credits, or rate limited.
- `unreadable_text` should be a conservative warning. In degraded visual-only fallback, loose low-confidence OCR rules create false issues, so require very low confidence, repeated frames, substantial text length, and a real-sized box.
- Video spell checking should not trust isolated one-frame OCR fragments. Captions during motion/transition can be read as partial words like `Ame` from `America`; require a stable multi-frame segment or a clean high-confidence phrase before checking spelling.
- Do not define video proofing as caption-only. The app must review intentionally edited overlay text such as captions, titles, callouts, and lower thirds even when it does not match speech, while ignoring embedded text inside screen recordings, screenshots, apps, documents, and webpages.

## Verification
- Vitest does not support Jest's `--runInBand` flag in this project. Use `npm test` for the stable test command.

## Tailwind v4
- No `tailwind.config.js` — use `@theme` block in CSS
- Colors defined as `--color-*` are used as `bg-*`, `text-*`, `border-*` in classes
- Font families: `--font-*` maps to `font-*` utility

## Subagent Patterns
- Subagents may use `@/types` path aliases that don't exist — always verify imports are relative paths
- Subagents can't run Bash — verify builds in main agent
