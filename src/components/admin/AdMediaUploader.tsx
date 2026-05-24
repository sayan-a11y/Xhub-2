'use client'

import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CloudUpload,
  CheckCircle2,
  X,
  Loader2,
  Image as ImageIcon,
  Play,
  Film,
  RefreshCw,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type UploadedAdMedia = {
  url: string
  thumbnailUrl: string | null   // auto-generated from video frame or image itself
  thumbnailFile: File | null    // thumbnail file (uploaded separately for videos)
  fileName: string
  mimeType: string
  size: number
  isVideo: boolean
  isGif: boolean
  duration?: number             // seconds, for video ads
  width?: number
  height?: number
}

export type AdUploadStage = 'idle' | 'uploading' | 'generating_thumb' | 'success' | 'error'

interface AdMediaUploaderProps {
  /** Called when media is fully uploaded + thumbnail ready */
  onMediaReady: (media: UploadedAdMedia) => void
  /** Called when user resets / removes the uploaded file */
  onReset?: () => void
  /** Currently uploaded media (for edit mode) */
  existingMedia?: { url: string; thumbnailUrl?: string | null; isVideo?: boolean } | null
  /** Accent color class (e.g. 'text-[#ff1e1e]', 'border-[#ff1e1e]') */
  accentColor?: string
  /** Border/ring color for active drag-over state */
  accentBorderColor?: string
  /** Accepted file types */
  accept?: string
  /** Upload endpoint category label */
  uploadCategory?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes >= 1_073_741_824) return (bytes / 1_073_741_824).toFixed(2) + ' GB'
  if (bytes >= 1_048_576) return (bytes / 1_048_576).toFixed(1) + ' MB'
  if (bytes >= 1_024) return (bytes / 1_024).toFixed(1) + ' KB'
  return bytes + ' B'
}

