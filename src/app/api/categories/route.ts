import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const categories = await db.category.findMany({
      orderBy: { order: 'asc' },
    })

    const videoCounts = await db.video.groupBy({
      by: ['category'],
      _count: { category: true },
      _sum: { views: true },
    })
    const countMap = new Map<string, { videoCount: number; viewCount: number }>()
    for (const v of videoCounts) {
      countMap.set(v.category, { videoCount: v._count.category, viewCount: v._sum.views || 0 })
    }

    const enriched = categories.map((c) => ({
      ...c,
      videoCount: countMap.get(c.name)?.videoCount || 0,
      viewCount: countMap.get(c.name)?.viewCount || 0,
    }))

    return NextResponse.json({ categories: enriched }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    })
  } catch (error) {
    console.error('Error fetching categories:', error)
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, slug, icon, order } = body

    if (!name || !slug) {
      return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 })
    }

    const category = await db.category.create({
      data: {
        name,
        slug,
        icon: icon || null,
        order: order || 0,
      },
    })

    return NextResponse.json({ category })
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Category with this name or slug already exists' }, { status: 409 })
    }
    console.error('Error creating category:', error)
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, name, slug, icon, order } = body

    if (!id) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 })
    }

    const category = await db.category.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(slug && { slug }),
        ...(icon !== undefined && { icon }),
        ...(order !== undefined && { order }),
      },
    })

    return NextResponse.json({ category })
  } catch (error) {
    console.error('Error updating category:', error)
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 })
    }

    await db.category.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting category:', error)
    const message = error?.meta?.cause || error?.message || 'Failed to delete category'
    return NextResponse.json({ error: message, details: error?.meta || error?.message }, { status: 500 })
  }
}
