/**
 * Cloudflare R2 Storage Client
 *
 * Direct R2 multipart upload architecture:
 * 1. Client calls init-upload → API returns presigned URLs for each part
 * 2. Client uploads parts DIRECTLY to R2 using presigned URLs (bypasses API body limits)
 * 3. Client calls complete-upload → API tells R2 to assemble the parts
 *
 * No in-memory sessions. No chunk-to-local-then-R2. Pure direct upload.
 *
 * Environment Variables for R2:
 *   R2_ACCOUNT_ID        - Cloudflare account ID
 *   R2_ACCESS_KEY_ID     - R2 API token access key ID
 *   R2_SECRET_ACCESS_KEY - R2 API token secret access key
 *   R2_BUCKET_NAME       - R2 bucket name (default: xtube-media)
 *   R2_PUBLIC_URL        - Public CDN URL for the bucket
 */

import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  unlinkSync,
  readdirSync,
  rmSync,
} from 'fs'
import { join, dirname } from 'path'
import { createHmac, randomUUID, createHash } from 'crypto'

// ─── Types ───────────────────────────────────────────────────────────────────

export type StorageProvider = 'r2' | 'local'
export type FileCategory = 'video' | 'thumbnail' | 'ad' | 'banner'

export interface InitUploadResult {
  uploadId: string
  key: string
  parts: Array<{ partNumber: number; uploadUrl: string }>
  provider: StorageProvider
  chunkSize: number
}

export interface UploadPartResult {
  partNumber: number
  etag: string
  received: boolean
}

export interface CompleteUploadResult {
  key: string
  url: string
  size: number
  provider: StorageProvider
}

export interface SignedUrlResult {
  url: string
  expiresAt: string
}

export interface DeleteResult {
  deleted: boolean
  key: string
}

export interface ObjectUrlResult {
  url: string
  isSigned: boolean
}

// ─── R2 Configuration ────────────────────────────────────────────────────────

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || ''
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || ''
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || ''
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'xtube-media'
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || ''

const R2_BASE_URL = R2_ACCOUNT_ID
  ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
  : ''

/** Check if R2 is properly configured with all required credentials */
export function isR2Configured(): boolean {
  return !!(
    R2_ACCOUNT_ID &&
    R2_ACCESS_KEY_ID &&
    R2_SECRET_ACCESS_KEY &&
    R2_BUCKET_NAME
  )
}

/** Get the current storage provider */
export function getProvider(): StorageProvider {
  return isR2Configured() ? 'r2' : 'local'
}

// ─── Local Storage Paths ─────────────────────────────────────────────────────

const PUBLIC_DIR = join(process.cwd(), 'public')

const CATEGORY_PATHS: Record<FileCategory, string> = {
  video: 'videos',
  thumbnail: 'thumbnails',
  ad: 'ads',
  banner: 'banners',
}

// ─── S3-Compatible Signature (AWS Signature V4) ─────────────────────────────

function signRequest(
  method: string,
  path: string,
  headers: Record<string, string>,
  bodyHash: string,
  timestamp: Date,
  queryParams?: Record<string, string>,
  region = 'auto',
  service = 's3'
): Record<string, string> {
  const dateStamp = timestamp.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const dateOnly = dateStamp.substring(0, 8)

  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map((k) => `${k.toLowerCase()}:${headers[k].trim()}`)
    .join('\n')
  const signedHeaders = Object.keys(headers)
    .sort()
    .map((k) => k.toLowerCase())
    .join(';')

  let canonicalQuery = ''
  if (queryParams) {
    canonicalQuery = Object.keys(queryParams)
      .sort()
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k])}`)
      .join('&')
  }

  const canonicalRequest = [
    method,
    path,
    canonicalQuery,
    canonicalHeaders,
    '',
    signedHeaders,
    bodyHash,
  ].join('\n')

  const scope = `${dateOnly}/${region}/${service}/aws4_request`
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    dateStamp,
    scope,
    sha256Hex(canonicalRequest),
  ].join('\n')

  const kDate = hmacSha256(`AWS4${R2_SECRET_ACCESS_KEY}`, dateOnly)
  const kRegion = hmacSha256(kDate, region)
  const kService = hmacSha256(kRegion, service)
  const kSigning = hmacSha256(kService, 'aws4_request')

  const signature = hmacSha256Hex(kSigning, stringToSign)

  const authHeader = `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY_ID}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  return {
    ...headers,
    Authorization: authHeader,
    'X-Amz-Date': dateStamp,
    'X-Amz-Content-Sha256': bodyHash,
  }
}

