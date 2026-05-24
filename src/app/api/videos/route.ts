import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const sort = searchParams.get('sort') || 'latest'
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const cursor = searchParams.get('cursor')

    const where: any = { isPublished: true }

    if (category && category !== 'all') {
      where.category = category
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
      ]
    }

    let orderBy: any = { createdAt: 'desc' }
    if (sort === 'trending' || sort === 'popular') orderBy = { views: 'desc' }
    if (sort === 'oldest') orderBy = { createdAt: 'asc' }
    if (sort === 'title') orderBy = { title: 'asc' }

    // Cursor-based pagination for infinite scroll
    const queryOptions: any = {
      where,
      orderBy,
      take: limit + 1, // fetch one extra to determine nextCursor
    }

    if (cursor) {
      queryOptions.cursor = { id: cursor }
      queryOptions.skip = 1 // skip the cursor item itself
    } else if (offset > 0) {
      // Backward compat: offset-based pagination
      queryOptions.skip = offset
    }

    const videos = await db.video.findMany(queryOptions)

    // Determine nextCursor
    let nextCursor: string | null = null
    if (videos.length > limit) {
      videos.pop() // remove the extra item
      nextCursor = videos[videos.length - 1].id
    }

    const total = await db.video.count({ where })

    return NextResponse.json({ videos, total, nextCursor }, {
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
    })
  } catch (error) {
    console.error('Error fetching videos:', error)
    return NextResponse.json({ error: 'Failed to fetch videos' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      title, description, thumbnail, videoUrl, category, duration, isHd,
      resolution, fileSize, storageProvider, storageKey, hlsUrl, durationSeconds,
      qualityLevels, codec, audioCodec, frameRate, bitrate, thumbnailUrls,
    } = body

    if (!title || !videoUrl || !category) {
      return NextResponse.json({ error: 'Title, video URL, and category are required' }, { status: 400 })
    }

    const video = await db.video.create({
      data: {
        title,
        description: description || '',
        thumbnail: thumbnail || '/placeholder.jpg',
        videoUrl,
        category,
        duration: duration || '0:00',
        isHd: isHd || false,
        isPublished: body.isPublished !== false,
        resolution: resolution || '1080p',
        fileSize: fileSize || 0,
        storageProvider: storageProvider || 'local',
        storageKey: storageKey || null,
        hlsUrl: hlsUrl || null,
        durationSeconds: durationSeconds || 0,
        qualityLevels: qualityLevels || '[]',
        codec: codec || 'h264',
        audioCodec: audioCodec || 'aac',
        frameRate: frameRate || 30,
        bitrate: bitrate || 0,
        thumbnailUrls: thumbnailUrls || '[]',
      },
    })

    return NextResponse.json({ video }, { status: 201 })
  } catch (error) {
    console.error('Error creating video:', error)
    return NextResponse.json({ error: 'Failed to create video' }, { status: 500 })
  }
}
