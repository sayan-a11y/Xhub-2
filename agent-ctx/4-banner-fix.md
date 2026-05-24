# Task ID: 4 - Fix BannerAdsPage Upload and Preview

## Summary
Fixed BannerAdsPage to properly use real file uploads and display actual uploaded content instead of hardcoded placeholders.

## Changes Made

### File: `/home/z/my-project/src/components/admin/BannerAdsPage.tsx`

**1. Already correct (verified, no changes needed):**
- `useAdUpload('ads')` hook already in use — no `simulateUpload` or fake progress states
- Upload success thumbnail already shows actual image/video preview — no gradient placeholders

**2. Preview Section (3 banner placements):**
- When `uploadedFile?.url` exists: shows only the actual uploaded image/video without hardcoded text overlay
- Added video support via `uploadedFile.mimeType.startsWith('video/')` check
- When no uploaded file: preserved original gradient + text as fallback
- "Ad" badge retained in both cases

**3. Save Button:**
- `type`: `adTab === 'video' ? 'video' : 'banner'` (was hardcoded `'banner'`)
- Added `mediaUrl: uploadedFile?.url || ''`
- `mediaFormat`: `uploadedFile?.mimeType || 'image/jpeg'` (was `adTab === 'video' ? 'mp4' : 'image'`)
- Added `linkUrl: bannerLink || null`
- Added `startDate: startDate || null` and `endDate: endDate || null`
- Checks `success` return value before resetting form
- Resets `startDate` and `endDate` on success

## Verification
- `bun run lint` passes with zero errors
- Dev log shows successful compilation
