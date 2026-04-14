# CF Worker for media jobs 

- receives a `generate_waveform`  requests
- pushs to `MEDIA_JOBS` queue
- kicks off transcoding
- reports `processing` / `ready` / `failed` back to the app

## ENV 

- `MEDIA_JOBS_TOKEN`
- `TRANSCODER_URL`
- `TRANSCODER_AUTH_TOKEN`
- `APP_INTERNAL_BASE_URL`

`/enqueue-waveform` expects:

```json
{
  "jobType": "generate_waveform",
  "mediaAssetId": "uuid",
  "sourceUrl": "https://...",
  "bucketCount": 1024 // for wav bands
}
```

## App Update

Once completed/failed, the worker posts updates `/api/internal/media-waveforms` and passes the  `MEDIA_JOBS_TOKEN`  token.
