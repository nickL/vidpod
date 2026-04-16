# Vidpod Editor

Dynamic ads editor for creators. Place markers for ad interstitials, live preview, and export.

**Live demo:** https://vidpod.nlewis.dev

## Stack

* TypeScript + Next.js + Tailwind.
* Drizzle + Neon Postgres (app db for branching / fast iteration)
* Cloudflare Workers + Stream + R2 + DO for pipelines. HLS.js for playback.

## Setup

```bash
pnpm install
cp .env.example .env  
pnpm db:migrate
pnpm db:seed   # loads the demo episode, ad library, and media used by the PoC
pnpm dev
```

## Ad Library

Browse, upload, and pick ads for a marker.

- Ads upload to Cloudflare Stream. Progress streams back into the dialog.
- Dialog state (`useMarkerDialog`) separates from mutations (`useMarkerWorkflow`).
- **Code**: `src/editor/ads/` and `src/editor/markers/`.

## Video Player

Plays the episode with ads stitched in as interstitials.

- Playback hook (`usePlayback`) resolves a session on first play (episode + ordered ad breaks), then swaps video sources in place to run each ad inline.
- Playhead time flows out so the timeline stays synced.
- Keyboard (space, skips, jumps) are handled at the panel level.
- **Code**: `src/editor/playback/`.

## Timeline

Place and arrange markers on the episode.

- Markers, playhead, and timeline ruler get positions from `shared.ts`.
- Rapid drag saves are queued through `useMarkerDragSaves` so only one fires at a time.
- **Code**: `src/editor/timeline/` and `src/editor/markers/use-marker-drag-saves.ts`.

## Extras

- [x] Video and ad uploads
- [x] Real waveforms
- [x] MP4 generation
- [x] HLS output
- [x] Transcription
- [x] Durable pipelines

## Hosting

Video bandwidth and egress can be a pain at scale, so the entire app runs on Cloudflare:

- **Frontend**: Next.js on Cloudflare Worker
- **Video Delivery**: Cloudflare Stream
- **Media Pipeline:** Cloudflare Workers + R2 + Queues + Durable Objects

Keeping delivery, compute, and storage on the same edge network reduces latency.  Services are deployed separately but communicate via bindings. 


## Verify

```bash
pnpm lint
pnpm build
pnpm test
```
