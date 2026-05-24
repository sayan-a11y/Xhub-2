# Task 7-8: Fix PreRollAdsPage and MidRollAdsPage

## Summary

### PreRollAdsPage.tsx
- **No changes needed** - already correctly implemented with useAdUpload hook, real data from useAdsManager, computed stats, real thumbnails, real preview, and save button with createAd.

### MidRollAdsPage.tsx
Major overhaul from 970 to 779 lines:

1. Replaced simulateUpload with useAdUpload hook - removed local upload state, simulateUpload function, cleanup useEffect, custom handlers
2. Removed mockAds entirely - now uses real data from useAdsManager with ads, loading, createAd destructured
3. Replaced filteredAds from mockAds.filter to ads.filter with real isActive check
4. Computed stats from real data instead of hardcoded values
5. Replaced gradient thumbnails with actual uploaded image preview
6. Fixed preview to show uploaded content instead of hardcoded NIKE ad
7. Added save button with createAd, adTitle input, and handleSave callback
8. Fixed table thumbnails to use ad.imageUrl || ad.mediaUrl
9. Updated table data fields from mock fields to real AdItem fields
10. Added loading and empty states to table
11. Updated donut chart to use computed donutData from real ads
12. Fixed pagination count from hardcoded to real ads.length
13. Cleaned up unused imports (Pencil, AlertCircle, Copy), added useAdUpload
14. Added formatNumber and formatCurrency helper functions

## Verification
- bun run lint passes with no errors
- Dev server compiles successfully with no errors in dev.log