async function generateVideoThumbnail(
  file: File,
  seekTime: number = 0.25
): Promise<{ dataUrl: string; thumbFile: File; duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    const url = URL.createObjectURL(file)

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(video.duration * seekTime, 5)
    }

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas')
        const maxW = 640
        const scale = maxW / video.videoWidth
        canvas.width = maxW
        canvas.height = Math.floor(video.videoHeight * scale)

        const ctx = canvas.getContext('2d')
        if (!ctx) { URL.revokeObjectURL(url); reject(new Error('Canvas not supported')); return }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(url)
          if (!blob) { reject(new Error('Thumbnail generation failed')); return }
          const dataUrl = URL.createObjectURL(blob)
          const thumbFile = new File([blob], `thumb_${Date.now()}.jpg`, { type: 'image/jpeg' })
          resolve({ dataUrl, thumbFile, duration: video.duration, width: video.videoWidth, height: video.videoHeight })
        }, 'image/jpeg', 0.85)
      } catch (err) {
        URL.revokeObjectURL(url)
        reject(err)
      }
    }

    video.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load video')) }
    video.src = url
  })
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AdMediaUploader({
  onMediaReady,
  onReset,
  existingMedia,
  accentColor = 'text-[#ff1e1e]',
  accentBorderColor = 'border-[#ff1e1e]',
  accept = 'image/jpeg,image/png,image/webp,image/gif,image/svg+xml,video/mp4,video/webm,video/quicktime',
  uploadCategory = 'ads',
}: AdMediaUploaderProps) {
  const [stage, setStage] = useState<AdUploadStage>(existingMedia ? 'success' : 'idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [media, setMedia] = useState<UploadedAdMedia | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const accentRing = accentBorderColor.replace('border-', '')

  const handleFile = useCallback(async (file: File) => {
    setStage('uploading')
    setProgress(0)
    setError('')
    setMedia(null)

    const isVideo = file.type.startsWith('video/')
    const isGif = file.type === 'image/gif'

    try {
      // ── Step 1: Upload file (chunked for video, simple XHR for images) ──
      let uploadResult: { url: string; fileName?: string; mimeType?: string; size?: number }

      if (isVideo) {
        // Chunked multipart upload for large video files
        const initRes = await fetch('/api/r2?action=init-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: file.name, fileSize: file.size, mimeType: file.type || 'video/mp4', category: 'video' }),
        })
        if (!initRes.ok) {
          const err = await initRes.json().catch(() => ({ error: 'Init failed' }))
          throw new Error(err.details || err.error || 'Failed to initialize upload')
        }
        const { uploadId, key, parts, provider } = await initRes.json()
        const CHUNK_SIZE = 10 * 1024 * 1024
        const uploadedParts: Array<{ partNumber: number; etag: string }> = []
        const totalParts = parts.length
        let completed = 0
        const queue = [...parts]

        const worker = async () => {
          while (queue.length > 0) {
            const part = queue.shift()
            if (!part) break
            const start = (part.partNumber - 1) * CHUNK_SIZE
            const end = Math.min(file.size, start + CHUNK_SIZE)
            const chunk = file.slice(start, end)
            let etag = ''
            for (let a = 0; a < 3; a++) {
              try {
                const hdrs: Record<string, string> = {}
                if (provider === 'r2') hdrs['Content-Type'] = file.type || 'video/mp4'
                else hdrs['Content-Type'] = 'application/octet-stream'
                const res = await fetch(part.uploadUrl, { method: 'PUT', headers: hdrs, body: chunk })
                if (!res.ok) throw new Error(`Part ${part.partNumber} status ${res.status}`)
                const eh = res.headers.get('ETag')
                if (!eh && provider === 'local') {
                  const b = await res.json(); etag = b.etag
                } else if (eh) { etag = eh.replace(/"/g, '') }
                else throw new Error(`No ETag part ${part.partNumber}`)
                break
              } catch (e) { if (a >= 2) throw e; await new Promise(r => setTimeout(r, 1000)) }
            }
            uploadedParts.push({ partNumber: part.partNumber, etag })
            completed++
            setProgress(30 + (completed / totalParts) * 50)
          }
        }
        await Promise.all(Array.from({ length: Math.min(6, totalParts) }, () => worker()))

        const completeRes = await fetch('/api/r2?action=complete-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uploadId, key, parts: uploadedParts.sort((a, b) => a.partNumber - b.partNumber) }),
        })
        if (!completeRes.ok) {
          const err = await completeRes.json().catch(() => ({ error: 'Complete failed' }))
          throw new Error(err.details || err.error || 'Failed to assemble file')
        }
        const result = await completeRes.json()
        uploadResult = { url: result.url, fileName: file.name, mimeType: file.type, size: result.size || file.size }
        setProgress(80)
      } else {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('category', uploadCategory)

        const xhr = new XMLHttpRequest()
        uploadResult = await new Promise((resolve, reject) => {
          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) setProgress((e.loaded / e.total) * 90)
          })
          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try { resolve(JSON.parse(xhr.responseText)) } catch { reject(new Error('Invalid response')) }
            } else {
              reject(new Error(`Upload failed (${xhr.status})`))
            }
          })
          xhr.addEventListener('error', () => reject(new Error('Upload failed')))
          xhr.open('POST', '/api/upload')
          xhr.send(formData)
        })
        setProgress(90)
      }

      // ── Step 2: Generate thumbnail ─────────────────────────────────────────
      let thumbnailUrl: string | null = null
      let thumbnailFile: File | null = null
      let duration: number | undefined
      let width: number | undefined
      let height: number | undefined

      if (isVideo) {
        setStage('generating_thumb')
        try {
          const result = await generateVideoThumbnail(file)
          thumbnailUrl = result.dataUrl
          thumbnailFile = result.thumbFile
          duration = result.duration
          width = result.width
          height = result.height

          // Upload thumbnail to server
          const thumbForm = new FormData()
          thumbForm.append('file', result.thumbFile)
          thumbForm.append('category', 'thumbnail')
          const thumbRes = await fetch('/api/upload', { method: 'POST', body: thumbForm })
          if (thumbRes.ok) {
            const thumbData = await thumbRes.json()
            thumbnailUrl = thumbData.url // use server URL
          }
        } catch (thumbErr) {
          console.warn('Thumbnail generation failed, using placeholder:', thumbErr)
          thumbnailUrl = null
        }
      } else if (!isGif) {
        // For images: the image itself is the thumbnail
        thumbnailUrl = uploadResult.url
      }

      setProgress(100)

      const result: UploadedAdMedia = {
        url: uploadResult.url,
        thumbnailUrl,
        thumbnailFile,
        fileName: uploadResult.fileName || file.name,
        mimeType: uploadResult.mimeType || file.type,
        size: uploadResult.size || file.size,
        isVideo,
        isGif,
        duration,
        width,
        height,
      }

      setMedia(result)
      setStage('success')
      onMediaReady(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      setStage('error')
    }
  }, [uploadCategory, onMediaReady])

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true) }, [])
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false) }, [])
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const files = e.dataTransfer.files
    if (files.length > 0) handleFile(files[0])
  }, [handleFile])

  const handleReset = useCallback(() => {
    setStage('idle')
    setProgress(0)
    setError('')
    setMedia(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    onReset?.()
  }, [onReset])

  const previewUrl = media?.thumbnailUrl || existingMedia?.thumbnailUrl || existingMedia?.url || null
  const isExistingVideo = existingMedia?.isVideo

  return (
    <div className="space-y-3">
      <AnimatePresence mode="wait">
        {/* ── IDLE: Drop zone ── */}
        {stage === 'idle' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative flex min-h-[160px] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed transition-all duration-200 ${
              isDragOver
                ? `${accentBorderColor} bg-white/5 shadow-[0_0_20px_rgba(255,30,30,0.1)]`
                : 'border-white/10 bg-[#0a0a0a]/60 hover:border-white/20'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={accept}
              className="hidden"
              onChange={(e) => { if (e.target.files?.length) handleFile(e.target.files[0]) }}
            />
            <motion.div
              animate={isDragOver ? { scale: 1.1, y: -4 } : { scale: 1, y: 0 }}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5"
            >
              <CloudUpload className={`h-6 w-6 ${accentColor}`} />
            </motion.div>
            <div className="text-center">
              <p className="text-sm font-medium text-white">Drag &amp; drop your ad media here</p>
              <p className="mt-0.5 text-xs text-white/40">
                or <span className={`${accentColor} underline underline-offset-2`}>browse files</span>
              </p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-white/25">JPG, PNG, WEBP, SVG, GIF, MP4, WEBM, MOV</p>
              <p className="text-[10px] text-white/15">Auto-generates thumbnail for video ads</p>
            </div>
          </motion.div>
        )}

        {/* ── UPLOADING: Progress ── */}
        {stage === 'uploading' && (
          <motion.div
            key="uploading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-xl border border-white/5 bg-[#0a0a0a]/60 p-4"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-white">Uploading media...</span>
              <span className={`text-xs font-bold ${accentColor}`}>{Math.round(progress)}%</span>
            </div>
            <div className="relative mb-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
                className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-[#ff1e1e] to-red-400"
              />
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
                className="absolute left-0 top-0 h-full rounded-full bg-[#ff1e1e] blur-sm opacity-30"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-white/40">
              <Loader2 className={`h-3 w-3 animate-spin ${accentColor}`} />
              <span>Uploading to storage...</span>
            </div>
          </motion.div>
        )}

        {/* ── GENERATING THUMBNAIL ── */}
        {stage === 'generating_thumb' && (
          <motion.div
            key="gen-thumb"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-xl border border-white/5 bg-[#0a0a0a]/60 p-4"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-white">Generating thumbnail...</span>
              <span className={`text-xs font-bold ${accentColor}`}>{Math.round(progress)}%</span>
            </div>
            <div className="relative mb-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <motion.div
                initial={{ width: `${progress}%` }}
                animate={{ width: '95%' }}
                transition={{ duration: 1.5, ease: 'easeOut' }}
                className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-white/40">
              <Film className="h-3 w-3 animate-pulse text-amber-400" />
              <span>Extracting frame from video...</span>
            </div>
          </motion.div>
        )}

        {/* ── ERROR ── */}
        {stage === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/5 p-3"
          >
            <X className="h-4 w-4 flex-shrink-0 text-red-400 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-white">Upload Failed</p>
              <p className="text-[10px] text-white/40">{error}</p>
            </div>
            <button onClick={handleReset} className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300">
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          </motion.div>
        )}

        {/* ── SUCCESS: Preview Card ── */}
        {stage === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            {/* File info row */}
            <div className="flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-white">
                  {media?.fileName || existingMedia?.url?.split('/').pop() || 'Media uploaded'}
                </p>
                <p className="text-[10px] text-white/35">
                  {media ? `${formatSize(media.size)} • ${media.mimeType}` : 'Existing media'}
                  {media?.duration ? ` • ${Math.round(media.duration)}s video` : ''}
                </p>
              </div>
              {!existingMedia && (
                <button onClick={handleReset} className={`text-xs ${accentColor} hover:opacity-70 transition-opacity`}>
                  Change
                </button>
              )}
            </div>

            {/* ── Thumbnail Preview ── */}
            {(previewUrl || media?.isVideo) && (
              <div className="overflow-hidden rounded-xl border border-white/8 bg-black">
                {/* Thumbnail strip header */}
                <div className="flex items-center gap-2 border-b border-white/5 px-3 py-2">
                  {media?.isVideo || isExistingVideo ? (
                    <Film className="h-3.5 w-3.5 text-amber-400" />
                  ) : (
                    <ImageIcon className="h-3.5 w-3.5 text-sky-400" />
                  )}
                  <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">
                    {media?.isVideo || isExistingVideo ? 'Video Ad Preview' : 'Image Ad Preview'}
                  </span>
                  {media?.isVideo && media.thumbnailUrl && (
                    <span className="ml-auto text-[9px] text-amber-400/70">Auto-generated thumbnail</span>
                  )}
                </div>

                {/* Main preview */}
                <div className="relative aspect-video overflow-hidden bg-[#080808]">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Ad preview thumbnail"
                      className="h-full w-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                      <Film className="h-8 w-8 text-white/10" />
                      <p className="text-[10px] text-white/20">Thumbnail not available</p>
                    </div>
                  )}

                  {/* Video play overlay badge */}
                  {(media?.isVideo || isExistingVideo) && previewUrl && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm border border-white/10">
                        <Play className="h-4 w-4 text-white ml-0.5" fill="white" />
                      </div>
                    </div>
                  )}

                  {/* Bottom info bar */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {media?.isVideo || isExistingVideo ? (
                          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-amber-400">VIDEO</span>
                        ) : (
                          <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-sky-400">IMAGE</span>
                        )}
                        {media?.duration && (
                          <span className="text-[9px] text-white/40">{Math.round(media.duration)}s</span>
                        )}
                      </div>
                      {media && (
                        <span className="text-[9px] text-white/30">{formatSize(media.size)}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Thumbnail strip for videos (multi-frame preview) */}
                {(media?.isVideo || isExistingVideo) && previewUrl && (
                  <div className="border-t border-white/5 p-2">
                    <p className="mb-1.5 text-[9px] font-medium text-white/30 uppercase tracking-wider">Thumbnail Strip</p>
                    <div className="flex gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div
                          key={i}
                          className={`relative flex-1 aspect-video overflow-hidden rounded bg-black/60 border transition-all cursor-pointer ${
                            i === 0
                              ? 'border-white/30 ring-1 ring-white/20'
                              : 'border-white/5 opacity-40 hover:opacity-70 hover:border-white/20'
                          }`}
                        >
                          <img
                            src={previewUrl}
                            alt={`Frame ${i + 1}`}
                            className="h-full w-full object-cover"
                            style={{ filter: i === 0 ? 'none' : `brightness(${0.5 + i * 0.1})` }}
                          />
                          {i === 0 && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <CheckCircle2 className="h-3 w-3 text-white/70" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="mt-1.5 text-[9px] text-white/20">Click a frame to set as thumbnail</p>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
