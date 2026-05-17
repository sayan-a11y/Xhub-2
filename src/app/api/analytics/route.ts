import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Get overall stats
    const [
      totalVideos,
      totalViews,
      totalComments,
      totalAds,
      totalUsers,
      adStats,
      recentAnalytics,
    ] = await Promise.all([
      db.video.count(),
      db.video.aggregate({ _sum: { views: true } }),
      db.comment.count(),
      db.ad.count(),
      db.user.count(),
      db.ad.aggregate({ _sum: { clicks: true, impressions: true } }),
      db.analytics.findMany({
        select: { date: true, views: true, revenue: true, device: true },
        orderBy: { date: 'desc' },
        take: 14,
      }),
    ])

    // Calculate views over time
    const viewsByDate = recentAnalytics.reduce((acc: Record<string, number>, a) => {
      const date = new Date(a.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      acc[date] = (acc[date] || 0) + a.views
      return acc
    }, {})

    const viewsGraph = Object.entries(viewsByDate).map(([date, views]) => ({ date, views }))

    // Calculate revenue
    const totalRevenue = recentAnalytics.reduce((sum, a) => sum + a.revenue, 0)
    const revenueByDate = recentAnalytics.reduce((acc: Record<string, number>, a) => {
      const date = new Date(a.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      acc[date] = (acc[date] || 0) + a.revenue
      return acc
    }, {})

    const revenueGraph = Object.entries(revenueByDate).map(([date, revenue]) => ({ date, revenue }))

    // Device breakdown
    const deviceBreakdown = recentAnalytics.reduce((acc: Record<string, number>, a) => {
      acc[a.device] = (acc[a.device] || 0) + a.views
      return acc
    }, {})

    // Category breakdown
    const categoryStats = await db.video.groupBy({
      by: ['category'],
      _count: { id: true },
      _sum: { views: true },
    })

    return NextResponse.json({
      totalVideos,
      totalViews: totalViews._sum.views || 0,
      totalClicks: adStats._sum.clicks || 0,
      totalComments,
      totalAds,
      totalUsers,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      viewsGraph,
      revenueGraph,
      deviceBreakdown,
      categoryStats: categoryStats.map((c) => ({
        category: c.category,
        count: c._count.id,
        views: c._sum.views || 0,
      })),
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30' },
    })
  } catch (error) {
    console.error('Error fetching analytics:', error)
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}
