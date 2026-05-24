import { NextRequest, NextResponse } from 'next/server'
import { uploadSimpleFile, generateStorageKey } from '@/lib/storage/r2-client'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const category = formData.get('category') as string || 'video'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Map frontend categories to valid storage categories
    let fileCategory: 'video' | 'thumbnail' | 'ad' | 'banner' = 'video'
    const catLower = category.toLowerCase()
    if (catLower === 'thumbnail' || catLower === 'thumbnails') {
      fileCategory = 'thumbnail'
    } else if (catLower === 'banner' || catLower === 'banners') {
      fileCategory = 'banner'
    } else if (catLower === 'ad' || catLower === 'ads' || catLower === 'hero') {
      fileCategory = 'ad'
    }

    // Generate unique storage key and upload the file
    const key = generateStorageKey(file.name, fileCategory)
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const result = await uploadSimpleFile(key, buffer, file.type)

    return NextResponse.json({
      url: result.url,
      key: result.key,
      size: result.size || file.size,
      provider: result.provider,
    }, { status: 201 })
  } catch (error) {
    console.error('[Upload API Error]', error)
    return NextResponse.json(
      { error: 'File upload failed', details: String(error) },
      { status: 500 }
    )
  }
}