/**
 * Generate a presigned PUT URL for uploading a part directly to R2.
 * The client will use this URL to upload data directly to R2,
 * bypassing our API server entirely (no body size limits!).
 */
function generatePresignedPutUrl(
  key: string,
  partNumber: number,
  uploadId: string,
  expiresInSeconds: number = 3600,
  region = 'auto',
  service = 's3'
): string {
  const timestamp = new Date()
  const dateStamp = timestamp.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const dateOnly = dateStamp.substring(0, 8)

  const host = `${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
  const path = `/${R2_BUCKET_NAME}/${key}`

  const scope = `${dateOnly}/${region}/${service}/aws4_request`
  const credential = `${R2_ACCESS_KEY_ID}/${scope}`

  // Build query parameters for multipart upload part
  const queryParams: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': credential,
    'X-Amz-Date': dateStamp,
    'X-Amz-Expires': expiresInSeconds.toString(),
    'X-Amz-SignedHeaders': 'host',
    'partNumber': partNumber.toString(),
    'uploadId': uploadId,
  }

  const sortedQuery = Object.keys(queryParams)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k])}`)
    .join('&')

  // Canonical request for presigned URL
  const canonicalRequest = [
    'PUT',
    path,
    sortedQuery,
    `host:${host}`,
    '',
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n')

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    dateStamp,
    scope,
    sha256Hex(canonicalRequest),
  ].join('\n')

  const kDate = hmacSha256(`AWS4${R2_SECRET_ACCESS_KEY}`, dateOnly)
  const kRegion = hmacSha256(kDate, region)
  const kService = hmacSha256(kRegion, service)
  const kSigning = hmacSha256(kService, 'aws4_request')

  const signature = hmacSha256Hex(kSigning, stringToSign)

  return `${R2_BASE_URL}${path}?${sortedQuery}&X-Amz-Signature=${signature}`
}

/**
 * Generate a presigned GET URL for downloading/reading an object.
 */
function generatePresignedGetUrl(
  key: string,
  expiresInSeconds: number = 3600,
  region = 'auto',
  service = 's3'
): string {
  const timestamp = new Date()
  const dateStamp = timestamp.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const dateOnly = dateStamp.substring(0, 8)

  const host = `${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
  const path = `/${R2_BUCKET_NAME}/${key}`

  const scope = `${dateOnly}/${region}/${service}/aws4_request`
  const credential = `${R2_ACCESS_KEY_ID}/${scope}`

  const queryParams: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': credential,
    'X-Amz-Date': dateStamp,
    'X-Amz-Expires': expiresInSeconds.toString(),
    'X-Amz-SignedHeaders': 'host',
  }

  const sortedQuery = Object.keys(queryParams)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k])}`)
    .join('&')

  const canonicalRequest = [
    'GET',
    path,
    sortedQuery,
    `host:${host}`,
    '',
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n')

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    dateStamp,
    scope,
    sha256Hex(canonicalRequest),
  ].join('\n')

  const kDate = hmacSha256(`AWS4${R2_SECRET_ACCESS_KEY}`, dateOnly)
  const kRegion = hmacSha256(kDate, region)
  const kService = hmacSha256(kRegion, service)
  const kSigning = hmacSha256(kService, 'aws4_request')

  const signature = hmacSha256Hex(kSigning, stringToSign)

  return `${R2_BASE_URL}${path}?${sortedQuery}&X-Amz-Signature=${signature}`
}

// ─── Crypto Helpers ──────────────────────────────────────────────────────────

function sha256Hex(data: string): string {
  return createHash('sha256').update(data).digest('hex')
}

function hmacSha256(key: string | Buffer, data: string): Buffer {
  return createHmac('sha256', key).update(data).digest()
}

function hmacSha256Hex(key: Buffer, data: string): string {
  return createHmac('sha256', key).update(data).digest('hex')
}

// ─── Key Generation ──────────────────────────────────────────────────────────

