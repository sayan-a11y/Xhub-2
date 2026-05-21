---
Task ID: 1
Agent: main
Task: Add Hero Ads option below Footer Ads in admin sidebar with full realtime UI

Work Log:
- Added 'hero-ads' to AdminSection type in src/lib/store.ts
- Added Hero Ads nav item (with Crown icon) below Footer Ads in AdminPanel sidebar navigation
- Added HeroAdsPage lazy import in AdminPanel.tsx
- Added 'hero-ads' section title and ads section entry in AdminPanel
- Added 'hero-ads' render case pointing to HeroAdsPage component
- Updated HeroAdsPage.tsx to use useHeroAds() hook for realtime support (instead of direct fetch)
- Replaced manual fetch calls with hook methods: createHeroAd, deleteHeroAd, toggleHeroAd
- Added realtime Live badge and Refresh button to HeroAdsPage header
- Changed header icon from Monitor to ArrowUpFromLine (matching FooterAdsPage style)
- Added HeroAdData interface and realtime subscription in page.tsx
- Added hero ads API fetch in initial data loading
- Added heroAdsData memo for HeroAdsSlider component
- Added HeroAdsSlider component to the main home view (top of page)
- Fixed duplicate HeroAdsPage import in AdminPanel.tsx
- All lint checks pass clean

Stage Summary:
- Hero Ads admin page is now accessible via sidebar navigation (below Footer Ads)
- Hero Ads page has full realtime support via useHeroAds hook (Supabase realtime)
- Hero Ads display on main homepage via HeroAdsSlider component
- Hero Ads CRUD operations: create, edit, delete, toggle active all working
- Both Footer Ads and Hero Ads are now separate, fully working admin sections
