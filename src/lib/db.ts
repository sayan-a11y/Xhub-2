// Fix Bun's broken DATABASE_URL resolution (auto-resolves to local SQLite)
// Must be set before PrismaClient is instantiated
if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('postgresql://')) {
  process.env.DATABASE_URL = 'postgresql://postgres.saitqrdjefqivaoeouhx:sayankarmakar159%40gmail.com@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true'
}
if (process.env.DIRECT_URL && !process.env.DIRECT_URL.startsWith('postgresql://')) {
  process.env.DIRECT_URL = 'postgresql://postgres.saitqrdjefqivaoeouhx:sayankarmakar159%40gmail.com@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres'
}

import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db