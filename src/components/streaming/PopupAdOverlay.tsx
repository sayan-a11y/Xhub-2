'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Megaphone, ExternalLink, Clock } from 'lucide-react'
import { useAdsManager, type AdItem } from '@/hooks/useAdsManager'

// ─── Types ───────────────────────────────────────────────────────────────────

interface PopupAdOverlayProps {
  /** Minimum time (ms) before showing the first popup after mount. Default: 5000 */
  initialDelay?: number
  /** Minimum time (ms) between popup displays. Default: 30000 (30s) */
  cooldownPeriod?: number
  /** Whether to suppress popups entirely. Default: false */
  disabled?: boolean
}

// ─── Schedule helper ─────────────────────────────────────────────────────────

function isWithinSchedule(ad: { isActive: boolean; startDate?: string | null; endDate?: string | null }): boolean {
  if (!ad.isActive) return false
  const now = new Date()
  if (ad.startDate && new Date(ad.startDate) > now) return false
  if (ad.endDate && new Date(ad.endDate) < now) return false
  return true
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PopupAdOverlay({
  initialDelay = 5000,
  cooldownPeriod = 30000,
  disabled = false,
}: PopupAdOverlayProps) {
  const { ads, loading } = useAdsManager({ type: 'popup' })

  // Filter to active, scheduled popup ads
  const activePopupAds = useMemo(
    () => ads.filter(isWithinSchedule),
    [ads]
  )

  // Current displayed ad
  const [currentAd, setCurrentAd] = useState<AdItem | null>(null)
  // Whether popup is visible
  const [isVisible, setIsVisible] = useState(false)
  // Track which ads were shown this session (sessionStorage key)
  const shownAdsRef = useRef<Set<string>>(new Set())
  const lastShownTimeRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load previously shown ad IDs from sessionStorage
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('xtube_popup_shown')
      if (stored) {
        const ids: string[] = JSON.parse(stored)
        ids.forEach((id) => shownAdsRef.current.add(id))
      }
    } catch {}
  }, [])

  // Save shown ad IDs to sessionStorage
  const markAsShown = useCallback((id: string) => {
    shownAdsRef.current.add(id)
    try {
      sessionStorage.setItem('xtube_popup_shown', JSON.stringify([...shownAdsRef.current]))
    } catch {}
  }, [])

  // Pick the next ad to show (prioritize not-yet-shown, then least-recently-shown)
  const pickNextAd = useCallback((): AdItem | null => {
    if (!activePopupAds.length) return null

    // Prefer ads not yet shown this session
    const unshown = activePopupAds.filter((ad) => !shownAdsRef.current.has(ad.id))
    if (unshown.length) return unshown[Math.floor(Math.random() * unshown.length)]

    // Fallback: pick random from all active ads (with cooldown respect)
    return activePopupAds[Math.floor(Math.random() * activePopupAds.length)]
  }, [activePopupAds])

  // Show a popup ad
  const showNext = useCallback(() => {
    if (disabled) return
    const now = Date.now()
    if (now - lastShownTimeRef.current < cooldownPeriod) return

    const ad = pickNextAd()
    if (!ad) return

    setCurrentAd(ad)
    setIsVisible(true)
    lastShownTimeRef.current = now
    markAsShown(ad.id)

    // Track impression
    fetch('/api/ads', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: ad.id, incrementImpressions: true }),
    }).catch(() => {})
  }, [disabled, cooldownPeriod, pickNextAd, markAsShown])

  // Initial delay before first popup
  useEffect(() => {
    if (disabled || loading || !activePopupAds.length) return

    timerRef.current = setTimeout(() => {
      showNext()
    }, initialDelay)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [disabled, loading, activePopupAds.length, initialDelay, showNext])

  // Dismiss handler
  const handleDismiss = useCallback(() => {
    setIsVisible(false)
    // Schedule next popup after cooldown
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      showNext()
    }, cooldownPeriod)
  }, [cooldownPeriod, showNext])

  // Click handler (track click + navigate)
  const handleClick = useCallback(() => {
    if (!currentAd) return

    fetch('/api/ads', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: currentAd.id, incrementClicks: true }),
    }).catch(() => {})

    if (currentAd.linkUrl) {
      window.open(currentAd.linkUrl, '_blank', 'noopener,noreferrer')
    }

    handleDismiss()
  }, [currentAd, handleDismiss])

  // Don't render anything if no ads or disabled
  if (disabled || !activePopupAds.length) return null

  return (
    <AnimatePresence>
      {isVisible && currentAd && (
        <motion.div
          key={`popup-${currentAd.id}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[55] flex items-center justify-center p-4"
          onClick={handleDismiss} // Click outside to dismiss
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Popup Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()} // Prevent dismiss when clicking card
            className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#0B0B0F] shadow-2xl shadow-black/50"
          >
            {/* Top accent line */}
            <div className="absolute left-0 top-0 h-[2px] w-full bg-gradient-to-r from-[#ff1e1e] to-transparent" />

            {/* Close button */}
            <button
              onClick={handleDismiss}
              className="absolute right-3 top-3 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-white/5 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Close popup ad"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Sponsored badge */}
            <div className="absolute left-3 top-3 z-20 flex items-center gap-1.5 rounded-full bg-[#ff1e1e]/10 border border-[#ff1e1e]/20 px-2.5 py-1">
              <Megaphone className="h-3 w-3 text-[#ff1e1e]" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#ff1e1e]">Sponsored</span>
            </div>

            {/* Ad Image */}
            {currentAd.imageUrl && (
              <div className="relative aspect-video w-full overflow-hidden bg-[#0a0a0a]">
                <img
                  src={currentAd.imageUrl}
                  alt={currentAd.title}
                  className="h-full w-full object-cover"
                  loading="eager"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B0F] via-transparent to-transparent" />
              </div>
            )}

            {/* Ad Content */}
            <div className="p-5">
              {/* Scheduled badge */}
              {currentAd.startDate && new Date(currentAd.startDate) > new Date() && (
                <div className="mb-2 flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                    <Clock className="h-2.5 w-2.5" />
                    Scheduled
                  </span>
                </div>
              )}

              <h3 className="text-lg font-bold text-white mb-1.5">{currentAd.title}</h3>

              {/* CTA Button */}
              {currentAd.linkUrl && (
                <motion.button
                  whileHover={{ scale: 1.02, boxShadow: '0 0 20px rgba(255,30,30,0.4)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleClick}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#ff1e1e] to-[#cc181e] px-5 py-3 text-sm font-semibold text-white shadow-[0_0_15px_rgba(255,30,30,0.3)] transition-all hover:from-[#ff2e2e] hover:to-[#dd282e]"
                >
                  <ExternalLink className="h-4 w-4" />
                  Learn More
                </motion.button>
              )}

              {/* Dismiss link */}
              <button
                onClick={handleDismiss}
                className="mt-3 w-full text-center text-xs text-white/30 transition-colors hover:text-white/50"
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
