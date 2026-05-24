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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const isSupabaseConfigured = !!(SUPABASE_URL && SUPABASE_ANON_KEY)

const globalForSupabase = globalThis as unknown as {
  realtimeClient: SupabaseClient | undefined
}

function getBrowserClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null
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

function useSupabase(): SupabaseClient | null {
  const ctx = useContext(RealtimeContext)
  return ctx
}

// ── Provider ─────────────────────────────────────────────────────

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const client = useMemo(() => getBrowserClient(), [])
  // If Supabase is not configured, render children without provider (no realtime)
  if (!client) return <>{children}</>
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
  const { filter, schema = 'public' } = options
  const client = useSupabase()

  const [data, setData] = useState<T[]>([])
  const [error, setError] = useState<string | null>(null)

  // Throttle state updates to max once per 200ms
  const lastEmit = useRef(0)
  const pendingRef = useRef<T[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const throttledSet = useCallback((next: T[]) => {
    const now = Date.now()
    if (now - lastEmit.current >= 200) {
      lastEmit.current = now
      setData(next)
    } else {
      pendingRef.current = next
      if (!timerRef.current) {
        const delay = 200 - (now - lastEmit.current)
        timerRef.current = setTimeout(() => {
          lastEmit.current = Date.now()
          setData(pendingRef.current)
          timerRef.current = null
        }, delay)
      }
    }
  }, [])

  // Stable channel name — reuse not random to avoid stale subscriptions
  const channelName = useMemo(() => `rt:${table}:${filter ?? 'all'}`, [table, filter])

  // Realtime subscription only — data loading is handled by consuming hooks via API routes
  useEffect(() => {
    if (!client) return // Supabase not configured, skip realtime
    let channel: RealtimeChannel | null = null

    const subscribe = () => {
      channel = client
        .channel(channelName)
        .on<T>(
          'postgres_changes',
          { event: '*', schema, table, filter },
          (payload: RealtimePostgresChangesPayload<T>) => {
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
              return prev
            })
          }
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setError('Realtime connection lost')
          }
        })
    }

    subscribe()

    return () => {
      if (channel && client) client.removeChannel(channel)
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [table, filter, schema, client, throttledSet])

  return { data, isLoading: false, error }
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
    if (!client) return // Supabase not configured, skip presence
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
