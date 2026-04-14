# Improvements

This document tracks deliberate follow-up work that is worth doing, but should not blur milestone boundaries while active slices are landing.

Use it for:

- hardening work that is not blocking the current slice
- cleanup that should not be forgotten
- small contract or workflow improvements discovered during implementation

## M2 Improvements

These items came out of the M2 Slice 2 review. They are useful, but they are not blockers for considering Slice 2 substantively complete.

### 1. Query Sync After Marker Mutations

**Why it matters**

The server actions exist, but the query cache refresh story is not wired yet. Once the UI starts calling marker mutations, the editor needs a clear post-mutation sync path.

**What to improve**

- decide the default sync strategy after create/update/delete marker actions
- wire either query invalidation, `router.refresh()`, or another consistent refresh path
- keep the behavior feature-local to `episode-editor`

### 2. Tests For Marker Invariants

**Why it matters**

The mutation layer enforces important rules, but those rules are only protected by runtime logic right now.

**What to improve**

- add tests for `static` markers requiring exactly one variant
- add tests for `ab` markers requiring at least two variants
- add tests that reject ad assets outside the episode's show
- add tests for partial updates so omitted variants preserve existing persisted variants

### 3. Cleaner Action Error Shapes

**Why it matters**

The current actions mostly surface thrown errors directly. That is fine for early implementation, but it is not the final contract the UI should rely on.

**What to improve**

- decide on a consistent action result shape for success and failure
- avoid leaking raw server errors directly into the UI layer
- keep the error contract small and predictable

### 4. Stream Metadata Enrichment

**Why it matters**

The main media contract is now real, but some optional Stream-derived fields are still thin.

**What to improve**

- populate `thumbnailUrl` when available
- decide whether any other Stream metadata should be pulled into the editor payload
- keep this additive and avoid reopening the payload shape unless it materially improves M3 work

## M3 Improvements

These items came out of the early player/timeline work. They should be handled alongside Milestone 3 follow-through, not forgotten once the happy path is working.

### 1. Adaptive Ruler Density For Short Media

**Why it matters**

The first truthful source-time timeline pass exposed that short media can look visually sparse when the ruler uses a fixed scale.

The current 90-second test asset is useful because it stress-tests this case early.

**What to improve**

- make ruler intervals respond to visible duration and available width instead of one fixed scale
- make short videos render with tighter major/minor tick density
- revisit the 90-second test asset after viewport/zoom/tick-density work lands
- verify both short and longer media durations render credibly with the same timeline system

### 2. Continuous Zoom From Slider Input

**Why it matters**

The timeline now supports zoom, but the top-right control is visually a slider while the implementation still snaps to a fixed set of zoom steps.

That mismatch is acceptable for the current slice, but it is not the final interaction model the UI is implying.

**What to improve**

- move from discrete zoom steps toward a continuous zoom factor driven by the slider position
- keep ruler tick density readable while zoom changes continuously
- preserve stable source-time math and viewport anchoring while changing zoom behavior
- verify the slider feels meaningfully smooth on both the long fixture and the 90-second stress fixture

### 3. Timeline Orchestrator Readability

**Why it matters**

[timeline.tsx](/Users/nickl/apps/vidpod/src/features/episode-editor/timeline/timeline.tsx) is the right owner for timeline orchestration, but it still carries a lot of behavior in one place:

- viewport sizing and scroll state
- zoom behavior
- pointer-to-time mapping
- playhead drag orchestration
- surface composition

That complexity is justified, but it is still a file that deserves periodic readability passes so it stays human-scannable as the timeline grows.

**What to improve**

- keep the file organized by concern instead of a long flat block
- prefer timeline-language names over raw DOM/event vocabulary
- continue extracting feature-local layout pieces or behavior units when they materially reduce cognitive load
- evaluate a future `useTimelineViewport(...)` hook only if it clearly improves readability without hiding ownership

### 4. Server-Side Marker Overlap Hardening

**Why it matters**

The current UI prevents overlap during normal single-editor drag flows by clamping against the latest optimistic marker positions.

The remaining gap is server-side: overlap validation still happens before the write batch, so separate concurrent saves from other tabs, sessions, or direct action calls could theoretically validate against stale placement state.

**What to improve**

- harden marker placement so non-overlap is enforced atomically at the persistence layer
- decide whether that should be done with stronger database constraints, row-level locking, or a narrower server-side write strategy
- keep this scoped as integrity hardening, not as a blocker for normal single-session editor use

## M4 Improvements

These items came out of the playback-session and interruption work. They are not blockers for the current slice, but they are the places most likely to benefit from another readability pass as M4 grows.

### 1. Playback Hook Readability

**Why it matters**

[use-playback.ts](/Users/nickl/apps/vidpod/src/features/episode-editor/use-playback.ts) now owns several real behaviors:

