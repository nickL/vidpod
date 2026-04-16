import "server-only"

import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

import { serverEnv } from "@/env/server"

const SIGNED_URL_TTL_SECONDS = 60 * 5

let r2Client: S3Client | null = null

const getR2Settings = () => {
  const accessKeyId = serverEnv.cloudflareR2S3AccessKeyId
  const secretAccessKey = serverEnv.cloudflareR2S3SecretAccessKey
  const bucket = serverEnv.cloudflareR2Bucket
  const accountId = serverEnv.cloudflareAccountId

  if (!accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("Cloudflare R2 is not configured")
  }

  return {
    accessKeyId,
    secretAccessKey,
    bucket,
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  }
}

const getR2Client = () => {
  if (r2Client) {
    return r2Client
  }

  const { accessKeyId, endpoint, secretAccessKey } = getR2Settings()

  r2Client = new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  })

  return r2Client
}

export const createR2UploadUrl = async ({
  key,
  contentType,
  expiresIn = SIGNED_URL_TTL_SECONDS,
}: {
  key: string
  contentType: string
  expiresIn?: number
}) => {
  const { bucket } = getR2Settings()

  return getSignedUrl(
    getR2Client(),
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn }
  )
}

export const createR2DownloadUrl = async ({
  key,
  fileName,
  contentType,
  expiresIn = SIGNED_URL_TTL_SECONDS,
}: {
  key: string
  fileName: string
  contentType: string
  expiresIn?: number
}) => {
  const { bucket } = getR2Settings()

  return getSignedUrl(
    getR2Client(),
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${fileName}"`,
      ResponseContentType: contentType,
    }),
    { expiresIn }
  )
}

export const getR2ObjectSize = async (key: string) => {
  const { bucket } = getR2Settings()

  try {
    const response = await getR2Client().send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    )

    return response.ContentLength
  } catch (error) {
    if (error instanceof Error && error.name === "NotFound") {
      return undefined
    }

    const statusCode = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata
      ?.httpStatusCode

    if (statusCode === 404) {
      return undefined
    }

    throw error
  }
}

export const readR2Json = async <T>(key: string): Promise<T> => {
  const { bucket } = getR2Settings()
  const response = await getR2Client().send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  )

  if (!response.Body) {
    throw new Error("Couldn't read the R2 object.")
  }

  const text = await response.Body.transformToString("utf-8")
  return JSON.parse(text) as T
}
