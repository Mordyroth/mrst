/**
 * S3 Storage Utility
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import crypto from 'crypto'

// S3 client singleton
let s3Client: S3Client | null = null

/**
 * Get or create S3 client
 */
export function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: process.env.S3_REGION || 'us-east-1',
      // Credentials will be loaded from environment or IAM role
    })
  }
  return s3Client
}

/**
 * Get the default bucket name
 */
export function getDefaultBucket(): string {
  return process.env.S3_BUCKET || 'mrst-files'
}

/**
 * Generate S3 key for a file
 */
export function generateS3Key(options: {
  tenantId: string
  source: string
  entityType: string
  entityId: string
  filename: string
}): string {
  const { tenantId, source, entityType, entityId, filename } = options
  const timestamp = Date.now()
  const hash = crypto.createHash('md5').update(`${entityId}${timestamp}`).digest('hex').slice(0, 8)
  const safeFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_')

  return `${tenantId}/${source}/${entityType}/${entityId}/${hash}_${safeFilename}`
}

/**
 * Upload a file to S3
 */
export async function uploadToS3(options: {
  bucket?: string
  key: string
  body: Buffer | Uint8Array | string
  contentType?: string
  metadata?: Record<string, string>
}): Promise<{ bucket: string; key: string; etag?: string }> {
  const { bucket = getDefaultBucket(), key, body, contentType, metadata } = options
  const client = getS3Client()

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
    Metadata: metadata,
  })

  const response = await client.send(command)

  return {
    bucket,
    key,
    etag: response.ETag,
  }
}

/**
 * Download a file from S3
 */
export async function downloadFromS3(options: {
  bucket?: string
  key: string
}): Promise<{ body: Buffer; contentType?: string; contentLength?: number }> {
  const { bucket = getDefaultBucket(), key } = options
  const client = getS3Client()

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  })

  const response = await client.send(command)

  if (!response.Body) {
    throw new Error('Empty response body from S3')
  }

  // Convert stream to buffer
  const chunks: Uint8Array[] = []
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk)
  }
  const body = Buffer.concat(chunks)

  return {
    body,
    contentType: response.ContentType,
    contentLength: response.ContentLength,
  }
}

/**
 * Check if a file exists in S3
 */
export async function fileExistsInS3(options: {
  bucket?: string
  key: string
}): Promise<boolean> {
  const { bucket = getDefaultBucket(), key } = options
  const client = getS3Client()

  try {
    const command = new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    })
    await client.send(command)
    return true
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'NotFound') {
      return false
    }
    throw error
  }
}

/**
 * Delete a file from S3
 */
export async function deleteFromS3(options: {
  bucket?: string
  key: string
}): Promise<void> {
  const { bucket = getDefaultBucket(), key } = options
  const client = getS3Client()

  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  })

  await client.send(command)
}

/**
 * Generate a presigned URL for downloading a file
 */
export async function getPresignedDownloadUrl(options: {
  bucket?: string
  key: string
  expiresIn?: number // seconds
}): Promise<string> {
  const { bucket = getDefaultBucket(), key, expiresIn = 3600 } = options
  const client = getS3Client()

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  })

  return getSignedUrl(client, command, { expiresIn })
}

/**
 * Generate a presigned URL for uploading a file
 */
export async function getPresignedUploadUrl(options: {
  bucket?: string
  key: string
  contentType?: string
  expiresIn?: number // seconds
}): Promise<string> {
  const { bucket = getDefaultBucket(), key, contentType, expiresIn = 3600 } = options
  const client = getS3Client()

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  })

  return getSignedUrl(client, command, { expiresIn })
}

/**
 * Download a file from URL and upload to S3
 */
export async function downloadAndUploadToS3(options: {
  sourceUrl: string
  bucket?: string
  key: string
  headers?: Record<string, string>
}): Promise<{ bucket: string; key: string; size: number; contentType?: string }> {
  const { sourceUrl, bucket = getDefaultBucket(), key, headers } = options

  // Download from source
  const response = await fetch(sourceUrl, {
    headers,
  })

  if (!response.ok) {
    throw new Error(`Failed to download from ${sourceUrl}: ${response.status} ${response.statusText}`)
  }

  const contentType = response.headers.get('content-type') || undefined
  const buffer = Buffer.from(await response.arrayBuffer())

  // Upload to S3
  await uploadToS3({
    bucket,
    key,
    body: buffer,
    contentType,
  })

  return {
    bucket,
    key,
    size: buffer.length,
    contentType,
  }
}
