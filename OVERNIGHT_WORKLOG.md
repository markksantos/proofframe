# proofframe — Overnight Worklog

## What it is

ProofFrame is an OCR-powered spell checker / QA tool for **burned-in text in videos and images**, aimed at video editors. Two pipelines:

- **Image proofing** runs entirely in the browser: Tesseract.js OCR + nspell spell-check, with bounding-box error overlays, a custom dictionary, and PDF export.
- **Video proofing** runs through a local Express service: native `ffmpeg`/`ffprobe` extract timestamped frames + audio, server-side Tesseract OCR groups visible text into time-ranged segments, and (with a BYOK OpenRouter key) consensus audio transcription + alignment finds caption mismatches, missing captions, timing issues, plus an optional AI evidence judge to cut false positives.

Stack: React 19, TypeScript 5.9, Vite 7, Tailwind 4, Tesseract.js 7, Express 5, nspell, jsPDF, Framer Motion, Vitest.

## Starting state

Honest starting completeness: **~85%**. The triage hint said 82%; the code was actually in better shape than that for build/lint/test. The project had 20 documented phases of prior work and was functionally complete for both core flows, but:

- There was substantial **uncommitted** work in `server/transcription.ts` (a real fix swapping the nonexistent OpenRouter `/audio/transcriptions` endpoint for `/chat/completions` with `input_audio`), left in the working tree.
- The frontend hardcoded the API base to relative `/api`, which only works in dev via the Vite proxy — **not deployable** as a split frontend/backend.
- Deploy config was `netlify.toml`, against the standing "always Vercel" preference, and there was no honest deploy story for the two-process architecture.
- No production API start script (only `tsx watch`), no `.env.example`, no configurable CORS.
- Dead code from the abandoned browser-side video approach (`transcriber.ts`, `video-extractor.ts`, `text-comparator.ts`) plus three unused heavy deps (`@huggingface/transformers`, `@ffmpeg/ffmpeg`, `@ffmpeg/util`).
- 14 npm audit advisories including a **critical** in jspdf.
- README described a stale architecture (Hugging Face, browser ffmpeg, "Gemini mode") that no longer matches the code.

The build, lint, and tests already passed (the finishTasks claim of "remaining lint errors" was stale — the uncommitted transcription work had already fixed them).

## What I changed, fixed, added, built

**Finished the in-flight transcription fix** (`server/transcription.ts`) — committed the working-tree improvement: transcribe via `/chat/completions` with an `input_audio` content part to real audio-capable models (`google/gemini-2.5-flash`, `google/gemini-2.0-flash-001`, `openai/gpt-audio`), added a `PROOFFRAME_STT_MODELS` override, and a `404 / not a valid model` error normalization.

**Made the frontend deploy-configurable:**
- Added `src/lib/api-base.ts` — resolves the API base from `VITE_PROOFFRAME_API_BASE` (build-time), defaulting to relative `/api` for the dev proxy.
- Refactored `src/lib/server-scan-client.ts` to route all requests through `apiUrl()` and to **rewrite server-relative artifact URLs** (frame thumbnails, crop previews) against the API base so `<img>` previews load in a deployed split setup.

**Hardened the API** (`server/index.ts`) — added a configurable CORS origin allowlist via `PROOFFRAME_CORS_ORIGIN` (permissive in dev, locked-down in production). Verified: allowed origin gets `Access-Control-Allow-Origin`, an unlisted origin does not.

**Build/run scripts** (`package.json`) — added `start:api` (production, `tsx` no-watch) and `typecheck`.

**Deploy migration** — added `vercel.json` (build `npm run build` → `dist`, COOP/COEP headers required by Tesseract/WASM, SPA rewrite) and removed `netlify.toml`.

**Config docs** — added `.env.example` documenting every env var (no secrets; explicitly notes the BYOK key stays client-side).

