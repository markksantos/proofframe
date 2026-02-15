# ProofFrame — Lessons Learned

## TypeScript Strict Mode Issues
- `verbatimModuleSyntax: true` requires `import type` for all type-only imports
- Tesseract.js v7 `Page` type doesn't have a `words` property — words are nested in `blocks.paragraphs.lines.words`
- `@ffmpeg/ffmpeg` `readFile()` returns `FileData` (Uint8Array with ArrayBufferLike), which TypeScript's strict mode won't accept as `BlobPart`. Fix: `new Uint8Array(frameData as Uint8Array)` creates a new typed array with a proper `ArrayBuffer`
- framer-motion `motion.create(Link)` causes `onAnimationStart` type conflicts between React DOM and framer-motion. Simpler solution: wrap `Link` in `motion.div` instead of creating a motion-wrapped component

## Tailwind v4
- No `tailwind.config.js` — use `@theme` block in CSS
- Colors defined as `--color-*` are used as `bg-*`, `text-*`, `border-*` in classes
- Font families: `--font-*` maps to `font-*` utility

## Subagent Patterns
- Subagents may use `@/types` path aliases that don't exist — always verify imports are relative paths
- Subagents can't run Bash — verify builds in main agent
