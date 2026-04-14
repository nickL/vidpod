# Vidpod Editor

Dynamic ads editor for creators. Place markers for ad interstitials, live preview, and export.

## Stack

TypeScript + Next.js + Tailwind. Drizzle + Neon Postgres. Cloudflare Workers + Stream + R2 for pipelines, HLS.js for playback.

## Getting started

```bash
pnpm install
cp .env.example .env   # fill in the values
pnpm db:migrate
pnpm db:seed           # loads the demo episode, ad library, and media used by the PoC
pnpm dev
```

Uploads, waveform jobs, HLS preview, and MP4 export also require the Cloudflare / worker / transcoder envs in `.env`.

## Ad Library

Browse, upload, and pick ads for a marker.

- Ads upload to Cloudflare Stream. Progress streams back into the dialog.
- Dialog state (`useMarkerDialog`) separates from mutations (`useMarkerWorkflow`).
- Code: `src/editor/ads/` and `src/editor/markers/`.

## Video Player

Plays the episode with ads stitched in as interstitials.

- Playback hook (`usePlayback`) resolves a session on first play (episode + ordered ad breaks), then swaps video sources in place to run each ad inline.
- Playhead time flows out so the timeline stays synced.
- Keyboard (space, skips, jumps) handled at the panel level.
- Code: `src/editor/playback/`.

## Timeline

Place and arrange markers on the episode.

- Markers, playhead, and timeline ruler get positions from `shared.ts`.
- Rapid drag saves are queued through `useMarkerDragSaves` so only one fires at a time.
- Code: `src/editor/timeline/` and `src/editor/markers/use-marker-drag-saves.ts`.

## Extras

Done:
- Video and ad uploads
- Real waveforms
- MP4 render
- HLS output (single quality for now, multi coming)
- Hosted: Next.js on Vercel, Cloudflare Workers + Queues + R2 for pipelines

Up next:
- Transcript pipeline
- Durable pipelines

## Verify

```bash
pnpm lint
pnpm build
pnpm test
```