**Dead code + dep cleanup** — removed `src/lib/transcriber.ts`, `src/lib/video-extractor.ts`, `src/lib/text-comparator.ts` (zero importers; verified), uninstalled `@huggingface/transformers`, `@ffmpeg/ffmpeg`, `@ffmpeg/util`, and cleaned the now-empty `optimizeDeps.exclude` in `vite.config.ts`. (Kept `frame-dedup.ts` — `proofing-utils.ts` still uses `levenshteinSimilarity` from it.)

**Security** — `npm audit fix` cleared all 14 advisories (including the critical jspdf one). `npm audit` now reports **0 vulnerabilities**; build/test/lint still green after the upgrades.

**Docs** — rewrote `README.md` to match the real two-process BYOK architecture, the ffmpeg prerequisite, the script table, the env-var table, and the honest Vercel-frontend + long-running-Node-API deploy story. Logged Phase 21 in `tasks/todo.md` and durable lessons in `tasks/lessons.md`.

## Current state — does it build? does it run? tests?

- **Build:** `npm run build` passes (tsc -b + vite build). `npm run typecheck` passes.
- **Lint:** `npm run lint` clean.
- **Tests:** `npm test` → 10/10 pass (Vitest).
- **Audit:** 0 vulnerabilities.
- **Runs:** Full dev stack boots (web :5173, API :8787); `/api/health` reports `ffmpegAvailable: true`. The production `start:api` script boots cleanly too.

Verified end-to-end in a real browser:
- **Image scan:** uploaded a `SALEE TODAY` PNG → flagged `SALEE` at 89% with suggestions (SALE/SALES/SALEM/SALVE) and a red bbox overlay. No console errors.
- **Video scan:** synthetic `SALEE TODAY` MP4 → native ffmpeg extracted 12 frames, OCR'd, grouped into a time-ranged segment, found 1 spelling issue (0.0s-2.8s), rendered the timeline strip with loading thumbnails, and showed the "degraded" note correctly when no key was supplied.
- **PDF export:** clicked with no JS errors (patched jspdf).
- **Live OpenRouter call:** transcription request against a real key returned HTTP 402 "requires at least $0.50 in balance for audio" for all three audio models — confirms the model IDs are valid and the integration is correct; the code sanitizes this to "needs audio credits" and degrades to visual-only.

## How to run it locally

```bash
cd /Users/markksantos/Developer/proofframe
npm install
cp .env.example .env        # optional; tweak ports / models
npm run dev                 # API on :8787 + web on :5173
```

Open http://localhost:5173, go to **Scan**, drop an image or video. For transcript-aware video proofing, paste a **funded** OpenRouter key into the settings card (optional). `ffmpeg`/`ffprobe` must be on PATH for video scanning (`brew install ffmpeg`). Image scanning works without ffmpeg.

## How to deploy (exact steps, when ready)

Two pieces. **Do not deploy without Mark's go-ahead.**

**1. Frontend → Vercel (static):**
- New Vercel project from the repo; `vercel.json` already sets build (`npm run build`), output (`dist`), the COOP/COEP headers, and the SPA rewrite.
- Set env var `VITE_PROOFFRAME_API_BASE=https://<your-api-host>` so video scans reach the backend.
- If only image proofing is wanted, the frontend alone is fully functional.

**2. Analysis API → a long-running Node host** (Render / Railway / Fly / VPS — anywhere you can install `ffmpeg` and keep a process alive with writable disk):
- Install Node 18+ and `ffmpeg`.
- `npm ci && npm run start:api` (listens on `PROOFFRAME_API_PORT`, default 8787).
- Set `PROOFFRAME_CORS_ORIGIN=https://<your-vercel-frontend-origin>` to lock down CORS.
- The API **cannot** run on Vercel/Netlify serverless (native ffmpeg + persistent disk for job artifacts + long-lived polling jobs).

## NEEDS FROM MARK

