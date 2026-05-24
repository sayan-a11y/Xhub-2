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
      const formData = new FormData()
      formData.append('file', file)
      formData.append('category', category)

      const xhr = new XMLHttpRequest()

      await new Promise<void>((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            setUploadProgress((e.loaded / e.total) * 100)
          }
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

      const response = JSON.parse(xhr.responseText)

      // Processing stage
      setUploadProgress(100)
      setUploadStage('processing')
      await new Promise(r => setTimeout(r, 500))

      setUploadedFile({
        url: response.url,
        fileName: response.fileName || file.name,
        mimeType: response.mimeType || file.type,
        size: response.size || file.size,
      })
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