- first-play session startup
- episode playback
- ad interruption
- resume to episode
- scrub/seek coordination
- playback event logging

That complexity is legitimate, but it also makes the hook the easiest place for the code to start reading like machinery instead of product behavior.

**What to improve**

- keep the file grouped by concern rather than letting it flatten into one long procedure
- continue tightening names around the domain model: episode playback, ad playback, preview session, and scrub state
- extract only helpers that clarify behavior, not wrappers that just move lines around
- add interaction tests around first play, interruption, and reset so future readability changes are safer

### 2. Playback Session Service Shape

**Why it matters**

[playback-sessions.ts](/Users/nickl/apps/vidpod/src/features/episode-editor/playback-sessions.ts) is now the server-side home for:

- session start/resume
- break resolution loading
- session invalidation
- playback event validation

It is still readable, but it is close to becoming a broad runtime service file.

**What to improve**

- keep the file organized around session lifecycle, not just a list of queries
- continue removing one-off abstractions that do not earn their place
- evaluate whether any query helpers should be split out only if that makes the lifecycle easier to follow
- keep server validation and playback-plan loading in domain language rather than generic data-access language

### 3. Preview Config Invalidation Vocabulary

**Why it matters**

The explicit invalidation approach is the right simplification, but the `previewConfigKey` path is still a technical mechanism that needs careful naming and scoping so it does not become the new version-token problem in disguise.

**What to improve**

- keep the invalidation mechanism clearly tied to committed marker configuration changes
- avoid letting `previewConfigKey` leak into unrelated UI code or become a generic app-level concept
- revisit whether the signature builder in [episode-editor.tsx](/Users/nickl/apps/vidpod/src/features/episode-editor/episode-editor.tsx) can be made even more obviously about committed marker state if the logic grows

### 4. Interruption Clarity In Source-Time UI

**Why it matters**

The current interruption model is correct for the editor’s source-time semantics:

- the playhead pauses at the break point during ad playback
- the episode resumes from that same source point after the ad ends

What is still confusing is the visual metaphor. The marker is rendered as a span, so the playhead moving through that span after resume can imply that the ad break itself occupies that full region of source time.

**What to improve**

- add a lightweight `ad playing` or `break active` state in the player/timeline chrome
- distinguish active interruption state from normal source-time progress
- consider de-emphasizing the marker span as literal occupied time and emphasizing the trigger point more clearly

### 5. A/B Results Surface

**Why it matters**

`overlay-3` is clearly a later `A/B test results` surface, not part of the core create/edit flow.

It implies:

- ranked A/B outcomes
- a visible winner/leader
- a `New test` restart path
- a results-specific modal separate from authoring selection

## M5 Improvements

These items came out of the upload/readiness work. They are useful follow-through, but they should not block the core upload slice from moving forward.

### 1. Restore Original Episode Video

**Why it matters**

The current upload flow lets the user add a new episode video and explicitly switch to it, but there is no UI path back to the original seeded/main video once that switch happens.

For this PoC, that creates avoidable confusion during testing and demo use. A client can end up in a short uploaded clip and have no obvious recovery path from the editor itself.

**What to improve**

- add a simple player-surface action to restore the original episode video
- keep it narrow to the PoC instead of turning it into a full episode-video history manager
- make the fallback easy enough that a client does not need database help to get back to the seeded long-form demo state

### 2. Auto Pool Testing Clarity

**Why it matters**

`auto` currently resolves once per playback session and then stays stable within that session.

That matches the current session model, but it can be confusing while testing because replaying or seeking backward in the same session will keep producing the same chosen ad from the pool.

**What to improve**

- decide whether the current `auto` testing story needs an explicit `new preview session` affordance
- make it clearer in the UI or debugging workflow when a stable same-session choice is expected
- verify whether any follow-up UX is needed specifically for repetitive `auto` testing during editing

### 3. Zoom-Aware Waveform Density

**Why it matters**

The current waveform renderer behaves correctly across zoom levels:

- amplitude stays visually stable
- bars remain anchored to source time
- zoom changes horizontal density instead of re-scaling the waveform vertically

What is still worth revisiting later is the extreme high-zoom case. Right now bar cadence stays fixed, which is clean and design-safe, but it leaves room for a more detailed view when the user zooms all the way in.

**What to improve**

- evaluate whether fully zoomed-in timeline views should render a denser waveform cadence
- keep the waveform anchored to source time and avoid reintroducing drag/zoom shimmer
- only add more detail if it improves inspection value without making the track feel noisy

## Working Rule

These improvements can be handled in one of two ways:

- land them opportunistically while touching the same area for real feature work
- circle back once the current milestone or slice is otherwise complete

Do not treat this file as permission to reopen finished slice scope without a reason.
