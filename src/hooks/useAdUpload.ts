'use client'

import { useState, useCallback, useRef } from 'react'

// ─── Types ───────────────────────────────────────────────────────────────────

export type UploadStage = 'idle' | 'uploading' | 'processing' | 'success' | 'error'

export interface UploadedFile {
  url: string
  fileName: string
  mimeType: string
  size: number
}

// ─── Chunked Upload for Video Files ──────────────────────────────────────────

async function uploadChunked(file: File, onProgress: (pct: number) => void): Promise<UploadedFile> {
  const initRes = await fetch('/api/r2?action=init-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || 'video/mp4',
      category: 'video',
    }),
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
      let attempts = 0
      let etag = ''
      while (attempts < 3) {
        try {
          attempts++
          const headers: Record<string, string> = {}
          if (provider === 'r2') headers['Content-Type'] = file.type || 'video/mp4'
          else headers['Content-Type'] = 'application/octet-stream'
          const res = await fetch(part.uploadUrl, { method: 'PUT', headers, body: chunk })
          if (!res.ok) throw new Error(`Part ${part.partNumber} failed: ${res.status}`)
          const etagH = res.headers.get('ETag')
          if (!etagH && provider === 'local') {
            const b = await res.json()
            etag = b.etag
          } else if (etagH) {
            etag = etagH.replace(/"/g, '')
          } else {
            throw new Error(`No ETag for part ${part.partNumber}`)
          }
          break
        } catch (e) {
          if (attempts >= 3) throw e
          await new Promise(r => setTimeout(r, 1000 * attempts))
        }
      }
      uploadedParts.push({ partNumber: part.partNumber, etag })
      completed++
      onProgress(30 + (completed / totalParts) * 60)
    }
  }

  const workers = Array.from({ length: Math.min(6, totalParts) }, () => worker())
  await Promise.all(workers)
  onProgress(90)

  const completeRes = await fetch('/api/r2?action=complete-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uploadId, key,
      parts: uploadedParts.sort((a, b) => a.partNumber - b.partNumber),
    }),
  })
  if (!completeRes.ok) {
    const err = await completeRes.json().catch(() => ({ error: 'Complete failed' }))
    throw new Error(err.details || err.error || 'Failed to assemble file')
  }
  const result = await completeRes.json()
  onProgress(100)
  return { url: result.url, fileName: file.name, mimeType: file.type, size: result.size || file.size }
}

// ─── Shared Upload Hook ──────────────────────────────────────────────────────

export function useAdUpload(category: string = 'ads') {
  const [uploadStage, setUploadStage] = useState<UploadStage>('idle')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState('')
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const uploadFile = useCallback(async (file: File) => {
    setUploadStage('uploading')
    setUploadProgress(0)
    setUploadError('')
    setUploadedFile(null)

    try {
      const isVideo = file.type.startsWith('video/')
      let response: UploadedFile

      if (isVideo) {
        setUploadProgress(5)
        response = await uploadChunked(file, (pct) => setUploadProgress(pct))
      } else {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('category', category)

        const xhr = new XMLHttpRequest()
        await new Promise<void>((resolve, reject) => {
          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) setUploadProgress((e.loaded / e.total) * 100)
          })
          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve()
            else reject(new Error(`Upload failed with status ${xhr.status}`))
          })
          xhr.addEventListener('error', () => reject(new Error('Upload failed')))
          xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')))
          xhr.open('POST', '/api/upload')
          xhr.send(formData)
        })

        const json = JSON.parse(xhr.responseText)
        response = {
          url: json.url,
          fileName: json.fileName || file.name,
          mimeType: json.mimeType || file.type,
          size: json.size || file.size,
        }
      }

      setUploadProgress(100)
      setUploadStage('processing')
      await new Promise(r => setTimeout(r, 500))

      setUploadedFile(response)
      setUploadStage('success')
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
      setUploadStage('error')
    }
  }, [category])

  const resetUpload = useCallback(() => {
    setUploadStage('idle')
    setUploadProgress(0)
    setUploadError('')
    setUploadedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true) }, [])
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false) }, [])
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const files = e.dataTransfer.files
    if (files.length > 0) uploadFile(files[0])
  }, [uploadFile])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) uploadFile(e.target.files[0])
  }, [uploadFile])

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  return {
    uploadStage,
    uploadProgress,
    uploadError,
    uploadedFile,
    isDragOver,
    fileInputRef,
    uploadFile,
    resetUpload,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileSelect,
    openFilePicker,
  }
}
