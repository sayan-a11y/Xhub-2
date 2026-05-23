'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Film,
  Upload,
  CloudUpload,
  Play,
  Pause,
  Volume2,
  Settings,
  Maximize,
  Trash2,
  CheckCircle2,
  Link,
  Image as ImageIcon,
  Clock,
  ChevronDown,
  RefreshCw,
  Eye,
  TrendingUp,
  Radio,
  AlertCircle,
  XCircle,
  Loader2,
  FileVideo,
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'

// ─── Types ───────────────────────────────────────────────────────────────────

type UploadStage = 'idle' | 'uploading' | 'processing' | 'success' | 'error'

interface VideoMetadata {
  name: string
  size: number
  type: string
  duration: number
  width: number
  height: number
}

// ─── Thumbnail Gradients ─────────────────────────────────────────────────────

const thumbnailGradients = [
  'from-emerald-900/60 via-teal-800/40 to-cyan-900/30',
  'from-amber-900/60 via-orange-800/40 to-yellow-900/30',
  'from-rose-900/60 via-pink-800/40 to-red-900/30',
  'from-cyan-900/60 via-sky-800/40 to-blue-900/30',
  'from-violet-900/60 via-purple-800/40 to-fuchsia-900/30',
  'from-lime-900/60 via-green-800/40 to-emerald-900/30',
  'from-orange-900/60 via-red-800/40 to-amber-900/30',
  'from-pink-900/60 via-rose-800/40 to-fuchsia-900/30',
]

// ─── Quality Options ─────────────────────────────────────────────────────────

const qualityOptions = [
  { value: 'auto', label: 'Auto', desc: 'Recommended' },
  { value: '1080p', label: '1080p', desc: '' },
  { value: '2k', label: '2K', desc: '' },
  { value: '4k', label: '4K', desc: '' },
]