- **Funded OpenRouter key for audio-aware testing.** The reused llm-council key works but has no audio balance (OpenRouter charges ≥ ~$0.50/audio request). Visual-only video + image proofing are fully functional without it; transcript-aware proofing (mismatch/missing-caption/timing checks + AI judge) needs a funded key to be exercised end-to-end. This is BYOK by design — real users supply their own funded key.
- **Decision on where the Express backend runs in production** (Render / Railway / Fly / VPS). The frontend is Vercel-ready; the backend needs a long-running Node host with ffmpeg. Pick one before deploying video proofing.
- **Vercel project creation / production deploy** is intentionally not done (deploy is gated on Mark).

## Honest completeness % now and what remains

**~93%.** Both core flows work end-to-end, build/lint/test/audit are all green, the app is deploy-shaped (configurable API base, CORS, prod start script, Vercel config, env docs), dead code and the critical advisory are gone, and the README is accurate.

What remains (all either Mark-gated or polish, none blocking):
- Audio-aware path validated only up to the live 402 (needs a funded OpenRouter key — Mark item).
- Backend host decision + actual deploy (Mark-gated).
- Optional polish: the Scan bundle is ~460KB (Tesseract + jsPDF + framer-motion) — fine for an OCR tool but could be code-split further; no server-side rate limiting (client-side only); video jobs accumulate under `.proofframe/jobs/` with no TTL/cleanup cron (fine for local, worth a sweeper for a hosted backend).

## QA Verification

**Reviewer:** independent QA subagent (claude-sonnet-4-6), 2026-05-31

### Commands run

```
npm run build       # tsc -b + vite build
npm run typecheck   # tsc -b --noEmit
npm run lint        # eslint .
npm test            # vitest run
npm audit           # security check
npx tsx server/index.ts  # boot check (8-second timeout)
```

### Results

| Check | Result |
|---|---|
| `npm run build` | PASS — 2452 modules transformed, clean output to `dist/` |
| `npm run typecheck` | PASS — exits 0, no diagnostics |
| `npm run lint` | PASS — no warnings or errors |
| `npm test` | PASS — 10/10 tests in `tests/proofing-utils.test.ts` |
| `npm audit` | PASS — 0 vulnerabilities |
| Server boot | PASS — `ProofFrame local analysis API running at http://127.0.0.1:8787` |

### Worklog claims vs. reality

All key claims verified accurate:

- `src/lib/transcriber.ts`, `video-extractor.ts`, `text-comparator.ts` confirmed absent from `src/lib/`.
- `src/lib/api-base.ts` present and correct — reads `VITE_PROOFFRAME_API_BASE`, strips trailing slash, exports `apiUrl()`.
- `vercel.json` present with correct COOP/COEP headers and SPA rewrite; `netlify.toml` absent.
- `.env.example` present, contains no secrets (BYOK design confirmed).
- `PROOFFRAME_CORS_ORIGIN` wiring confirmed in `server/index.ts` (line 135-137).
- `start:api` and `typecheck` scripts confirmed in `package.json`.
- `server/transcription.ts` uses `/chat/completions` with `input_audio` content part to the three listed audio-capable models; `PROOFFRAME_STT_MODELS` override implemented.
- Git working tree is clean; 3 overnight commits on `main`, 3 commits ahead of `origin/main` (not pushed — correct per policy).

### No build-breaking issues found

No fixes required. The author's self-report is accurate.

### Remaining non-blocking items (unchanged from author's list)

- Audio transcription path exercisable only with a funded OpenRouter key (BYOK design, Mark-gated).
- Backend production host not selected yet (Render/Railway/Fly/VPS — Mark-gated).
- Vercel project not created / production deploy not performed (Mark-gated).
- Optional: job artifact TTL sweeper for hosted backend; Scan chunk code-splitting.

## Session 2026-06-14 — server-scan privacy cleanup completed

Picked up an in-flight, uncommitted feature in the working tree (server-side
video-job deletion wired into the `useScan` lifecycle + matching FAQ/pricing
privacy copy) and finished it.