export function generateStorageKey(
  fileName: string,
  category: FileCategory
): string {
  const now = new Date()
  const year = now.getFullYear().toString()
  const month = (now.getMonth() + 1).toString().padStart(2, '0')
  const ext = fileName.split('.').pop() || 'bin'
  const uuid = randomUUID().replace(/-/g, '').substring(0, 12)
  const prefix = CATEGORY_PATHS[category]

  return `${prefix}/${year}/${month}/${uuid}.${ext}`
}

// ─── Local Storage Helpers ───────────────────────────────────────────────────

function ensureLocalDir(key: string): string {
  const fullPath = join(PUBLIC_DIR, key)
  const dir = dirname(fullPath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return fullPath
}

function getLocalUrl(key: string): string {
  return `/${key}`
}

// ─── R2 API Call Helper ──────────────────────────────────────────────────────

async function r2Fetch(
  method: string,
  key: string,
  body?: BodyInit | null,
  extraHeaders?: Record<string, string>
): Promise<Response> {
  const url = `${R2_BASE_URL}/${R2_BUCKET_NAME}/${key}`
  const host = `${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`

  const headers: Record<string, string> = {
    Host: host,
    'Content-Type': 'application/octet-stream',
    ...extraHeaders,
  }

  let bodyHash: string
  if (body === null || body === undefined) {
    bodyHash = sha256Hex('')
  } else if (typeof body === 'string') {
    bodyHash = sha256Hex(body)
  } else {
    bodyHash = 'UNSIGNED-PAYLOAD'
  }

  const signedHeaders = signRequest(
    method,
    `/${R2_BUCKET_NAME}/${key}`,
    headers,
    bodyHash,
    new Date()
  )

  return fetch(url, {
    method,
    headers: signedHeaders,
    body,
  })
}

// ─── Public API: Direct R2 Multipart Upload ──────────────────────────────────

/**
 * Initialize a multipart upload and return presigned URLs for each part.
 *
 * R2 mode: Returns presigned PUT URLs → client uploads directly to R2.
 * Local mode: Returns local API URLs → client uploads through our API.
 */
export async function initMultipartUpload(
  key: string,
  contentType: string,
  fileSize: number,
  category: FileCategory,
  fileName: string
): Promise<InitUploadResult> {
  const provider = getProvider()

  if (provider === 'r2') {
    return initMultipartUploadR2(key, contentType, fileSize, category, fileName)
  }

  return initMultipartUploadLocal(key, contentType, fileSize, category, fileName)
}

async function initMultipartUploadR2(
  key: string,
  contentType: string,
  fileSize: number,
  _category: FileCategory,
  _fileName: string
): Promise<InitUploadResult> {
  // Step 1: Initiate multipart upload with R2
  const host = `${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
  const headers: Record<string, string> = {
    Host: host,
    'Content-Type': contentType,
  }

  const bodyHash = sha256Hex('')
  const signedHeaders = signRequest('POST', `/${R2_BUCKET_NAME}/${key}`, headers, bodyHash, new Date(), { uploads: '' })

  const url = `${R2_BASE_URL}/${R2_BUCKET_NAME}/${key}?uploads`
  const response = await fetch(url, {
    method: 'POST',
    headers: signedHeaders,
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`R2 initMultipartUpload failed: ${response.status} ${errText}`)
  }

  // Parse the UploadId from XML response
  const xml = await response.text()
  const uploadIdMatch = xml.match(/<UploadId>([^<]+)<\/UploadId>/)
  if (!uploadIdMatch) {
    throw new Error('Failed to parse UploadId from R2 response')
  }
  const uploadId = uploadIdMatch[1]

  // Calculate parts: 5MB minimum per part (R2 requirement), last part can be smaller
  const MIN_PART_SIZE = 5 * 1024 * 1024 // 5MB
  const chunkSize = MIN_PART_SIZE
  const partCount = Math.max(1, Math.ceil(fileSize / chunkSize))

  // Generate presigned PUT URLs for each part
  // Client will upload DIRECTLY to R2 using these URLs — no API body size limits!
  const parts = Array.from({ length: partCount }, (_, i) => ({
    partNumber: i + 1,
    uploadUrl: generatePresignedPutUrl(key, i + 1, uploadId, 3600),
  }))

  return {
    uploadId,
    key,
    parts,
    provider: 'r2',
    chunkSize,
  }
}

async function initMultipartUploadLocal(
  key: string,
  contentType: string,
  fileSize: number,
  _category: FileCategory,
  _fileName: string
): Promise<InitUploadResult> {
  const uploadId = `local_${randomUUID()}`
  const MIN_PART_SIZE = 5 * 1024 * 1024 // 5MB
  const chunkSize = MIN_PART_SIZE
  const partCount = Math.max(1, Math.ceil(fileSize / chunkSize))

  // For local mode, client still uploads parts through our API
  // But we use a different approach: store parts in a session directory
  const sessionDir = join(process.cwd(), 'upload', 'r2-parts', uploadId)
  if (!existsSync(sessionDir)) {
    mkdirSync(sessionDir, { recursive: true })
  }

  // Write metadata file so we can reconstruct session after hot-reload
  writeFileSync(join(sessionDir, '_meta.json'), JSON.stringify({
    uploadId,
    key,
    contentType,
    fileSize,
    partCount,
    createdAt: new Date().toISOString(),
  }))

  const parts = Array.from({ length: partCount }, (_, i) => ({
    partNumber: i + 1,
    uploadUrl: `/api/r2?action=upload-part&uploadId=${uploadId}&partNumber=${i + 1}&key=${encodeURIComponent(key)}`,
  }))

  // Ensure target directory exists
  ensureLocalDir(key)

  return {
    uploadId,
    key,
    parts,
    provider: 'local',
    chunkSize,
  }
}

/**
 * Upload a part for local storage mode only.
 * R2 mode uploads directly via presigned URLs (client-side).
 */
export async function uploadPartLocal(
  uploadId: string,
  partNumber: number,
  data: Buffer | ArrayBuffer
): Promise<UploadPartResult> {
  const sessionDir = join(process.cwd(), 'upload', 'r2-parts', uploadId)
  if (!existsSync(sessionDir)) {
    throw new Error(`Upload session directory not found: ${uploadId}`)
  }

  const bodyBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data)
  const etag = `"${randomUUID()}"`

  // Save the part to disk
  const partPath = join(sessionDir, `part_${partNumber}`)
  writeFileSync(partPath, bodyBuffer)

  // Track the etag in a parts manifest file
  const manifestPath = join(sessionDir, '_manifest.json')
  let manifest: Record<number, { etag: string; size: number }> = {}
  if (existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
    } catch {
      manifest = {}
    }
  }
  manifest[partNumber] = { etag, size: bodyBuffer.length }
  writeFileSync(manifestPath, JSON.stringify(manifest))

  return {
    partNumber,
    etag,
    received: true,
  }
}

/**
 * Complete a multipart upload.
 *
 * R2 mode: Sends CompleteMultipartUpload XML to R2.
 * Local mode: Concatenates all parts into the final file.
 */
export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: Array<{ partNumber: number; etag: string }>
): Promise<CompleteUploadResult> {
  const provider = getProvider()

  if (provider === 'r2') {
    return completeMultipartUploadR2(key, uploadId, parts)
  }

  return completeMultipartUploadLocal(key, uploadId, parts)
}

async function completeMultipartUploadR2(
  key: string,
  uploadId: string,
  parts: Array<{ partNumber: number; etag: string }>
): Promise<CompleteUploadResult> {
  // Build CompleteMultipartUpload XML
  const partsXml = parts
    .sort((a, b) => a.partNumber - b.partNumber)
    .map(
      (p) =>
        `<Part><PartNumber>${p.partNumber}</PartNumber><ETag>${p.etag}</ETag></Part>`
    )
    .join('')

  const body = `<CompleteMultipartUpload>${partsXml}</CompleteMultipartUpload>`

  const host = `${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
  const queryStr = `uploadId=${encodeURIComponent(uploadId)}`

  const headers: Record<string, string> = {
    Host: host,
    'Content-Type': 'application/xml',
  }

  const bodyHash = sha256Hex(body)
  const signedHeaders = signRequest('POST', `/${R2_BUCKET_NAME}/${key}`, headers, bodyHash, new Date(), { uploadId })

  const url = `${R2_BASE_URL}/${R2_BUCKET_NAME}/${key}?${queryStr}`
  const response = await fetch(url, {
    method: 'POST',
    headers: signedHeaders,
    body,
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`R2 completeMultipartUpload failed: ${response.status} ${errText}`)
  }

  const url_result = R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${key}` : `/${key}`

  return {
    key,
    url: url_result,
    size: 0, // Size not easily known from complete response
    provider: 'r2',
  }
}

async function completeMultipartUploadLocal(
  key: string,
  uploadId: string,
  parts: Array<{ partNumber: number; etag: string }>
): Promise<CompleteUploadResult> {
  const sessionDir = join(process.cwd(), 'upload', 'r2-parts', uploadId)
  if (!existsSync(sessionDir)) {
    throw new Error(`Upload session directory not found: ${uploadId}`)
  }

  // Read manifest for etags
  const manifestPath = join(sessionDir, '_manifest.json')
  let manifest: Record<number, { etag: string; size: number }> = {}
  if (existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
    } catch {
      manifest = {}
    }
  }

  // Use provided parts if available, otherwise fall back to manifest
  const effectiveParts = parts.length > 0 ? parts : Object.entries(manifest).map(([num, info]) => ({
    partNumber: parseInt(num),
    etag: info.etag,
  }))

  // Concatenate parts in order
  const sortedParts = effectiveParts.sort((a, b) => a.partNumber - b.partNumber)
  const chunks: Buffer[] = []
  let totalSize = 0

  for (const part of sortedParts) {
    const partPath = join(sessionDir, `part_${part.partNumber}`)
    if (!existsSync(partPath)) {
      throw new Error(`Part ${part.partNumber} not found on disk`)
    }
    const chunk = readFileSync(partPath)
    chunks.push(chunk)
    totalSize += chunk.length
  }

  const finalBuffer = Buffer.concat(chunks)
  const fullPath = ensureLocalDir(key)
  writeFileSync(fullPath, finalBuffer)

  // Clean up temp parts
  try {
    rmSync(sessionDir, { recursive: true, force: true })
  } catch {
    // Ignore cleanup errors
  }

  return {
    key,
    url: getLocalUrl(key),
    size: totalSize,
    provider: 'local',
  }
}

/**
 * Simple single-file upload (for thumbnails, ads, etc. - small files).
 * For R2: Uploads directly via signed PUT.
 * For local: Saves directly to public directory.
 */
export async function uploadSimpleFile(
  key: string,
  data: Buffer | ArrayBuffer,
  contentType: string = 'application/octet-stream'
): Promise<CompleteUploadResult> {
  const provider = getProvider()

  if (provider === 'r2') {
    const bodyBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data)
    const host = `${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`

    const headers: Record<string, string> = {
      Host: host,
      'Content-Type': contentType,
      'Content-Length': bodyBuffer.length.toString(),
    }

    const bodyHash = 'UNSIGNED-PAYLOAD'
    const signedHeaders = signRequest('PUT', `/${R2_BUCKET_NAME}/${key}`, headers, bodyHash, new Date())

    const url = `${R2_BASE_URL}/${R2_BUCKET_NAME}/${key}`
    const response = await fetch(url, {
      method: 'PUT',
      headers: signedHeaders,
      body: bodyBuffer as any,
    })

    if (!response.ok) {
      throw new Error(`R2 uploadSimpleFile failed: ${response.status} ${await response.text()}`)
    }

    const url_result = R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${key}` : `/${key}`

    return {
      key,
      url: url_result,
      size: bodyBuffer.length,
      provider: 'r2',
    }
  }

  // Local mode
  const bodyBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data)
  const fullPath = ensureLocalDir(key)
  writeFileSync(fullPath, bodyBuffer)

  return {
    key,
    url: getLocalUrl(key),
    size: bodyBuffer.length,
    provider: 'local',
  }
}

/**
 * Generate a signed URL for secure streaming/access.
 */
export async function getSignedUrl(
  key: string,
  expiresInSeconds: number = 3600
): Promise<SignedUrlResult> {
  const provider = getProvider()

  if (provider === 'r2') {
    const url = generatePresignedGetUrl(key, expiresInSeconds)
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString()

    return { url, expiresAt }
  }

  return {
    url: getLocalUrl(key),
    expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
  }
}

/**
 * Delete a file from storage.
 */
export async function deleteObject(key: string): Promise<DeleteResult> {
  const provider = getProvider()

  if (provider === 'r2') {
    const response = await r2Fetch('DELETE', key)
    if (!response.ok && response.status !== 204) {
      throw new Error(`R2 deleteObject failed: ${response.status} ${await response.text()}`)
    }
    return { deleted: true, key }
  }

  const fullPath = join(PUBLIC_DIR, key)
  if (existsSync(fullPath)) {
    unlinkSync(fullPath)
  }

  try {
    const parentDir = dirname(fullPath)
    const files = readdirSync(parentDir)
    if (files.length === 0) {
      rmSync(parentDir, { recursive: true, force: true })
    }
  } catch {
    // Ignore cleanup errors
  }

  return { deleted: true, key }
}

/**
 * Get the URL for an object.
 */
export async function getObjectUrl(key: string): Promise<ObjectUrlResult> {
  const provider = getProvider()

  if (provider === 'r2') {
    if (R2_PUBLIC_URL) {
      return { url: `${R2_PUBLIC_URL}/${key}`, isSigned: false }
    }
    const signed = await getSignedUrl(key)
    return { url: signed.url, isSigned: true }
  }

  return { url: getLocalUrl(key), isSigned: false }
}

/**
 * Get upload session metadata from disk (local mode only).
 * Replaces in-memory session tracking — survives hot-reloads!
 */
export function getLocalSessionMeta(uploadId: string): {
  uploadId: string
  key: string
  contentType: string
  fileSize: number
  partCount: number
  createdAt: string
} | null {
  const metaPath = join(process.cwd(), 'upload', 'r2-parts', uploadId, '_meta.json')
  if (!existsSync(metaPath)) return null
  try {
    return JSON.parse(readFileSync(metaPath, 'utf-8'))
  } catch {
    return null
  }
}

/**
 * List all objects with a given prefix in storage.
 */
export async function listObjects(
  prefix: string,
  maxKeys: number = 100
): Promise<Array<{ key: string; size: number; lastModified: string }>> {
  const provider = getProvider()

  if (provider === 'r2') {
    return listObjectsR2(prefix, maxKeys)
  }

  return listObjectsLocal(prefix, maxKeys)
}

async function listObjectsR2(
  prefix: string,
  maxKeys: number
): Promise<Array<{ key: string; size: number; lastModified: string }>> {
  const host = `${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
  const path = `/${R2_BUCKET_NAME}?list-type=2&prefix=${encodeURIComponent(prefix)}&max-keys=${maxKeys}`

  const headers: Record<string, string> = { Host: host }
  const bodyHash = sha256Hex('')
  const signedHeaders = signRequest('GET', `/${R2_BUCKET_NAME}`, headers, bodyHash, new Date())

  const url = `${R2_BASE_URL}${path}`
  const response = await fetch(url, { method: 'GET', headers: signedHeaders })

  if (!response.ok) {
    throw new Error(`R2 listObjects failed: ${response.status}`)
  }

  const xml = await response.text()
  const objects: Array<{ key: string; size: number; lastModified: string }> = []

  const contentRegex = /<Contents>([\s\S]*?)<\/Contents>/g
  let match
  while ((match = contentRegex.exec(xml)) !== null) {
    const content = match[1]
    const keyMatch = content.match(/<Key>([^<]+)<\/Key>/)
    const sizeMatch = content.match(/<Size>([^<]+)<\/Size>/)
    const dateMatch = content.match(/<LastModified>([^<]+)<\/LastModified>/)

    if (keyMatch && sizeMatch) {
      objects.push({
        key: keyMatch[1],
        size: parseInt(sizeMatch[1], 10),
        lastModified: dateMatch ? dateMatch[1] : new Date().toISOString(),
      })
    }
  }

  return objects
}

async function listObjectsLocal(
  prefix: string,
  maxKeys: number
): Promise<Array<{ key: string; size: number; lastModified: string }>> {
  const dir = join(PUBLIC_DIR, prefix)
  if (!existsSync(dir)) return []

  const objects: Array<{ key: string; size: number; lastModified: string }> = []
  const { statSync } = await import('fs')

  function walkDir(currentDir: string, currentPrefix: string) {
    if (objects.length >= maxKeys) return
    const entries = readdirSync(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      if (objects.length >= maxKeys) break
      const fullPath = join(currentDir, entry.name)
      const entryPrefix = currentPrefix ? `${currentPrefix}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        walkDir(fullPath, entryPrefix)
      } else {
        try {
          const stat = statSync(fullPath)
          objects.push({
            key: entryPrefix,
            size: stat.size,
            lastModified: stat.mtime.toISOString(),
          })
        } catch {
          // Skip files that can't be stat'd
        }
      }
    }
  }

  walkDir(dir, prefix)
  return objects
}
