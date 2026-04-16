# CF Worker for media jobs 

- receives media job requests
- pushs to `MEDIA_JOBS` queue
- kicks off waveform / mp4 / transcript work
- reports `processing` / `ready` / `failed` back to the app

## ENV 

- `MEDIA_JOBS_TOKEN`
- `TRANSCODER_URL`
- `TRANSCODER_AUTH_TOKEN`
- `APP` (service binding)
- `APP_INTERNAL_BASE_URL` (fallback / local only)

## Routes

- `/enqueue-waveform`
- `/enqueue-mp4-export`
- `/enqueue-transcript`

## App Update

Once completed/failed, the worker posts updates back to the app using the `MEDIA_JOBS_TOKEN` token.
