import "server-only"

const readRequiredEnv = (name: string) => {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Uh ohs - Missing required env var: ${name}`)
  }

  return value
}

const readOptionalEnv = (name: string) => process.env[name] || null

export const serverEnv = {
  get databaseUrl() {
    return readRequiredEnv("DATABASE_URL")
  },
  get cloudflareAccountId() {
    return readRequiredEnv("CLOUDFLARE_ACCOUNT_ID")
  },
  get cloudflareStreamApiToken() {
    return readRequiredEnv("CLOUDFLARE_STREAM_API_TOKEN")
  },
  get cloudflareStreamCustomerSubdomain() {
    return readOptionalEnv("CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN")
  },
  get cloudflareWorkerPublicBaseUrl() {
    return readOptionalEnv("CLOUDFLARE_WORKER_PUBLIC_BASE_URL")
  },
  get hlsWorkerPublicBaseUrl() {
    return readOptionalEnv("HLS_WORKER_PUBLIC_BASE_URL")
  },
  get transcoderUrl() {
    return readOptionalEnv("TRANSCODER_URL")
  },
  get transcoderAuthToken() {
    return readOptionalEnv("TRANSCODER_AUTH_TOKEN")
  },
  get mediaJobsToken() {
    return readOptionalEnv("MEDIA_JOBS_TOKEN")
  },
  get cloudflareR2S3AccessKeyId() {
    return readOptionalEnv("CLOUDFLARE_R2_S3_ACCESS_KEY_ID")
  },
  get cloudflareR2S3SecretAccessKey() {
    return readOptionalEnv("CLOUDFLARE_R2_S3_SECRET_ACCESS_KEY")
  },
  get cloudflareR2Bucket() {
    return readOptionalEnv("CLOUDFLARE_R2_BUCKET")
  },
}