**Completed the privacy guarantee.** The new copy promises video jobs are
"deleted when you finish or start a new scan", but the hook only deleted on
`startScan` / `resetScan` / `cancelScan` — navigating *away* from the Scan page
(e.g. clicking Pricing) with a finished video result still on screen left the
uploaded video, frames, crops, and audio lingering server-side. Added a single
unmount `useEffect` in `src/hooks/useScan.ts` that, on unmount, deletes any
lingering server job (`deleteServerScan`), revokes object URLs, and terminates
the in-browser Tesseract worker. `terminateWorker` is null-safe; the DELETE
endpoint is idempotent (204 even for unknown ids), so the fire-and-forget call
is safe.

**Verification:** `npm run typecheck`, `npm run lint`, `npm test` (10/10),
`npm run build` all pass. Booted the API (`/api/health` → `ffmpegAvailable:true`,
DELETE of a nonexistent id → 204). Dogfooded the built bundle in a headless
browser: Scan → Pricing → Scan navigation (which fires the new unmount cleanup)
produces zero console errors, and the Scan page re-mounts and renders correctly.

**Note (regression vs. prior QA):** `npm audit` now reports 4 advisories
(2 high esbuild/vite, 2 critical shell-quote/concurrently) where the
2026-05-31 QA saw 0. These are all newly-disclosed CVEs in **dev-only**
tooling (build + dev-script deps) that do **not** ship in the production
`dist/` bundle. Fixes require breaking majors (vite 8, concurrently 10) and
were left out of scope to keep this a safe finishing pass — flagged here for a
deliberate dependency-bump session.

## Session 2026-06-14 (round 2) — dependency-bump session: 0 vulnerabilities

This is the "deliberate dependency-bump session" the previous note flagged.
Cleared all 4 outstanding security advisories. All are **dev-only** tooling
(none ship in the production `dist/` bundle), but they were blocking a clean
`npm audit` and a senior-reviewer green light for deploy.

