'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import {
  createClient,
  SupabaseClient,
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from '@supabase/supabase-js'

// ── Client singleton (browser only) ──────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const globalForSupabase = globalThis as unknown as {
  realtimeClient: SupabaseClient | undefined
}

function getBrowserClient(): SupabaseClient {
  if (!globalForSupabase.realtimeClient) {
    globalForSupabase.realtimeClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      realtime: {
        params: { eventsPerSecond: 10 },
      },
    })
  }
  return globalForSupabase.realtimeClient
}

// ── Context ──────────────────────────────────────────────────────

const RealtimeContext = createContext<SupabaseClient | null>(null)

function useSupabase(): SupabaseClient {
  const ctx = useContext(RealtimeContext)
  if (!ctx) throw new Error('useSupabase must be used within a <RealtimeProvider>')
  return ctx
}

// ── Provider ─────────────────────────────────────────────────────

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const client = useMemo(() => getBrowserClient(), [])
  return <RealtimeContext.Provider value={client}>{children}</RealtimeContext.Provider>
}

// ── Types ────────────────────────────────────────────────────────

interface RealtimeOptions {
  filter?: string
  schema?: string
  /** Polling interval (ms) when realtime fails. Default: 5000 */
  pollInterval?: number
}

interface UseRealtimeResult<T> {
  data: T[]
  isLoading: boolean
  error: string | null
}

// ── useRealtimeSubscription ──────────────────────────────────────

export function useRealtimeSubscription<T extends Record<string, unknown> = Record<string, unknown>>(
  table: string,
  options: RealtimeOptions = {}
): UseRealtimeResult<T> {
  const { filter, schema = 'public', pollInterval = 5000 } = options
  const client = useSupabase()

  const [data, setData] = useState<T[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Throttle state updates to max once per second
  const lastEmit = useRef(0)
  const pendingRef = useRef<T[]>([])
  const rafRef = useRef<number | null>(null)

  const throttledSet = useCallback((next: T[]) => {
    const now = Date.now()
    if (now - lastEmit.current >= 1000) {
      lastEmit.current = now
      setData(next)
    } else {
      pendingRef.current = next
      if (!rafRef.current) {
        const delay = 1000 - (now - lastEmit.current)
        setTimeout(() => {
          lastEmit.current = Date.now()
          setData(pendingRef.current)
          rafRef.current = null
        }, delay)
      }
    }
  }, [])

  // Initial fetch + realtime subscription
  useEffect(() => {
    let cancelled = false
    let channel: RealtimeChannel | null = null
    let pollTimer: ReturnType<typeof setInterval> | null = null
    let realtimeOk = true

    const fetchData = async () => {
      try {
        let query = client.from(table).select('*')
        if (filter) {
          // Parse simple "col=eq.val" filter
          const [col, rest] = filter.split('=')
          const [op, val] = rest.split('.')
          query = query.filter(col, op, val) as unknown as typeof query
        }
        const { data: rows, error: fetchErr } = await query
        if (fetchErr) throw fetchErr
        if (!cancelled) {
          setData((rows ?? []) as T[])
          setIsLoading(false)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Fetch failed')
          setIsLoading(false)
        }
      }
    }

    const subscribe = () => {
      const channelName = `rt:${table}:${filter ?? 'all'}`
      channel = client
        .channel(channelName)
        .on<T>(
          'postgres_changes',
          { event: '*', schema, table, filter },
          (payload: RealtimePostgresChangesPayload<T>) => {
            realtimeOk = true
            if (pollTimer) {
              clearInterval(pollTimer)
              pollTimer = null
            }
            setData((prev) => {
              const next = [...prev]
              if (payload.eventType === 'INSERT') {
                next.push(payload.new)
              } else if (payload.eventType === 'UPDATE') {
                const idx = next.findIndex((r) => (r as Record<string, unknown>).id === (payload.old as Record<string, unknown>).id)
                if (idx !== -1) next[idx] = payload.new
              } else if (payload.eventType === 'DELETE') {
                const delIdx = next.findIndex((r) => (r as Record<string, unknown>).id === (payload.old as Record<string, unknown>).id)
                if (delIdx !== -1) next.splice(delIdx, 1)
              }
              throttledSet(next)
              return prev // actual update via throttledSet
            })
          }
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            realtimeOk = false
            setError('Realtime connection lost — falling back to polling')
            if (!pollTimer) {
              pollTimer = setInterval(fetchData, pollInterval)
            }
          }
        })
    }

    fetchData().then(subscribe)

    return () => {
      cancelled = true
      if (channel) client.removeChannel(channel)
      if (pollTimer) clearInterval(pollTimer)
      if (rafRef.current) {
        clearTimeout(rafRef.current)
        rafRef.current = null
      }
    }
  }, [table, filter, schema, pollInterval, client, throttledSet])

  return { data, isLoading, error }
}

// ── useRealtimePresence ──────────────────────────────────────────

interface PresenceState {
  [key: string]: { user_id?: string; name?: string; online_at: string }[]
}

interface UsePresenceResult {
  onlineUsers: number
  track: (state: Record<string, unknown>) => void
  untrack: () => void
}

export function useRealtimePresence(channelName: string): UsePresenceResult {
  const client = useSupabase()
  const [onlineUsers, setOnlineUsers] = useState(0)
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    const channel = client.channel(channelName, {
      config: { presence: { key: '' } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceState>() as unknown as PresenceState
        setOnlineUsers(Object.keys(state).length)
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      client.removeChannel(channel)
      channelRef.current = null
    }
  }, [client, channelName])

  const track = useCallback((state: Record<string, unknown>) => {
    channelRef.current?.track({ ...state, online_at: new Date().toISOString() })
  }, [])

  const untrack = useCallback(() => {
    channelRef.current?.untrack()
  }, [])

  return { onlineUsers, track, untrack }
}
