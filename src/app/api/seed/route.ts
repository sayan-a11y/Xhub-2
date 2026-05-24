import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// This endpoint ONLY creates essential system users and categories,
// and enables Supabase Realtime configuration.
export async function POST() {
  try {
    // 1. Seed admin user only (essential for admin panel login)
    await db.user.upsert({
      where: { id: 'admin-user' },
      update: {},
      create: {
        id: 'admin-user',
        username: 'Admin',
        email: 'admin@xtube.com',
        role: 'admin',
      },
    })

    // 2. Seed default guest user
    await db.user.upsert({
      where: { id: 'default-user' },
      update: {},
      create: {
        id: 'default-user',
        username: 'Guest',
        email: 'guest@xtube.com',
      },
    })

    // 3. Seed default categories
    const defaultCategories = [
      { name: 'Trending', slug: 'trending', icon: 'flame', order: 1 },
      { name: 'Popular', slug: 'popular', icon: 'sparkles', order: 2 },
      { name: 'Gaming', slug: 'gaming', icon: 'gamepad', order: 3 },
      { name: 'Music', slug: 'music', icon: 'music', order: 4 },
      { name: 'Education', slug: 'education', icon: 'graduation', order: 5 },
      { name: 'Fitness', slug: 'fitness', icon: 'dumbbell', order: 6 },
      { name: 'Travel', slug: 'travel', icon: 'plane', order: 7 },
      { name: 'News', slug: 'news', icon: 'newspaper', order: 8 },
    ]

    for (const cat of defaultCategories) {
      await db.category.upsert({
        where: { slug: cat.slug },
        update: {},
        create: {
          name: cat.name,
          slug: cat.slug,
          icon: cat.icon,
          order: cat.order,
        },
      })
    }

    // 4. Configure Supabase Realtime via SQL raw queries
    const tables = ['Video', 'Ad', 'HeroAd', 'FooterAd', 'Category']

    // Try to create the publication if it doesn't exist
    try {
      await db.$executeRawUnsafe(`CREATE PUBLICATION supabase_realtime`)
    } catch {
      // Ignore if publication already exists
    }

    for (const table of tables) {
      try {
        // Enable replica identity full so deletions contain the full old record
        await db.$executeRawUnsafe(`ALTER TABLE "${table}" REPLICA IDENTITY FULL`)
      } catch (err) {
        console.warn(`Could not set REPLICA IDENTITY FULL on "${table}":`, err)
      }

      try {
        // Add table to realtime publication
        await db.$executeRawUnsafe(`ALTER PUBLICATION supabase_realtime ADD TABLE "${table}"`)
      } catch (err) {
        // Ignore if already added
        console.log(`Table "${table}" replication might already be configured:`, err)
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'System users initialized, default categories seeded, and Supabase Realtime configured.' 
    })
  } catch (error) {
    console.error('Error initializing system:', error)
    return NextResponse.json({ error: 'Failed to initialize system' }, { status: 500 })
  }
}
