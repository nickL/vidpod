import "server-only"

function readRequiredEnv(name: string) {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Uh ohs - Missing required env var: ${name}`)
  }

  return value
}

function readOptionalEnv(name: string) {
  return process.env[name] || null
}

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
  get mediaJobsToken() {
    return readOptionalEnv("MEDIA_JOBS_TOKEN")
  },
}
