---
Task ID: 1
Agent: Main
Task: Remove all demo videos, demo ads, and dummy data - make everything real-time

Work Log:
- Explored full codebase structure (40+ components, 15+ API routes, Prisma schema)
- Checked database for demo content: found 23 demo videos (using picsum.photos/mux.dev), 4 demo ads (using picsum.photos), 10 categories, 96 analytics records
- Deleted ALL demo data from database: videos, ads, hero_ads, footer_ads, categories, analytics, transactions, system_logs, upload_sessions
- Verified no hardcoded demo URLs remain in source code (no picsum.photos, mux.dev, placeholder.jpg, dummy, or demo strings)
- Verified seed API route only creates system admin/guest users (no demo content)
- Confirmed all admin pages use real-time hooks (useAdsManager, useHeroAds, useFooterAds) with Supabase realtime subscriptions
- Confirmed all API routes (hero-ads, footer-ads, ads, videos, categories) work with real database data
- Verified lint passes with zero errors
- Verified dev server is running and responding correctly

Stage Summary:
- Database is completely clean: 0 videos, 0 ads, 0 hero ads, 0 footer ads, 0 categories
- Only 2 system users remain (admin, guest)
- All data is now real-time: admin creates content → appears instantly on user side via Supabase realtime
- No demo/dummy content anywhere in the system

---
Task ID: 4
Agent: Main
Task: Fix BannerAdsPage thumbnails and previews to show actual uploaded images instead of gradient placeholders

Work Log:
- Read BannerAdsPage.tsx (1300+ lines) and useAdsManager hook to understand data flow
- Confirmed AdItem type has `imageUrl` property from Supabase Ad table
- Confirmed `filteredAds` are derived from `realAds` (via useAdsManager), so each ad has `imageUrl`
- Verified upload success thumbnail (lines 654-658) already works correctly with `uploadedFile?.url`

Fix 1 - Table Preview (line 1231):
- Replaced `<div className={`absolute inset-0 bg-gradient-to-br ${ad.gradient}`} />` with conditional rendering
- When `ad.imageUrl` exists: shows actual `<img>` with `object-cover`, lazy loading, and error fallback
- When no image: falls back to gradient placeholder using `thumbnailGradients[i % thumbnailGradients.length]`
- Type icons (Image/Video/Animated) only shown when no imageUrl (they were hidden behind the image anyway)

Fix 2 - Preview Section (3 banner placements: top-header, middle-content, bottom-footer):
- Each placement preview now checks for `uploadedFile?.url`
- When uploaded file exists: shows actual uploaded image as banner content with `object-cover`
- When no uploaded file: shows gradient background with fake promotional text as before
- Preserved "Ad" badge in all cases
- Added `onError` handler to gracefully hide broken images

Fix 3 - Upload Success Thumbnail:
- Already working correctly - shows `uploadedFile.url` when available, gradient fallback otherwise
- No changes needed

Verification:
- Ran `npx eslint src/components/admin/BannerAdsPage.tsx` - passes with zero errors
- Pre-existing lint error in PopupAdsPage.tsx (unrelated to this fix)
- Pre-existing dev server error for missing 'critters' module (unrelated)

Stage Summary:
- Table rows now show actual uploaded ad images as thumbnails instead of broken gradient references
- Banner preview section shows the uploaded image when creating a new ad
- All changes maintain graceful fallbacks to gradient placeholders when no image is available
