'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Megaphone, Volume2, VolumeX, Play, Pause } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface FooterAdItem {
  id: string
  title: string
  mediaUrl: string
  thumbnailUrl?: string
  adType: 'image' | 'video' | 'gif' | 'html5'
  mediaFormat: string
  linkUrl?: string
  startDate?: string | null
  endDate?: string | null
}

interface FooterAdsProps {
  ads: FooterAdItem[]
}

// ─── Component ───────────────────────────────────────────────────────────────

export function FooterAds({ ads }: FooterAdsProps) {
  const ad = ads?.[0] ?? null

  // ── Empty State ──────────────────────────────────────────────────────────
  if (!ad) {
    return (
      <div className="w-full px-3 md:px-6 lg:px-8">
        <div
          className={`
            mx-auto max-w-[1600px]
            min-h-[80px] md:min-h-[100px] lg:min-h-[120px]
            rounded-xl
            bg-[#0a0a0a]/60 backdrop-blur-xl
            border-2 border-dashed border-white/10
            flex flex-col items-center justify-center gap-1
            select-none
          `}
        >
          <Megaphone className="h-8 w-8 text-white/15" />
          <span className="text-white/20 text-sm font-medium">Footer Ad Space</span>
          <span className="text-white/10 text-xs">Advertise here</span>
        </div>
      </div>
    )
  }

  return <FooterAdCard ad={ad} />
}

// ─── Ad Card ─────────────────────────────────────────────────────────────────

function FooterAdCard({ ad }: { ad: FooterAdItem }) {
  const [isMuted, setIsMuted] = useState(true)
  const [isPaused, setIsPaused] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const impressionFired = useRef(false)

  // ── Impression tracking (fire once) ─────────────────────────────────────
  useEffect(() => {
    if (impressionFired.current) return
    impressionFired.current = true

    fetch('/api/footer-ads', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: ad.id, incrementImpressions: true }),
    }).catch(() => {
      // Silently fail — ad tracking should not break the UI
    })
  }, [ad.id])

  // ── Click tracking ──────────────────────────────────────────────────────
  const handleClick = useCallback(() => {
    fetch('/api/footer-ads', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: ad.id, incrementClicks: true }),
    }).catch(() => {
      // Silently fail
    })

    if (ad.linkUrl) {
      window.open(ad.linkUrl, '_blank', 'noopener,noreferrer')
    }
  }, [ad.id, ad.linkUrl])

  // ── Video controls ──────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted
      setIsMuted(videoRef.current.muted)
    }
  }, [])

  const togglePause = useCallback(() => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play()
        setIsPaused(false)
      } else {
        videoRef.current.pause()
        setIsPaused(true)
      }
    }
  }, [])

  // ── Media renderer ──────────────────────────────────────────────────────
  const renderMedia = () => {
    switch (ad.adType) {
      case 'video':
        return (
          <div className="relative w-full h-full flex items-center justify-center">
            <video
              ref={videoRef}
              src={ad.mediaUrl}
              poster={ad.thumbnailUrl}
              autoPlay
              muted
              loop
              playsInline
              className={`
                w-full
                max-h-[120px] md:max-h-[150px] lg:max-h-[180px]
                object-contain
                will-change-transform
                rounded-lg
              `}
              preload="metadata"
            >
              <track kind="captions" />
            </video>

            {/* Controls overlay — hidden on mobile */}
            <div className="hidden md:flex absolute bottom-2 right-2 items-center gap-1.5 z-10">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  toggleMute()
                }}
                className={`
                  flex items-center justify-center
                  h-7 w-7 rounded-md
                  bg-white/10 backdrop-blur-md
                  hover:bg-white/20
                  border border-white/10
                  transition-colors duration-200
                `}
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? (
                  <VolumeX className="h-3.5 w-3.5 text-white/80" />
                ) : (
                  <Volume2 className="h-3.5 w-3.5 text-white/80" />
                )}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  togglePause()
                }}
                className={`
                  flex items-center justify-center
                  h-7 w-7 rounded-md
                  bg-white/10 backdrop-blur-md
                  hover:bg-white/20
                  border border-white/10
                  transition-colors duration-200
                `}
                aria-label={isPaused ? 'Play' : 'Pause'}
              >
                {isPaused ? (
                  <Play className="h-3.5 w-3.5 text-white/80" />
                ) : (
                  <Pause className="h-3.5 w-3.5 text-white/80" />
                )}
              </button>
            </div>
          </div>
        )

      case 'image':
        return (
          <img
            src={ad.mediaUrl}
            alt={ad.title}
            loading="lazy"
            className={`
              w-full
              max-h-[120px] md:max-h-[150px] lg:max-h-[180px]
              object-contain
              rounded-lg
              will-change-transform
            `}
            draggable={false}
          />
        )

      case 'gif':
        return (
          <img
            src={ad.mediaUrl}
            alt={ad.title}
            loading="lazy"
            className={`
              w-full
              max-h-[120px] md:max-h-[150px] lg:max-h-[180px]
              object-contain
              rounded-lg
              will-change-transform
            `}
            draggable={false}
          />
        )

      case 'html5':
        return (
          <iframe
            src={ad.mediaUrl}
            sandbox="allow-scripts allow-same-origin"
            className={`
              w-full
              max-h-[120px] md:max-h-[150px] lg:max-h-[180px]
              border-0 rounded-lg
              will-change-transform
            `}
            title={ad.title}
            loading="lazy"
          />
        )

      default:
        return null
    }
  }

  return (
    <div className="w-full px-3 md:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        whileHover={{ boxShadow: '0 0 25px rgba(255,30,30,0.1)' }}
        onClick={ad.adType !== 'html5' ? handleClick : undefined}
        className={`
          relative
          mx-auto max-w-[1600px]
          min-h-[80px] md:min-h-[100px] lg:min-h-[120px]
          rounded-xl
          border border-[#ff1e1e]/10
          bg-[#0B0B0F]/80 backdrop-blur-xl
          shadow-[0_0_20px_rgba(255,30,30,0.05)]
          p-3 md:p-4
          overflow-hidden
          ${ad.adType !== 'html5' && ad.linkUrl ? 'cursor-pointer' : ''}
          will-change-transform
        `}
      >
        {/* AD badge */}
        <div className="absolute top-2 right-2 z-10">
          <motion.span
            animate={{ opacity: [1, 0.6, 1] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            className="
              inline-block
              bg-[#ff1e1e]/10 text-[#ff1e1e]
              text-[10px] font-bold
              px-2 py-0.5 rounded
              select-none
            "
          >
            AD
          </motion.span>
        </div>

        {/* Media content */}
        <div className="w-full h-full flex items-center justify-center">
          {renderMedia()}
        </div>
      </motion.div>
    </div>
  )
}