const categoryOptions = [
  'Travel & Nature',
  'Action',
  'Sci-Fi',
  'Gaming',
  'Sports',
  'Documentary',
  'Adventure',
  'Romance',
  'Fantasy',
  'Music',
  'Comedy',
  'Horror',
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB'
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB'
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return bytes + ' B'
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

function getResolutionLabel(w: number, h: number): string {
  if (h >= 2160) return '4K'
  if (h >= 1440) return '2K'
  if (h >= 1080) return '1080p'
  if (h >= 720) return '720p'
  if (h >= 480) return '480p'
  return `${w}×${h}`
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function VideoUploadPage() {
  // Upload state
  const [uploadStage, setUploadStage] = useState<UploadStage>('idle')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)

  // File references
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [videoMeta, setVideoMeta] = useState<VideoMetadata | null>(null)
  const [thumbnailDataUrl, setThumbnailDataUrl] = useState<string | null>(null)
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)

  // Upload result
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null)
  const [uploadedThumbnailUrl, setUploadedThumbnailUrl] = useState<string | null>(null)

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [quality, setQuality] = useState('1080p')
  const [isFeatured, setIsFeatured] = useState(false)
  const [isTrending, setIsTrending] = useState(false)
  const [isLive, setIsLive] = useState(false)

  // Publish state
  const [isPublishing, setIsPublishing] = useState(false)
  const [publishSuccess, setPublishSuccess] = useState(false)

  // Video player state
  const [isPlaying, setIsPlaying] = useState(false)

  // URL paste mode
  const [urlMode, setUrlMode] = useState(false)
  const [pastedUrl, setPastedUrl] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const thumbnailInputRef = useRef<HTMLInputElement>(null)
  const videoElementRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // ─── Extract Video Metadata & Generate Thumbnail ─────────────────────────

  const extractVideoInfo = useCallback((file: File): Promise<{ meta: VideoMetadata; thumbUrl: string; thumbFile: File }> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.muted = true
      video.playsInline = true
      videoElementRef.current = video

      const url = URL.createObjectURL(file)

      video.onloadedmetadata = () => {
        const meta: VideoMetadata = {
          name: file.name,
          size: file.size,
          type: file.type,
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
        }
        setVideoMeta(meta)

        // Auto-fill duration
        const dur = formatDuration(video.duration)
        setTitle(file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' '))
        setQuality(getResolutionLabel(video.videoWidth, video.videoHeight).toLowerCase())

        // Seek to 25% for thumbnail
        video.currentTime = Math.min(video.duration * 0.25, 5)
      }

      video.onseeked = () => {
        try {
          // Generate thumbnail using Canvas
          const canvas = document.createElement('canvas')
          const maxW = 640
          const scale = maxW / video.videoWidth
          canvas.width = maxW
          canvas.height = Math.floor(video.videoHeight * scale)
          canvasRef.current = canvas

          const ctx = canvas.getContext('2d')
          if (!ctx) {
            URL.revokeObjectURL(url)
            reject(new Error('Canvas not supported'))
            return
          }

          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

          // Convert to blob
          canvas.toBlob((blob) => {
            URL.revokeObjectURL(url)
            if (!blob) {
              reject(new Error('Thumbnail generation failed'))
              return
            }

            const thumbUrl = URL.createObjectURL(blob)
            setThumbnailDataUrl(thumbUrl)

            const thumbFile = new File([blob], `thumbnail_${Date.now()}.jpg`, { type: 'image/jpeg' })
            setThumbnailFile(thumbFile)

            resolve({ meta, thumbUrl, thumbFile })
          }, 'image/jpeg', 0.85)
        } catch (err) {
          URL.revokeObjectURL(url)
          reject(err)
        }
      }

      video.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Failed to load video'))
      }

      video.src = url
    })
  }, [])

  // ─── Upload File to Server ──────────────────────────────────────────────────

  const uploadFileToServer = useCallback(async (file: File, category: string = 'video'): Promise<{ url: string; key: string; size: number }> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('category', category)

    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    })

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: 'Upload failed' }))
      throw new Error(errData.error || 'Upload failed')
    }

    return await res.json()
  }, [])

  // ─── Handle File Selection ──────────────────────────────────────────────────

  const handleFileSelect = useCallback(async (file: File) => {
    // Reset previous state
    setUploadError('')
    setUploadStage('uploading')
    setUploadProgress(0)
    setSelectedFile(file)
    setUploadedVideoUrl(null)
    setUploadedThumbnailUrl(null)

    try {
      // Step 1: Extract video metadata & generate thumbnail
      setUploadProgress(10)
      const { meta, thumbFile } = await extractVideoInfo(file)
      setUploadProgress(30)

      // Step 2: Upload the video file
      setUploadStage('uploading')
      const videoResult = await uploadFileToServer(file, 'video')
      setUploadedVideoUrl(videoResult.url)
      setUploadProgress(70)

      // Step 3: Upload the thumbnail
      const thumbResult = await uploadFileToServer(thumbFile, 'thumbnail')
      setUploadedThumbnailUrl(thumbResult.url)
      setUploadProgress(90)

      // Step 4: Processing
      setUploadStage('processing')
      setUploadProgress(95)

      // Small delay for "processing" feel
      await new Promise(r => setTimeout(r, 800))

      setUploadProgress(100)
      setUploadStage('success')
    } catch (err: any) {
      console.error('Upload error:', err)
      setUploadError(err.message || 'Video upload failed. Please try again.')
      setUploadStage('error')
    }
  }, [extractVideoInfo, uploadFileToServer])

  // ─── Drag & Drop ───────────────────────────────────────────────────────────

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    const files = e.dataTransfer.files
    if (files.length > 0 && files[0].type.startsWith('video/')) {
      handleFileSelect(files[0])
    }
  }, [handleFileSelect])

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileSelect(files[0])
    }
  }, [handleFileSelect])

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  // ─── Handle Thumbnail Upload Manually ───────────────────────────────────────

  const handleThumbnailUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const file = files[0]
    if (!file.type.startsWith('image/')) return

    try {
      const thumbUrl = URL.createObjectURL(file)
      setThumbnailDataUrl(thumbUrl)
      setThumbnailFile(file)

      // Upload to server
      const result = await uploadFileToServer(file, 'thumbnail')
      setUploadedThumbnailUrl(result.url)
    } catch (err) {
      console.error('Thumbnail upload error:', err)
    }
  }, [uploadFileToServer])

  // ─── Reset ──────────────────────────────────────────────────────────────────

  const handleResetUpload = useCallback(() => {
    setUploadStage('idle')
    setUploadProgress(0)
    setUploadError('')
    setSelectedFile(null)
    setVideoMeta(null)
    setThumbnailDataUrl(null)
    setThumbnailFile(null)
    setUploadedVideoUrl(null)
    setUploadedThumbnailUrl(null)
    setTitle('')
    setDescription('')
    setCategory('')
    setQuality('1080p')
    setIsFeatured(false)
    setIsTrending(false)
    setIsLive(false)
    setPublishSuccess(false)
    setUrlMode(false)
    setPastedUrl('')
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (videoElementRef.current) {
      videoElementRef.current.pause()
      videoElementRef.current.src = ''
    }
  }, [])

  const handleClearForm = useCallback(() => {
    setTitle('')
    setDescription('')
    setCategory('')
    setQuality('1080p')
    setIsFeatured(false)
    setIsTrending(false)
    setIsLive(false)
  }, [])

  // ─── Publish Video ──────────────────────────────────────────────────────────

  const handlePublishVideo = useCallback(async () => {
    if (!title.trim() || !category) return

    setIsPublishing(true)
    try {
      const videoUrl = urlMode ? pastedUrl : uploadedVideoUrl
      const thumbnailUrl = uploadedThumbnailUrl || thumbnailDataUrl || '/placeholder.jpg'
      const durationSec = videoMeta?.duration || 0
      const res = getResolutionLabel(videoMeta?.width || 1920, videoMeta?.height || 1080).toLowerCase()

      const res2 = await fetch('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || `Watch ${title.trim()} on Xtube.`,
          thumbnail: thumbnailUrl,
          videoUrl: videoUrl || pastedUrl,
          category,
          duration: formatDuration(durationSec),
          isHd: res === '1080p' || res === '2k' || res === '4k',
          isPublished: true,
          resolution: quality || res,
          fileSize: videoMeta?.size || 0,
          storageProvider: 'local',
          storageKey: null,
          durationSeconds: Math.floor(durationSec),
          qualityLevels: JSON.stringify([res]),
          codec: 'h264',
          audioCodec: 'aac',
        }),
      })

      if (res2.ok) {
        setPublishSuccess(true)
        setTimeout(() => {
          handleResetUpload()
        }, 2500)
      } else {
        const errData = await res2.json().catch(() => ({ error: 'Failed to publish' }))
        setUploadError(errData.error || 'Failed to publish video')
        setUploadStage('error')
      }
    } catch (err: any) {
      console.error('Error creating video:', err)
      setUploadError(err.message || 'Failed to publish video')
      setUploadStage('error')
    } finally {
      setIsPublishing(false)
    }
  }, [title, description, category, quality, uploadedVideoUrl, uploadedThumbnailUrl, thumbnailDataUrl, videoMeta, urlMode, pastedUrl, handleResetUpload])

  // ─── Handle URL Paste Submit ────────────────────────────────────────────────

  const handleUrlSubmit = useCallback(() => {
    if (!pastedUrl.trim()) return
    setUploadStage('success')
    setUploadedVideoUrl(pastedUrl.trim())
    setTitle('Streamed Video')
    setCategory('Action')
  }, [pastedUrl])

  // ─── Cleanup ────────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (videoElementRef.current) {
        videoElementRef.current.pause()
        videoElementRef.current.src = ''
      }
      if (thumbnailDataUrl) {
        URL.revokeObjectURL(thumbnailDataUrl)
      }
    }
  }, [])

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3 }}
      className="h-full overflow-y-auto no-scrollbar"
    >
      <div className="min-h-full p-3 lg:p-5 xl:p-6">
        {/* ── Header Section ── */}
        <div className="mb-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-white md:text-2xl">Upload Video</h1>
              <p className="mt-1 text-sm text-white/40">Upload a video file or paste a stream URL</p>
            </div>
          </div>

          {/* Tab */}
          <div className="mt-4 flex items-center gap-0 border-b border-white/5">
            <button
              onClick={() => { if (urlMode) { setUrlMode(false); handleResetUpload() } }}
              className={`relative flex items-center gap-2 px-4 pb-3 text-sm font-semibold transition-colors ${!urlMode ? 'text-white' : 'text-white/40 hover:text-white/60'}`}
            >
              <Film className="h-4 w-4 text-xtube-red" />
              File Upload
              {!urlMode && (
                <motion.div
                  layoutId="upload-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-xtube-red"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
            </button>
            <button
              onClick={() => { if (!urlMode) { setUrlMode(true); handleResetUpload() } }}
              className={`relative flex items-center gap-2 px-4 pb-3 text-sm font-semibold transition-colors ${urlMode ? 'text-white' : 'text-white/40 hover:text-white/60'}`}
            >
              <Link className="h-4 w-4 text-xtube-red" />
              Paste URL
              {urlMode && (
                <motion.div
                  layoutId="upload-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-xtube-red"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
            </button>
          </div>
        </div>

        {/* ── URL Paste Mode ── */}
        {urlMode && uploadStage === 'idle' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="overflow-hidden rounded-xl border border-white/5 bg-[#111111]/80 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Link className="h-4 w-4 text-xtube-red" />
                <span className="text-sm font-semibold text-white">Video Stream URL</span>
              </div>
              <div className="flex gap-3">
                <input
                  type="url"
                  value={pastedUrl}
                  onChange={(e) => setPastedUrl(e.target.value)}
                  placeholder="https://example.com/video.m3u8 or .mp4"
                  className="flex-1 rounded-lg border border-white/10 bg-[#0a0a0a] px-3.5 py-2.5 text-sm text-white placeholder:text-white/25 outline-none transition-all focus:border-xtube-red/40 focus:ring-1 focus:ring-xtube-red/20"
                />
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleUrlSubmit}
                  disabled={!pastedUrl.trim()}
                  className="flex items-center gap-2 rounded-xl bg-xtube-red px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_15px_rgba(229,9,20,0.3)] transition-all hover:bg-xtube-red-hover disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Use URL
                </motion.button>
              </div>
              <p className="mt-2 text-[11px] text-white/30">
                Supports HLS (.m3u8), MP4, WebM direct URLs
              </p>
            </div>
          </motion.div>
        )}

        {/* ── Two Column Layout ── */}
        {(!urlMode || uploadStage !== 'idle') && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_420px] xl:grid-cols-[1fr_460px]">
          {/* ═══════════════════════════════════════════════════════════════════
              LEFT COLUMN — Upload Video
              ═══════════════════════════════════════════════════════════════════ */}
          <div className="space-y-4">
            {/* Section Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-xtube-red">1.</span>
                <h2 className="text-lg font-bold text-white">Upload Video</h2>
                <CloudUpload className="h-5 w-5 text-xtube-red" />
              </div>
              {selectedFile && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleBrowseClick}
                    className="text-sm font-medium text-xtube-red transition-colors hover:text-xtube-red-hover"
                  >
                    Change File
                  </button>
                  <button
                    onClick={handleResetUpload}
                    className="rounded-lg p-1.5 text-white/30 transition-colors hover:bg-white/10 hover:text-red-400"
                    aria-label="Delete file"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {/* ── File Info Card ── */}
            <AnimatePresence mode="wait">
              {videoMeta && (
                <motion.div
                  key="file-info"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="overflow-hidden rounded-xl border border-white/5 bg-[#111111]/80"
                >
                  <div className="flex items-center gap-3 p-3 lg:p-4">
                    {/* Thumbnail Preview */}
                    <div className="relative h-16 w-28 flex-shrink-0 overflow-hidden rounded-lg bg-black">
                      {thumbnailDataUrl ? (
                        <img src={thumbnailDataUrl} alt="Video thumbnail" className="h-full w-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-emerald-900/60 via-teal-800/40 to-cyan-900/30">
                          <Film className="h-6 w-6 text-white/25" />
                        </div>
                      )}
                      <div className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.5 text-[9px] font-semibold text-white">
                        {formatDuration(videoMeta.duration)}
                      </div>
                    </div>

                    {/* File Details */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">{videoMeta.name}</p>
                      <p className="mt-0.5 text-xs text-white/40">
                        {videoMeta.width} × {videoMeta.height} &bull; {formatFileSize(videoMeta.size)} &bull; {formatDuration(videoMeta.duration)}
                      </p>
                    </div>

                    {/* Status Indicator */}
                    {uploadStage === 'success' && (
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
                        <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                      </div>
                    )}
                    {uploadStage === 'processing' && (
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-500/10">
                        <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
                      </div>
                    )}
                    {uploadStage === 'uploading' && (
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-xtube-red/10">
                        <Upload className="h-4 w-4 text-xtube-red animate-pulse" />
                      </div>
                    )}
                    {uploadStage === 'error' && (
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-red-500/10">
                        <XCircle className="h-5 w-5 text-red-400" />
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Video Player Preview ── */}
            <AnimatePresence>
              {uploadStage === 'success' && thumbnailDataUrl && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="overflow-hidden rounded-xl border border-white/5 bg-[#111111]/80"
                >
                  <div className="relative aspect-video bg-black">
                    <img src={thumbnailDataUrl} alt="Video preview" className="h-full w-full object-cover" />

                    {/* Play/Pause overlay */}
                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="absolute inset-0 flex items-center justify-center transition-opacity"
                    >
                      <motion.div
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm transition-colors hover:bg-white/20"
                      >
                        {isPlaying ? (
                          <Pause className="h-6 w-6 text-white" fill="white" />
                        ) : (
                          <Play className="h-6 w-6 text-white ml-0.5" fill="white" />
                        )}
                      </motion.div>
                    </button>

                    {/* Bottom controls */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 pb-3 pt-8">
                      <div className="relative mb-2 h-1 cursor-pointer rounded-full bg-white/20">
                        <div className="absolute left-0 top-0 h-full w-[0%] rounded-full bg-xtube-red" />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <button className="text-white/70 transition-colors hover:text-white">
                            <Play className="h-4 w-4" />
                          </button>
                          <button className="text-white/70 transition-colors hover:text-white">
                            <Volume2 className="h-4 w-4" />
                          </button>
                          <span className="text-xs text-white/50">0:00 / {videoMeta ? formatDuration(videoMeta.duration) : '0:00'}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <button className="text-white/70 transition-colors hover:text-white">
                            <Settings className="h-4 w-4" />
                          </button>
                          <button className="text-white/70 transition-colors hover:text-white">
                            <Maximize className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Upload Area (idle) ── */}
            <AnimatePresence>
              {uploadStage === 'idle' && !urlMode && (
                <motion.div
                  key="upload-area"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={handleBrowseClick}
                  className={`relative flex min-h-[260px] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed transition-all duration-200 ${
                    isDragOver
                      ? 'border-xtube-red bg-xtube-red/5 shadow-[0_0_20px_rgba(229,9,20,0.15)]'
                      : 'border-white/10 bg-[#111111]/60 hover:border-white/20 hover:bg-[#111111]/80'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime,video/x-matroska,.mp4,.webm,.mov,.mkv"
                    className="hidden"
                    onChange={handleFileInputChange}
                  />

                  <motion.div
                    animate={isDragOver ? { scale: 1.1, y: -5 } : { scale: 1, y: 0 }}
                    className="flex h-16 w-16 items-center justify-center rounded-full bg-xtube-red/10"
                  >
                    <CloudUpload className="h-8 w-8 text-xtube-red" />
                  </motion.div>

                  <div className="text-center">
                    <p className="text-lg font-medium text-white">Drag &amp; drop your video here</p>
                    <p className="mt-1 text-sm text-white/40">
                      or{' '}
                      <span className="cursor-pointer text-xtube-red underline underline-offset-2 hover:text-xtube-red-hover">
                        browse files
                      </span>
                    </p>
                  </div>

                  <p className="text-xs text-white/25">
                    MP4, MOV, WebM, MKV &bull; Max 5GB
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Upload Progress ── */}
            <AnimatePresence>
              {(uploadStage === 'uploading' || uploadStage === 'processing') && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="overflow-hidden rounded-xl border border-white/5 bg-[#111111]/80 p-3 lg:p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">
                      {uploadStage === 'processing' ? 'Processing video...' : 'Uploading video...'}
                    </span>
                    <span className="text-sm font-bold text-xtube-red">
                      {Math.round(uploadProgress)}%
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="relative mb-4 h-2 overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${uploadProgress}%` }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                      className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-xtube-red to-red-500"
                    />
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${uploadProgress}%` }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                      className="absolute left-0 top-0 h-full rounded-full bg-xtube-red blur-sm opacity-50"
                    />
                  </div>

                  <div className="flex items-center gap-2 text-sm text-white/60">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-xtube-red" />
                    <span>
                      {uploadStage === 'processing'
                        ? 'Generating thumbnails and detecting quality...'
                        : videoMeta
                          ? `${formatFileSize(videoMeta.size)} — ${videoMeta.width}×${videoMeta.height}`
                          : 'Preparing upload...'}
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Error State ── */}
            <AnimatePresence>
              {uploadStage === 'error' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="overflow-hidden rounded-xl border border-red-500/20 bg-red-500/5 p-4"
                >
                  <div className="flex items-start gap-3">
                    <XCircle className="h-5 w-5 flex-shrink-0 text-red-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-red-400">Upload Failed</p>
                      <p className="mt-1 text-sm text-white/50">{uploadError}</p>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleResetUpload}
                        className="mt-3 flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Try Again
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Quality Options ── */}
            <AnimatePresence>
              {uploadStage === 'success' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="overflow-hidden rounded-xl border border-white/5 bg-[#111111]/80 p-3 lg:p-4"
                >
                  <div className="mb-3 flex items-center gap-2">
                    <Settings className="h-4 w-4 text-white/40" />
                    <span className="text-sm font-semibold text-white">Video Quality</span>
                    {videoMeta && (
                      <span className="ml-auto text-xs text-white/30">
                        Detected: {getResolutionLabel(videoMeta.width, videoMeta.height)}
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {qualityOptions.map((opt) => (
                      <motion.button
                        key={opt.value}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setQuality(opt.value)}
                        className={`relative flex-1 rounded-lg border px-3 py-2.5 text-center transition-all ${
                          quality === opt.value
                            ? 'border-xtube-red/40 bg-xtube-red/10 text-white shadow-[0_0_12px_rgba(229,9,20,0.15)]'
                            : 'border-white/10 bg-white/[0.02] text-white/50 hover:border-white/20 hover:text-white/70'
                        }`}
                      >
                        <span className="text-sm font-semibold">{opt.label}</span>
                        {opt.desc && (
                          <span className="ml-1 text-[10px] text-xtube-red">{opt.desc}</span>
                        )}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Thumbnail Section ── */}
            <AnimatePresence>
              {uploadStage === 'success' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="overflow-hidden rounded-xl border border-white/5 bg-[#111111]/80 p-3 lg:p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="h-4 w-4 text-white/40" />
                      <span className="text-sm font-semibold text-white">Thumbnail</span>
                      {uploadedThumbnailUrl && (
                        <span className="text-[10px] text-emerald-400">✓ Uploaded</span>
                      )}
                    </div>
                    <button
                      onClick={() => thumbnailInputRef.current?.click()}
                      className="text-sm font-medium text-xtube-red transition-colors hover:text-xtube-red-hover"
                    >
                      Upload Manually
                    </button>
                    <input
                      ref={thumbnailInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleThumbnailUpload}
                    />
                  </div>

                  {/* Thumbnail Preview */}
                  {thumbnailDataUrl && (
                    <div className="relative aspect-video overflow-hidden rounded-lg border border-white/5">
                      <img src={thumbnailDataUrl} alt="Video thumbnail" className="h-full w-full object-cover" />
                      <div className="absolute bottom-2 right-2 rounded bg-black/80 px-2 py-1 text-xs text-white/70 backdrop-blur-sm">
                        Auto-generated from video
                      </div>
                    </div>
                  )}

                  {/* Info note */}
                  <div className="mt-3 flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-white/25" />
                    <p className="text-[11px] text-white/30">
                      Thumbnail is auto-generated from video. You can upload a custom one.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════
              RIGHT COLUMN — Video Details
              ═══════════════════════════════════════════════════════════════════ */}
          <div className="space-y-4">
            {/* Section Header */}
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-xtube-red">2.</span>
              <h2 className="text-lg font-bold text-white">Video Details</h2>
              <FileVideo className="h-5 w-5 text-xtube-red" />
            </div>

            {/* ── Form Card ── */}
            <div className="overflow-hidden rounded-xl border border-white/5 bg-[#111111]/80">
              <div className="space-y-4 p-3 lg:p-4">
                {/* Title */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-white">
                      Title <span className="text-xtube-red">*</span>
                    </label>
                    <span className="text-xs text-white/30">
                      {title.length}/100
                    </span>
                  </div>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value.slice(0, 100))}
                    placeholder="Enter video title"
                    className="w-full rounded-lg border border-white/10 bg-[#0a0a0a] px-3.5 py-2.5 text-sm text-white placeholder:text-white/25 outline-none transition-all focus:border-xtube-red/40 focus:ring-1 focus:ring-xtube-red/20"
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-white">Description</label>
                    <span className="text-xs text-white/30">
                      {description.length}/500
                    </span>
                  </div>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value.slice(0, 500))}
                    placeholder="Describe your video..."
                    rows={4}
                    className="w-full resize-none rounded-lg border border-white/10 bg-[#0a0a0a] px-3.5 py-2.5 text-sm text-white placeholder:text-white/25 outline-none transition-all focus:border-xtube-red/40 focus:ring-1 focus:ring-xtube-red/20"
                  />
                </div>

                {/* Category + Quality */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white">Category <span className="text-xtube-red">*</span></label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="w-full rounded-lg border-white/10 bg-[#0a0a0a] text-sm text-white/70 focus:ring-xtube-red/20 [&_svg]:text-white/30">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent className="border-white/10 bg-[#111111]">
                        {categoryOptions.map((cat) => (
                          <SelectItem key={cat} value={cat} className="text-white focus:bg-white/5 focus:text-white">
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white">Quality</label>
                    <Select value={quality} onValueChange={setQuality}>
                      <SelectTrigger className="w-full rounded-lg border-white/10 bg-[#0a0a0a] text-sm text-white/70 focus:ring-xtube-red/20 [&_svg]:text-white/30">
                        <SelectValue placeholder="Select quality" />
                      </SelectTrigger>
                      <SelectContent className="border-white/10 bg-[#111111]">
                        <SelectItem value="auto" className="text-white focus:bg-white/5 focus:text-white">Auto</SelectItem>
                        <SelectItem value="1080p" className="text-white focus:bg-white/5 focus:text-white">1080p</SelectItem>
                        <SelectItem value="2k" className="text-white focus:bg-white/5 focus:text-white">2K</SelectItem>
                        <SelectItem value="4k" className="text-white focus:bg-white/5 focus:text-white">4K</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Duration (auto) */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white">Duration</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={videoMeta ? formatDuration(videoMeta.duration) : (urlMode ? '' : 'Auto-generated')}
                      readOnly
                      className="w-full rounded-lg border border-white/10 bg-[#0a0a0a] px-3.5 py-2.5 pr-10 text-sm text-white/70 outline-none cursor-not-allowed"
                    />
                    <Clock className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" />
                  </div>
                </div>

                {/* Video Info (shown after upload) */}
                {videoMeta && (
                  <div className="rounded-lg border border-white/5 bg-[#0a0a0a]/50 p-3 space-y-2">
                    <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">Video Info</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-white/30">Resolution</span>
                        <p className="text-white/70">{videoMeta.width} × {videoMeta.height}</p>
                      </div>
                      <div>
                        <span className="text-white/30">File Size</span>
                        <p className="text-white/70">{formatFileSize(videoMeta.size)}</p>
                      </div>
                      <div>
                        <span className="text-white/30">Format</span>
                        <p className="text-white/70">{videoMeta.type || 'video/mp4'}</p>
                      </div>
                      <div>
                        <span className="text-white/30">Duration</span>
                        <p className="text-white/70">{formatDuration(videoMeta.duration)}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Checkboxes */}
                <div className="space-y-3 rounded-lg border border-white/5 bg-[#0a0a0a]/50 p-3 lg:p-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <Checkbox
                      checked={isFeatured}
                      onCheckedChange={(checked) => setIsFeatured(checked as boolean)}
                      className="border-white/20 data-[state=checked]:bg-xtube-red data-[state=checked]:border-xtube-red"
                    />
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4 text-white/30" />
                      <span className="text-sm text-white/70">Featured</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <Checkbox
                      checked={isTrending}
                      onCheckedChange={(checked) => setIsTrending(checked as boolean)}
                      className="border-white/20 data-[state=checked]:bg-xtube-red data-[state=checked]:border-xtube-red"
                    />
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-white/30" />
                      <span className="text-sm text-white/70">Trending</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <Checkbox
                      checked={isLive}
                      onCheckedChange={(checked) => setIsLive(checked as boolean)}
                      className="border-white/20 data-[state=checked]:bg-xtube-red data-[state=checked]:border-xtube-red"
                    />
                    <div className="flex items-center gap-2">
                      <Radio className="h-4 w-4 text-white/30" />
                      <span className="text-sm text-white/70">Live</span>
                    </div>
                  </label>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3 pt-1">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleClearForm}
                    className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-white/60 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Clear
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02, boxShadow: '0 0 25px rgba(229,9,20,0.4)' }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handlePublishVideo}
                    disabled={isPublishing || !title.trim() || !category || (uploadStage !== 'success' && !urlMode)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-xtube-red px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_15px_rgba(229,9,20,0.3)] transition-all hover:bg-xtube-red-hover disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPublishing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : publishSuccess ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {isPublishing ? 'Publishing...' : publishSuccess ? 'Published!' : 'Publish Video'}
                  </motion.button>
                </div>

                {/* Publish Success */}
                <AnimatePresence>
                  {publishSuccess && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3"
                    >
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      <p className="text-sm text-emerald-400">Video published successfully! Resetting form...</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
        )}
      </div>
    </motion.div>
  )
}


