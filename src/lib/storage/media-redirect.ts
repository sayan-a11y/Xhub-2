import { NextRequest, NextResponse } from 'next/server'
import { getSignedUrl, getProvider } from '@/lib/storage/r2-client'
import { join } from 'path'
import { existsSync, createReadStream } from 'fs'

/**
 * Intercepts public file requests (like /videos/*) and redirects them
 * to secure pre-signed R2 URLs (in R2 mode) or streams them from local public folder (in local mode).
 */
export async function handleMediaRedirect(
  request: NextRequest,
  pathSegments: string[],
  categoryPrefix: string
) {
  const key = `${categoryPrefix}/${pathSegments.join('/')}`
  const provider = getProvider()

  if (provider === 'r2') {
    try {
      // Generate temporary presigned URL (valid for 1 hour)
      const signed = await getSignedUrl(key, 3600)
      return NextResponse.redirect(signed.url, 307)
    } catch (err) {
      console.error(`Error generating pre-signed URL for key ${key}:`, err)
      return NextResponse.json({ error: 'Failed to generate access URL' }, { status: 500 })
    }
  }

  // Local fallback: stream file from local public folder
  const localPath = join(process.cwd(), 'public', key)
  if (existsSync(localPath)) {
    try {
      const fileStream = createReadStream(localPath) as any
      const ext = key.split('.').pop()?.toLowerCase() || ''
      const mimeTypes: Record<string, string> = {
        mp4: 'video/mp4',
        webm: 'video/webm',
        mov: 'video/quicktime',
        mkv: 'video/x-matroska',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
        gif: 'image/gif',
        svg: 'image/svg+xml',
      }
      const contentType = mimeTypes[ext] || 'application/octet-stream'

      return new NextResponse(fileStream, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      })
    } catch (err) {
      console.error(`Error streaming file at ${localPath}:`, err)
      return NextResponse.json({ error: 'Error streaming file' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'File not found' }, { status: 404 })
}
