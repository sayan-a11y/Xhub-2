import { NextRequest } from 'next/server'
import { handleMediaRedirect } from '@/lib/storage/media-redirect'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  return handleMediaRedirect(request, path, 'ads')
}
