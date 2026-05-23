import { NextRequest, NextResponse } from 'next/server'
import { mkdirSync, existsSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { randomUUID } from 'crypto'

// ─── Upload API Route ────────────────────────────────────────────────────────
// Handles direct file uploads (video + thumbnail) to local storage

const PUBLIC_DIR = join(process.cwd(), 'public')

function ensureDir(filePath: string) {
  const dir = dirname(filePath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const category = (formData.get('category') as string) || 'video'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    const validVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska', 'application/x-mpegURL']
    const validImageTypes = ['image/jpeg', 'image/png', 'image/webp']
    const validAdsTypes = ['image/gif', 'image/svg+xml', ...validVideoTypes, ...validImageTypes]
    const validTypes = [...validVideoTypes, ...validImageTypes, ...validAdsTypes]

    const isAdsCategory = category === 'ads' || category === 'hero'

    if (!validTypes.includes(file.type) && !file.name.match(/\.(mp4|webm|mov|mkv|m3u8|jpg|jpeg|png|webp|gif|svg)$/i)) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
    }

    // Determine subfolder based on category
    const isImage = validImageTypes.includes(file.type) || file.name.match(/\.(jpg|jpeg|png|webp)$/i)
    const isGif = file.type === 'image/gif' || file.name.match(/\.gif$/i)
    const isSvg = file.type === 'image/svg+xml' || file.name.match(/\.svg$/i)
    let subfolder: string
    if (isAdsCategory) {
      subfolder = 'ads'
    } else if (isImage) {
      subfolder = 'thumbnails'
    } else {
      subfolder = 'videos'
    }

    // Generate unique filename
    const now = new Date()
    const year = now.getFullYear().toString()
    const month = (now.getMonth() + 1).toString().padStart(2, '0')
    const ext = file.name.split('.').pop() || (isGif ? 'gif' : isSvg ? 'svg' : isImage ? 'jpg' : 'mp4')
    const uuid = randomUUID().replace(/-/g, '').substring(0, 12)
    const fileName = `${uuid}.${ext}`
    const storageKey = `${subfolder}/${year}/${month}/${fileName}`

    // Save file to public directory
    const fullPath = join(PUBLIC_DIR, storageKey)
    ensureDir(fullPath)

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    writeFileSync(fullPath, buffer)

    const fileSize = buffer.length

    return NextResponse.json({
      url: `/${storageKey}`,
      key: storageKey,
      size: fileSize,
      fileName: file.name,
      mimeType: file.type,
      category: subfolder,
    }, { status: 201 })
  } catch (error) {
    console.error('[Upload Error]', error)
    return NextResponse.json(
      { error: 'Upload failed', details: String(error) },
      { status: 500 }
    )
  }
}