**What I bumped (and why it's safe):**
- `vite` `^7.2.4 → ^8.0.16` — clears the 2 high esbuild advisories (vite bundled
  a vulnerable esbuild). Verified the whole toolchain already supports vite 8
  *before* bumping: `vitest@4.1.5` peer = `^6 || ^7 || ^8`,
  `@vitejs/plugin-react@5.2.0` peer includes `^8`, and `@tailwindcss/vite`
  needed `^4.3.1` (4.1.x peer caps at vite 7) so I aligned it + `tailwindcss`
  to `^4.3.1`. The `vite.config.ts` uses only stable APIs (`defineConfig`,
  `plugins`, `build.target`, `server.proxy`, `server.headers`) — no vite-7-only
  surface, so no config migration was needed.
- `concurrently` `^9.2.1 → ^10.0.3` — clears the 2 critical `shell-quote`
  advisories (concurrently depended on a vulnerable `shell-quote`).
  concurrently 10 requires Node `>=22`; local is Node v22.22.3. Only used by the
  `dev` script to run API + web together; not a runtime dep.
- `tsx` (transitively, via `npm audit fix`) — the *last* remaining high esbuild
  advisory was coming from `tsx`'s bundled esbuild; a plain non-`--force`
  `npm audit fix` bumped it. Both esbuild instances are now `0.28.1` (above the
  `0.28.0` advisory ceiling) and deduped.

Restored caret (`^`) ranges on the bumped deps for manifest consistency (the
`npm install -D` had pinned exact versions).

**Verification (all real, all green):**
- `npm audit` → **0 vulnerabilities** (was 4: 2 high, 2 critical).
- `npm run typecheck` → exit 0.
- `npm run lint` → clean.
- `npm test` → 10/10 (Vitest).
- `npm run build` → vite 8.0.16 builds all 2386 modules to `dist/` (and ~8x
  faster: ~0.6s vs the prior ~4.2s).
- Booted the production API (`tsx server/index.ts`, port 8799): `/api/health`
  → `{ok:true, ffmpegAvailable:true, providers:{openrouterByok:true}}`; DELETE
  of an unknown scan id → 204 (idempotent).
- Booted the vite-8 dev server: `/`, `/scan`, `/pricing`, and `/src/main.tsx`
  all serve HTTP 200; COOP/COEP headers (`same-origin` / `require-corp`, needed
  by Tesseract.js WASM) present.
- Real browser dogfood (Playwright) of `/scan` under vite 8: full Scan UI mounts
  (navbar, upload zone, settings, rate-limit indicator "10 scans remaining"),
  **0 console errors, 0 warnings**.

**No source code changed** — this round is `package.json` + `package-lock.json`
(plus this worklog + a lessons entry). The app's behavior is identical; only the
build/dev/test tooling moved to non-vulnerable majors.

**Completeness now: ~94%.** The remaining work is all Mark-gated / product
decisions (unchanged from prior rounds): funded OpenRouter key to exercise the
audio-aware path end-to-end past the live 402; pick the long-running Node host
for the Express API; create the Vercel project and deploy. Optional polish that
remains: a job-artifact TTL sweeper for a hosted backend, server-side rate
limiting (client-side only today), and further Scan-chunk code-splitting.

## Session 2026-06-14 (round 3) — deploy-readiness polish walk

Drove the real app in an isolated headless browser (landing, scan, pricing,
404, mobile) and ran a full image-scan flow end-to-end. The app is already
shippable-quality: clean console (0 errors/warnings on every route), responsive
with no mobile horizontal overflow, working empty/error/validation states,
proper image alt text + focus-visible styles, and a polished, working core scan
flow (upload → OCR → flagged "SALEE" 92% with suggestions + bbox overlay).

Fixed three concrete shippability defects found by walking it (not invented):

1. **Button icon/text spacing was inconsistent.** The `Button` base classes had
   no gap, so icon+label buttons that didn't add `mr-2` rendered the icon flush
   against the text — visible on the 404 page ("←Go Back", icon-touching-"Home")
   and in `ErrorBoundary`. Added `gap-2` to the `Button` component and removed
   the now-redundant `mr-2` workarounds at the 3 call sites that had them
   (`Scan.tsx`, `ScanResults.tsx` ×2) so spacing is uniform app-wide and not
   doubled. Verified the actions-bar buttons keep a single correct gap.

2. **Disabled buttons had no disabled affordance.** The only disabled button in
   the app (the Custom Dictionary "Add" `+`, disabled when the input is empty)
   rendered at full `opacity:1` / accent background / `cursor:default` and still
   ran the hover-scale animation — it looked fully active but did nothing. Added
   `disabled:opacity-40 disabled:cursor-not-allowed` to `Button` and suppressed
   the hover/tap scale when disabled. Verified on the production build: empty
   input → `opacity 0.4` + `cursor:not-allowed`; typing a word re-enables it.

3. **Disclosure toggles missing `aria-expanded`.** The Pricing FAQ accordion and
   the Custom Dictionary collapse header are disclosure widgets but didn't
   expose open/closed state to assistive tech. Added `aria-expanded` to both
   (and the missing `type="button"` to the dictionary toggle). Verified both go
   `false → true` on click in a real browser.

**Verification (all real, all green):** `npm run typecheck` (exit 0),
`npm run lint` (clean), `npm test` (10/10), `npm run build` (vite 8, all
modules → `dist/`; the `disabled:*` utilities are present in the compiled CSS).
Walked the production preview build (`vite preview`) in an isolated headless
browser: image scan works end-to-end, disabled-button + `aria-expanded` fixes
confirmed live, 0 console errors/warnings on `/`, `/scan`, `/pricing`, `/404`,
and no mobile horizontal overflow at 375px.

5 source files touched, no behavior regressions. Everything still remaining is
the same Mark-gated set above (funded OpenRouter key, backend host choice,
Vercel deploy).
