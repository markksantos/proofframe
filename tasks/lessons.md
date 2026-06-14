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

## Deployment Architecture
- ProofFrame is a two-process app. The web frontend (and the entire image-scan pipeline) is static and runs anywhere; the video proofing API is a long-running Express service that needs native ffmpeg/ffprobe, persistent disk for job artifacts, and long-lived polling jobs. It CANNOT run on Vercel/Netlify serverless. Deploy the frontend to Vercel and the API to a long-running Node host (Render/Railway/Fly/VPS).
- Do not hardcode the frontend's API base to relative `/api`. That only works in dev via the Vite proxy. Use `VITE_PROOFFRAME_API_BASE` (build-time) so a deployed static frontend can reach a backend on a different origin, and rewrite server-relative artifact URLs (`/api/scans/.../artifacts/...`) against that base in the client so `<img>` previews load.
- OpenRouter has no dedicated `/audio/transcriptions` REST endpoint. Transcribe audio via the standard `/chat/completions` endpoint with an `input_audio` content part to an audio-capable multimodal model (e.g. `google/gemini-2.5-flash`, `openai/gpt-audio`). OpenRouter audio requests require a funded balance (≥ ~$0.50) and 402 otherwise — sanitize that to "needs audio credits" and degrade to visual-only.

## OpenRouter / BYOK
- Audio-aware proofing needs a FUNDED OpenRouter key. A zero/low-balance key returns HTTP 402 on audio models even though the model IDs are valid. Surface this as a clear degraded note, never a raw payload.

## Dependency Hygiene
- The browser-side video approach (Phases 9-12: `transcriber.ts`/@huggingface/transformers, `video-extractor.ts`/@ffmpeg, `text-comparator.ts`) was abandoned in Phase 13 for the server pipeline but the files and heavy deps lingered. Periodically grep for zero-importer lib modules and drop them plus their deps. `frame-dedup.ts` looks dead but `proofing-utils.ts` still uses `levenshteinSimilarity` from it — keep it.
- The vite-7→8 + concurrently-9→10 audit advisories are **dev-only** (esbuild via vite/tsx, shell-quote via concurrently) and never reach `dist/`. They were resolvable without `--force`: before bumping vite to 8, confirm the whole vite-peer chain supports it — `vitest@4.1.5` already does, `@vitejs/plugin-react@5.2.0` already does, but `@tailwindcss/vite@4.1.x` caps at vite 7, so you must also bump `@tailwindcss/vite`/`tailwindcss` to `^4.3.1` (its peer adds `|| ^8`). The minimal `vite.config.ts` here uses only stable APIs, so vite 8 needs no config migration. concurrently 10 requires Node `>=22`. After the explicit bumps, a plain `npm audit fix` (no `--force`) cleared the last esbuild advisory that came in via `tsx`. Result: 0 vulnerabilities, build ~8x faster (rolldown-vite). Note `npm install -D <pkg>@^x` pins an exact version in `package.json` — re-add the `^` to keep caret ranges consistent.

## Verification
- Vitest does not support Jest's `--runInBand` flag in this project. Use `npm test` for the stable test command.
- When polling the scan API from a shell loop, the progress `message` can contain control characters that break naive JSON parsing in `python3 -m json.tool`. Read `.proofframe/jobs/<id>/result.json` directly or use a Node script instead.

## Tailwind v4
- No `tailwind.config.js` — use `@theme` block in CSS
- Colors defined as `--color-*` are used as `bg-*`, `text-*`, `border-*` in classes
- Font families: `--font-*` maps to `font-*` utility

## Subagent Patterns
- Subagents may use `@/types` path aliases that don't exist — always verify imports are relative paths
- Subagents can't run Bash — verify builds in main agent
