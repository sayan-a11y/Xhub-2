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

    const videos = await db.video.findMany({
      where,
      orderBy,
      take: limit,
      skip: offset,
    })

    const total = await db.video.count({ where })

    return NextResponse.json({ videos, total }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    })
  } catch (error) {
    console.error('Error fetching videos:', error)
    return NextResponse.json({ error: 'Failed to fetch videos' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, description, thumbnail, videoUrl, category, duration, isHd } = body

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
      },
    })

    return NextResponse.json({ video }, { status: 201 })
  } catch (error) {
    console.error('Error creating video:', error)
    return NextResponse.json({ error: 'Failed to create video' }, { status: 500 })
  }
}
