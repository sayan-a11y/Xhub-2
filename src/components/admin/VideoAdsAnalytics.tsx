'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DollarSign,
  Eye,
  MousePointer,
  TrendingUp,
  TrendingDown,
  Clock,
  SkipForward,
  BarChart3,
  Activity,
  Zap,
  Megaphone,
  Play,
  Monitor,
  Smartphone,
  Tv,
  ChevronDown,
  ArrowUpRight,
  Flame,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

// ─── Types ───────────────────────────────────────────────────────────────────

interface VideoAdsAnalyticsProps {
  ads: Array<{
    id: string
    type: string
    position: string
    title: string
    imageUrl: string
    impressions: number
    clicks: number
    revenue: number
    isActive: boolean
    createdAt: string
  }>
}

// ─── Constants ───────────────────────────────────────────────────────────────

const COLORS = ['#E50914', '#ff6b6b', '#ffa502', '#2ed573', '#70a1ff', '#a855f7']
const DEVICE_COLORS = ['#E50914', '#2ed573', '#70a1ff', '#ffa502']
const TYPE_COLORS: Record<string, string> = {
  'Pre-roll': '#ffa502',
  'Mid-roll': '#a855f7',
  'Post-roll': '#70a1ff',
  'Overlay': '#2ed573',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toLocaleString()
}

function formatCurrency(num: number): string {
  if (num >= 1000000) return '$' + (num / 1000000).toFixed(2) + 'M'
  if (num >= 1000) return '$' + (num / 1000).toFixed(1) + 'K'
  return '$' + num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ─── Simulated Data ──────────────────────────────────────────────────────────

const revenueGraphData = [
  { date: 'May 4', Revenue: 3240, PreRoll: 1120, MidRoll: 980, PostRoll: 540, Overlay: 600 },
  { date: 'May 7', Revenue: 3580, PreRoll: 1240, MidRoll: 1050, PostRoll: 590, Overlay: 700 },
  { date: 'May 10', Revenue: 3120, PreRoll: 1080, MidRoll: 920, PostRoll: 520, Overlay: 600 },
  { date: 'May 13', Revenue: 4050, PreRoll: 1400, MidRoll: 1200, PostRoll: 650, Overlay: 800 },
  { date: 'May 16', Revenue: 3890, PreRoll: 1350, MidRoll: 1150, PostRoll: 590, Overlay: 800 },
  { date: 'May 19', Revenue: 4320, PreRoll: 1500, MidRoll: 1280, PostRoll: 640, Overlay: 900 },
  { date: 'May 22', Revenue: 4150, PreRoll: 1440, MidRoll: 1230, PostRoll: 620, Overlay: 860 },
  { date: 'May 25', Revenue: 4680, PreRoll: 1620, MidRoll: 1390, PostRoll: 700, Overlay: 970 },
  { date: 'May 28', Revenue: 4520, PreRoll: 1560, MidRoll: 1340, PostRoll: 680, Overlay: 940 },
  { date: 'May 31', Revenue: 4950, PreRoll: 1720, MidRoll: 1470, PostRoll: 740, Overlay: 1020 },
  { date: 'Jun 03', Revenue: 5180, PreRoll: 1800, MidRoll: 1540, PostRoll: 780, Overlay: 1060 },
  { date: 'Jun 06', Revenue: 5420, PreRoll: 1880, MidRoll: 1610, PostRoll: 810, Overlay: 1120 },
]

const ctrGraphData = [
  { date: 'May 4', CTR: 3.2, PreRoll: 3.8, MidRoll: 4.1, PostRoll: 2.6, Overlay: 3.0 },
  { date: 'May 7', CTR: 3.4, PreRoll: 3.9, MidRoll: 4.3, PostRoll: 2.7, Overlay: 3.2 },
  { date: 'May 10', CTR: 3.1, PreRoll: 3.6, MidRoll: 4.0, PostRoll: 2.5, Overlay: 2.9 },
  { date: 'May 13', CTR: 3.6, PreRoll: 4.2, MidRoll: 4.5, PostRoll: 2.9, Overlay: 3.4 },
  { date: 'May 16', CTR: 3.5, PreRoll: 4.0, MidRoll: 4.4, PostRoll: 2.8, Overlay: 3.3 },
  { date: 'May 19', CTR: 3.8, PreRoll: 4.4, MidRoll: 4.7, PostRoll: 3.0, Overlay: 3.6 },
  { date: 'May 22', CTR: 3.7, PreRoll: 4.3, MidRoll: 4.6, PostRoll: 2.9, Overlay: 3.5 },
  { date: 'May 25', CTR: 4.0, PreRoll: 4.6, MidRoll: 5.0, PostRoll: 3.2, Overlay: 3.8 },
  { date: 'May 28', CTR: 3.9, PreRoll: 4.5, MidRoll: 4.9, PostRoll: 3.1, Overlay: 3.7 },
  { date: 'May 31', CTR: 4.2, PreRoll: 4.8, MidRoll: 5.2, PostRoll: 3.4, Overlay: 4.0 },
  { date: 'Jun 03', CTR: 4.3, PreRoll: 4.9, MidRoll: 5.3, PostRoll: 3.5, Overlay: 4.1 },
  { date: 'Jun 06', CTR: 4.5, PreRoll: 5.1, MidRoll: 5.5, PostRoll: 3.6, Overlay: 4.2 },
]

const impressionsGraphData = [
  { date: 'May 4', PreRoll: 32000, MidRoll: 45000, PostRoll: 18000, Overlay: 28000 },
  { date: 'May 7', PreRoll: 35000, MidRoll: 48000, PostRoll: 20000, Overlay: 30000 },
  { date: 'May 10', PreRoll: 30000, MidRoll: 42000, PostRoll: 17000, Overlay: 26000 },
  { date: 'May 13', PreRoll: 38000, MidRoll: 52000, PostRoll: 22000, Overlay: 34000 },
  { date: 'May 16', PreRoll: 36000, MidRoll: 50000, PostRoll: 21000, Overlay: 32000 },
  { date: 'May 19', PreRoll: 40000, MidRoll: 55000, PostRoll: 24000, Overlay: 36000 },
  { date: 'May 22', PreRoll: 38000, MidRoll: 53000, PostRoll: 23000, Overlay: 35000 },
  { date: 'May 25', PreRoll: 42000, MidRoll: 58000, PostRoll: 26000, Overlay: 38000 },
  { date: 'May 28', PreRoll: 41000, MidRoll: 56000, PostRoll: 25000, Overlay: 37000 },
  { date: 'May 31', PreRoll: 45000, MidRoll: 62000, PostRoll: 28000, Overlay: 40000 },
  { date: 'Jun 03', PreRoll: 47000, MidRoll: 65000, PostRoll: 29000, Overlay: 42000 },
  { date: 'Jun 06', PreRoll: 49000, MidRoll: 68000, PostRoll: 31000, Overlay: 44000 },
]

const deviceAnalyticsData = [
  { name: 'Mobile', value: 45247, icon: Smartphone },
  { name: 'Desktop', value: 25847, icon: Monitor },
  { name: 'Tablet', value: 9543, icon: Monitor },
  { name: 'TV', value: 4610, icon: Tv },
]

const heatmapData = [
  { hour: '6AM', Mon: 12, Tue: 15, Wed: 18, Thu: 14, Fri: 20, Sat: 25, Sun: 22 },
  { hour: '9AM', Mon: 35, Tue: 38, Wed: 42, Thu: 36, Fri: 40, Sat: 28, Sun: 24 },
  { hour: '12PM', Mon: 48, Tue: 52, Wed: 55, Thu: 50, Fri: 54, Sat: 32, Sun: 30 },
  { hour: '3PM', Mon: 42, Tue: 45, Wed: 48, Thu: 44, Fri: 50, Sat: 38, Sun: 35 },
  { hour: '6PM', Mon: 65, Tue: 68, Wed: 72, Thu: 66, Fri: 70, Sat: 55, Sun: 48 },
  { hour: '9PM', Mon: 78, Tue: 82, Wed: 85, Thu: 80, Fri: 75, Sat: 68, Sun: 62 },
  { hour: '12AM', Mon: 45, Tue: 42, Wed: 48, Thu: 44, Fri: 52, Sat: 58, Sun: 50 },
]

const analyticsTableData = [
  { name: 'Summer Sale Pre-roll', type: 'Pre-roll', impressions: 725600, clicks: 48230, ctr: 6.64, revenue: 8245.30, watchTime: '12,450 hrs', status: 'Active' },
  { name: 'New Arrivals Mid-roll', type: 'Mid-roll', impressions: 512400, clicks: 28590, ctr: 5.58, revenue: 3245.60, watchTime: '8,640 hrs', status: 'Active' },
  { name: 'Special Offer Post-roll', type: 'Post-roll', impressions: 325800, clicks: 18710, ctr: 5.74, revenue: 2125.40, watchTime: '5,460 hrs', status: 'Active' },
  { name: 'Subscribe Overlay', type: 'Overlay', impressions: 285600, clicks: 15310, ctr: 5.36, revenue: 1854.20, watchTime: '4,780 hrs', status: 'Active' },
  { name: 'Brand Promo Pre-roll', type: 'Pre-roll', impressions: 198400, clicks: 9800, ctr: 4.94, revenue: 1245.10, watchTime: '3,340 hrs', status: 'Active' },
  { name: 'Flash Deal Mid-roll', type: 'Mid-roll', impressions: 156200, clicks: 7180, ctr: 4.60, revenue: 984.50, watchTime: '2,640 hrs', status: 'Paused' },
  { name: 'Weekend Overlay', type: 'Overlay', impressions: 124800, clicks: 5240, ctr: 4.20, revenue: 756.80, watchTime: '2,100 hrs', status: 'Active' },
  { name: 'End Card Post-roll', type: 'Post-roll', impressions: 89400, clicks: 3576, ctr: 4.00, revenue: 542.30, watchTime: '1,500 hrs', status: 'Paused' },
]

// ─── Custom Tooltip ──────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-white/10 bg-[#111111]/95 px-3 py-2 shadow-2xl">
      <p className="mb-2 text-xs font-medium text-white/50">{label}</p>
      {payload.map((entry, idx) => (
        <p key={idx} className="flex items-center gap-2 text-sm font-semibold text-white">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          {entry.name}:{' '}
          {entry.name.toLowerCase().includes('revenue')
            ? formatCurrency(entry.value)
            : entry.name.toLowerCase().includes('ctr')
              ? entry.value.toFixed(1) + '%'
              : formatNumber(entry.value)}
        </p>
      ))}
    </div>
  )
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

interface KPICardProps {
  title: string
  value: string
  icon: React.ElementType
  change: number
  delay: number
  accent?: string
  subtitle?: string
}

function KPICard({ title, value, icon: Icon, change, delay, accent = '#E50914', subtitle }: KPICardProps) {
  const isPositive = change >= 0
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="group relative overflow-hidden rounded-xl border border-white/5 bg-[#111111]/80 p-3 lg:p-4 transition-all duration-300 hover:border-white/10 hover:shadow-[0_0_20px_rgba(229,9,20,0.12)]"
    >
      {/* Top accent line */}
      <div className="absolute left-0 top-0 h-[2px] w-full" style={{ background: `linear-gradient(to right, ${accent}, transparent)` }} />
      {/* Corner glow */}
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100" style={{ backgroundColor: `${accent}15` }} />

      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wider text-white/40">{title}</p>
          <p className="text-xl font-bold text-white">{value}</p>
          {subtitle && <p className="text-[10px] text-white/30">{subtitle}</p>}
          <div className="flex items-center gap-1.5">
            {isPositive ? (
              <TrendingUp className="h-3 w-3 text-emerald-400" />
            ) : (
              <TrendingDown className="h-3 w-3 text-red-400" />
            )}
            <span className={`text-xs font-semibold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {isPositive ? '+' : ''}{change}%
            </span>
            <span className="text-[10px] text-white/30">vs last 30 days</span>
          </div>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-xl md:h-10 md:w-10" style={{ backgroundColor: `${accent}15` }}>
          <Icon className="h-5 w-5 md:h-6 md:w-6" style={{ color: accent }} />
        </div>
      </div>
    </motion.div>
  )
}

// ─── Section Card ────────────────────────────────────────────────────────────

function SectionCard({
  title,
  delay,
  children,
  action,
  className = '',
  icon: Icon,
}: {
  title: string
  delay: number
  children: React.ReactNode
  action?: React.ReactNode
  className?: string
  icon?: React.ElementType
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`overflow-hidden rounded-xl border border-white/5 bg-[#111111]/80 ${className}`}
    >
      <div className="p-3 lg:p-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {Icon && (
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-xtube-red/10">
                <Icon className="h-4 w-4 text-xtube-red" />
              </div>
            )}
            <h3 className="text-sm font-semibold text-white md:text-base">{title}</h3>
          </div>
          {action}
        </div>
        {children}
      </div>
    </motion.div>
  )
}

// ─── Heatmap Cell ────────────────────────────────────────────────────────────

function HeatmapCell({ value, max }: { value: number; max: number }) {
  const intensity = value / max
  const bg = intensity > 0.8
    ? 'bg-xtube-red/70'
    : intensity > 0.6
      ? 'bg-xtube-red/45'
      : intensity > 0.4
        ? 'bg-xtube-red/25'
        : intensity > 0.2
          ? 'bg-xtube-red/12'
          : 'bg-xtube-red/5'

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`flex h-8 w-full items-center justify-center rounded-sm text-[10px] font-medium transition-all duration-200 hover:scale-110 ${bg} ${intensity > 0.4 ? 'text-white' : 'text-white/40'}`}
      title={`${value}%`}
    >
      {value}%
    </motion.div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function VideoAdsAnalytics({ ads }: VideoAdsAnalyticsProps) {
  const [timeRange, setTimeRange] = useState('30d')
  const [adTypeFilter, setAdTypeFilter] = useState('all')

  // Computed analytics from ad data
  const videoAds = ads.filter((ad) =>
    ['pre-roll', 'mid-roll', 'post-roll'].includes(ad.position) || ad.type === 'overlay'
  )

  const filteredVideoAds = adTypeFilter === 'all'
    ? videoAds
    : videoAds.filter((ad) => {
        if (adTypeFilter === 'pre-roll') return ad.position === 'pre-roll'
        if (adTypeFilter === 'mid-roll') return ad.position === 'mid-roll'
        if (adTypeFilter === 'post-roll') return ad.position === 'post-roll'
        if (adTypeFilter === 'overlay') return ad.type === 'overlay'
        return true
      })

  const totalImpressions = filteredVideoAds.reduce((sum, ad) => sum + ad.impressions, 0) || 6100000
  const totalClicks = filteredVideoAds.reduce((sum, ad) => sum + ad.clicks, 0) || 222500
  const totalRevenue = filteredVideoAds.reduce((sum, ad) => sum + ad.revenue, 0) || 31345.60
  const avgCTR = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '3.65'
  const activeAds = filteredVideoAds.filter((ad) => ad.isActive).length || 136

  // KPI Cards data
  const kpiCards = [
    { title: 'Total Video Ad Revenue', value: formatCurrency(totalRevenue), icon: DollarSign, change: 18.4, accent: '#2ed573', subtitle: 'Across all video ad types' },
    { title: 'Total Impressions', value: formatNumber(totalImpressions), icon: Eye, change: 14.2, accent: '#E50914' },
    { title: 'Total Clicks', value: formatNumber(totalClicks), icon: MousePointer, change: 16.8, accent: '#70a1ff' },
    { title: 'Average CTR', value: avgCTR + '%', icon: TrendingUp, change: 8.5, accent: '#ffa502' },
    { title: 'Watch Time', value: '38.7K hrs', icon: Clock, change: 12.1, accent: '#a855f7', subtitle: 'Total ad watch time' },
    { title: 'Skip Rate', value: '32.4%', icon: SkipForward, change: -5.2, accent: '#ff6b6b', subtitle: 'Down from last period' },
    { title: 'Engagement Rate', value: '67.6%', icon: Activity, change: 9.4, accent: '#2ed573' },
    { title: 'Active Ads', value: activeAds.toString(), icon: Zap, change: 6.8, accent: '#E50914', subtitle: `of ${(filteredVideoAds.length || 136)} total` },
  ]

  // Filtered chart data based on ad type
  const getFilteredRevenueData = () => {
    if (adTypeFilter === 'all') return revenueGraphData.map((d) => ({ date: d.date, Revenue: d.Revenue }))
    const key = adTypeFilter === 'pre-roll' ? 'PreRoll' : adTypeFilter === 'mid-roll' ? 'MidRoll' : adTypeFilter === 'post-roll' ? 'PostRoll' : 'Overlay'
    return revenueGraphData.map((d) => ({ date: d.date, Revenue: d[key] }))
  }

  const getFilteredCTRData = () => {
    if (adTypeFilter === 'all') return ctrGraphData.map((d) => ({ date: d.date, CTR: d.CTR }))
    const key = adTypeFilter === 'pre-roll' ? 'PreRoll' : adTypeFilter === 'mid-roll' ? 'MidRoll' : adTypeFilter === 'post-roll' ? 'PostRoll' : 'Overlay'
    return ctrGraphData.map((d) => ({ date: d.date, CTR: d[key] }))
  }

  // Top performing ads (sorted by revenue)
  const topAds = [...analyticsTableData]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="space-y-4"
    >
      {/* ═══════════════════════════════════════════════════════════════════
          SECTION HEADER
          ═══════════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-xtube-red/10 shadow-[0_0_15px_rgba(229,9,20,0.15)]">
            <BarChart3 className="h-5 w-5 text-xtube-red" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Video Ads Analytics</h2>
            <p className="text-sm text-white/40">Advanced analytics for all video ad types</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={adTypeFilter} onValueChange={setAdTypeFilter}>
            <SelectTrigger className="h-8 w-[140px] border-white/10 bg-[#111111] text-xs text-white/70 hover:border-xtube-red/30">
              <SelectValue placeholder="Ad Type" />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-[#111111]">
              <SelectItem value="all">All Ad Types</SelectItem>
              <SelectItem value="pre-roll">Pre-roll</SelectItem>
              <SelectItem value="mid-roll">Mid-roll</SelectItem>
              <SelectItem value="post-roll">Post-roll</SelectItem>
              <SelectItem value="overlay">Overlay</SelectItem>
            </SelectContent>
          </Select>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="h-8 w-[120px] border-white/10 bg-[#111111] text-xs text-white/70 hover:border-xtube-red/30">
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-[#111111]">
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="14d">Last 14 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════
          KPI CARDS (4 columns desktop, 2 tablet)
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpiCards.map((card, i) => (
          <KPICard key={card.title} {...card} delay={0.05 + i * 0.04} />
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          REVENUE GRAPH + CTR GRAPH (2 columns)
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {/* Revenue Graph */}
        <SectionCard
          title="Revenue Overview"
          delay={0.4}
          icon={DollarSign}
          action={
            <div className="flex items-center gap-1 rounded-lg border border-xtube-red/20 bg-xtube-red/5 px-2 py-1">
              <Flame className="h-3 w-3 text-xtube-red" />
              <span className="text-[10px] font-semibold text-xtube-red">+18.4%</span>
            </div>
          }
        >
          <div className="h-64 md:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={getFilteredRevenueData()}>
                <defs>
                  <linearGradient id="adRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2ed573" stopOpacity={0.4} />
                    <stop offset="50%" stopColor="#2ed573" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#2ed573" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                <XAxis dataKey="date" stroke="#666" fontSize={10} tickLine={false} axisLine={false} tick={{ fill: '#666' }} />
                <YAxis stroke="#666" fontSize={10} tickLine={false} axisLine={false} tick={{ fill: '#666' }} tickFormatter={(v: number) => '$' + formatNumber(v)} width={50} />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="Revenue"
                  stroke="#2ed573"
                  strokeWidth={2.5}
                  fill="url(#adRevenueGradient)"
                  name="Revenue"
                  dot={false}
                  activeDot={{ r: 5, fill: '#2ed573', stroke: '#111', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        {/* CTR Graph */}
        <SectionCard
          title="CTR Trend"
          delay={0.45}
          icon={TrendingUp}
          action={
            <div className="flex items-center gap-1 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-2 py-1">
              <TrendingUp className="h-3 w-3 text-emerald-400" />
              <span className="text-[10px] font-semibold text-emerald-400">+8.5%</span>
            </div>
          }
        >
          <div className="h-64 md:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={getFilteredCTRData()}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                <XAxis dataKey="date" stroke="#666" fontSize={10} tickLine={false} axisLine={false} tick={{ fill: '#666' }} />
                <YAxis stroke="#666" fontSize={10} tickLine={false} axisLine={false} tick={{ fill: '#666' }} domain={[0, 8]} tickFormatter={(v: number) => v + '%'} width={35} />
                <Tooltip content={<ChartTooltip />} />
                <Line
                  type="monotone"
                  dataKey="CTR"
                  stroke="#ffa502"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5, fill: '#ffa502', stroke: '#111', strokeWidth: 2 }}
                  name="CTR"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          IMPRESSIONS CHART + DEVICE ANALYTICS DONUT (2 columns)
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {/* Impressions Chart - Stacked Bar */}
        <SectionCard
          title="Impressions by Ad Type"
          delay={0.5}
          icon={Eye}
          action={
            <div className="flex items-center gap-2">
              {Object.entries(TYPE_COLORS).map(([type, color]) => (
                <div key={type} className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-[9px] text-white/40">{type}</span>
                </div>
              ))}
            </div>
          }
        >
          <div className="h-64 md:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={impressionsGraphData}>
                <defs>
                  <linearGradient id="preRollGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ffa502" stopOpacity={0.9} />
                    <stop offset="95%" stopColor="#ffa502" stopOpacity={0.4} />
                  </linearGradient>
                  <linearGradient id="midRollGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.9} />
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0.4} />
                  </linearGradient>
                  <linearGradient id="postRollGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#70a1ff" stopOpacity={0.9} />
                    <stop offset="95%" stopColor="#70a1ff" stopOpacity={0.4} />
                  </linearGradient>
                  <linearGradient id="overlayGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2ed573" stopOpacity={0.9} />
                    <stop offset="95%" stopColor="#2ed573" stopOpacity={0.4} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                <XAxis dataKey="date" stroke="#666" fontSize={10} tickLine={false} axisLine={false} tick={{ fill: '#666' }} />
                <YAxis stroke="#666" fontSize={10} tickLine={false} axisLine={false} tick={{ fill: '#666' }} tickFormatter={(v: number) => formatNumber(v)} width={45} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="PreRoll" fill="url(#preRollGrad)" radius={[2, 2, 0, 0]} name="Pre-roll" stackId="a" />
                <Bar dataKey="MidRoll" fill="url(#midRollGrad)" radius={[0, 0, 0, 0]} name="Mid-roll" stackId="a" />
                <Bar dataKey="PostRoll" fill="url(#postRollGrad)" radius={[0, 0, 0, 0]} name="Post-roll" stackId="a" />
                <Bar dataKey="Overlay" fill="url(#overlayGrad)" radius={[2, 2, 0, 0]} name="Overlay" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        {/* Device Analytics Donut */}
        <SectionCard
          title="Device Analytics"
          delay={0.55}
          icon={Monitor}
        >
          <div className="flex flex-col items-center gap-3 md:flex-row md:items-start md:gap-4">
            <div className="h-44 w-full md:h-64 md:w-1/2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={deviceAnalyticsData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {deviceAnalyticsData.map((_entry, index) => (
                      <Cell key={`device-${index}`} fill={DEVICE_COLORS[index % DEVICE_COLORS.length]} />
                    ))}
                  </Pie>
                  <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" className="fill-white text-sm font-bold">
                    85.2K
                  </text>
                  <text x="50%" y="56%" textAnchor="middle" dominantBaseline="middle" className="fill-white/40 text-[10px]">
                    Users
                  </text>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0]
                      const total = deviceAnalyticsData.reduce((s, e) => s + e.value, 0)
                      const pct = ((d.value as number) / total * 100).toFixed(1)
                      return (
                        <div className="rounded-xl border border-white/10 bg-[#111111]/95 px-3 py-2 shadow-2xl">
                          <p className="text-sm font-semibold text-white">{d.name}</p>
                          <p className="text-xs text-white/50">{(d.value as number).toLocaleString()} ({pct}%)</p>
                        </div>
                      )
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Device breakdown list */}
            <div className="w-full space-y-3 md:w-1/2">
              {deviceAnalyticsData.map((device, idx) => {
                const total = deviceAnalyticsData.reduce((s, e) => s + e.value, 0)
                const pct = ((device.value / total) * 100).toFixed(1)
                const DeviceIcon = device.icon
                return (
                  <motion.div
                    key={device.name}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 + idx * 0.08, duration: 0.3 }}
                    className="group flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3 transition-all duration-200 hover:border-white/10 hover:bg-white/[0.04]"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: `${DEVICE_COLORS[idx]}15` }}>
                      <DeviceIcon className="h-4 w-4" style={{ color: DEVICE_COLORS[idx] }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-white">{device.name}</span>
                        <span className="text-xs font-bold" style={{ color: DEVICE_COLORS[idx] }}>{pct}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ delay: 0.8 + idx * 0.1, duration: 0.6, ease: 'easeOut' }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: DEVICE_COLORS[idx] }}
                        />
                      </div>
                    </div>
                    <span className="text-[10px] text-white/40">{formatNumber(device.value)}</span>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </SectionCard>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          AD PERFORMANCE HEATMAP (Full width)
          ═══════════════════════════════════════════════════════════════════ */}
      <SectionCard
        title="Ad Performance Heatmap"
        delay={0.6}
        icon={Activity}
        action={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-xtube-red/5" />
              <span className="text-[9px] text-white/30">Low</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-xtube-red/25" />
              <span className="text-[9px] text-white/30">Med</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-xtube-red/70" />
              <span className="text-[9px] text-white/30">High</span>
            </div>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <div className="min-w-[500px]">
            {/* Header row */}
            <div className="mb-2 grid grid-cols-8 gap-1">
              <div className="text-[9px] font-medium text-white/30" />
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                <div key={day} className="text-center text-[9px] font-semibold uppercase tracking-wider text-white/40">
                  {day}
                </div>
              ))}
            </div>
            {/* Data rows */}
            {heatmapData.map((row, rowIdx) => {
              const days = [row.Mon, row.Tue, row.Wed, row.Thu, row.Fri, row.Sat, row.Sun]
              const maxVal = Math.max(...heatmapData.flatMap((r) => [r.Mon, r.Tue, r.Wed, r.Thu, r.Fri, r.Sat, r.Sun]))
              return (
                <div key={row.hour} className="mb-1 grid grid-cols-8 gap-1">
                  <div className="flex h-8 items-center text-[10px] font-medium text-white/40">
                    {row.hour}
                  </div>
                  {days.map((val, colIdx) => (
                    <HeatmapCell key={`${rowIdx}-${colIdx}`} value={val} max={maxVal} />
                  ))}
                </div>
              )
            })}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3">
          <span className="text-[10px] text-white/30">Peak engagement: Wed & Thu 9PM</span>
          <span className="text-[10px] text-white/30">Lowest: Early mornings</span>
        </div>
      </SectionCard>

      {/* ═══════════════════════════════════════════════════════════════════
          TOP PERFORMING ADS + ANALYTICS TABLE (2 columns)
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* Top Performing Video Ads */}
        <SectionCard
          title="Top Performing Video Ads"
          delay={0.65}
          icon={Flame}
          action={
            <button className="text-xs font-semibold text-xtube-red transition-colors hover:text-xtube-red-hover">
              View All
            </button>
          }
        >
          <div className="space-y-2.5">
            {topAds.map((ad, i) => {
              const rankStyles = i === 0
                ? 'bg-xtube-red/10 text-xtube-red border-xtube-red/20'
                : i === 1
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : i === 2
                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                    : 'bg-white/5 text-white/40 border-white/10'

              const typeColor = TYPE_COLORS[ad.type] || '#9ca3af'

              return (
                <motion.div
                  key={ad.name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 + i * 0.05, duration: 0.3 }}
                  className="group flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3 transition-all duration-200 hover:border-white/10 hover:bg-white/[0.04]"
                >
                  {/* Rank */}
                  <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-[11px] font-bold ${rankStyles}`}>
                    {i + 1}
                  </span>

                  {/* Ad Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-white group-hover:text-xtube-red transition-colors">
                        {ad.name}
                      </p>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="text-[10px] font-semibold" style={{ color: typeColor }}>{ad.type}</span>
                      <span className="text-[10px] text-white/30">•</span>
                      <span className="text-[10px] text-white/40">{formatNumber(ad.impressions)} imp</span>
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs font-bold text-emerald-400">{formatCurrency(ad.revenue)}</p>
                      <p className="text-[10px] text-white/40">{ad.ctr}% CTR</p>
                    </div>
                    <ArrowUpRight className="h-3.5 w-3.5 text-white/20 transition-colors group-hover:text-xtube-red" />
                  </div>
                </motion.div>
              )
            })}
          </div>
        </SectionCard>

        {/* Video Ads Analytics Table */}
        <SectionCard
          title="Ad Performance Details"
          delay={0.7}
          icon={BarChart3}
          action={
            <div className="flex items-center gap-1.5 rounded-full bg-green-500/10 px-2 py-0.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
              </span>
              <span className="text-[10px] font-medium text-green-400">Live</span>
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="pb-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-white/30">Ad Name</th>
                  <th className="pb-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-white/30">Type</th>
                  <th className="pb-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-white/30">Impressions</th>
                  <th className="pb-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-white/30">Clicks</th>
                  <th className="pb-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-white/30">CTR</th>
                  <th className="pb-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-white/30">Revenue</th>
                  <th className="pb-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-white/30">Watch Time</th>
                  <th className="pb-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-white/30">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {analyticsTableData.map((ad, i) => {
                  const typeColor = TYPE_COLORS[ad.type] || '#9ca3af'
                  const typeBgColors: Record<string, string> = {
                    'Pre-roll': 'bg-orange-400/10 text-orange-400 border-orange-400/20',
                    'Mid-roll': 'bg-purple-400/10 text-purple-400 border-purple-400/20',
                    'Post-roll': 'bg-blue-400/10 text-blue-400 border-blue-400/20',
                    'Overlay': 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
                  }
                  return (
                    <motion.tr
                      key={ad.name}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.75 + i * 0.04, duration: 0.3 }}
                      className="group transition-colors hover:bg-white/[0.02]"
                    >
                      <td className="py-2.5 pr-3">
                        <span className="max-w-[120px] truncate text-xs font-medium text-white group-hover:text-xtube-red transition-colors block">
                          {ad.name}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${typeBgColors[ad.type]}`}>
                          {ad.type}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-xs text-white/60">{formatNumber(ad.impressions)}</td>
                      <td className="py-2.5 pr-3 text-xs text-white/60">{formatNumber(ad.clicks)}</td>
                      <td className="py-2.5 pr-3 text-xs font-semibold text-xtube-red">{ad.ctr}%</td>
                      <td className="py-2.5 pr-3 text-xs font-medium text-emerald-400">{formatCurrency(ad.revenue)}</td>
                      <td className="py-2.5 pr-3 text-xs text-white/50">{ad.watchTime}</td>
                      <td className="py-2.5">
                        <Badge
                          className={`cursor-default text-[10px] ${
                            ad.status === 'Active'
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                              : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                          }`}
                        >
                          <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${ad.status === 'Active' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                          {ad.status}
                        </Badge>
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          REAL-TIME STATS BAR
          ═══════════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.5 }}
        className="overflow-hidden rounded-xl border border-white/5 bg-[#111111]/80"
      >
        <div className="p-3 lg:p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-xtube-red/10">
              <Zap className="h-4 w-4 text-xtube-red" />
            </div>
            <h3 className="text-sm font-semibold text-white">Real-time Ad Stats</h3>
            <div className="flex items-center gap-1.5 rounded-full bg-green-500/10 px-2 py-0.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
              </span>
              <span className="text-[10px] font-medium text-green-400">Live</span>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-xtube-red/10">
                <Eye className="h-4 w-4 text-xtube-red" />
              </div>
              <div>
                <p className="text-[10px] text-white/40">Impressions Today</p>
                <p className="text-lg font-bold text-white">184.2K</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-xtube-red/10">
                <MousePointer className="h-4 w-4 text-xtube-red" />
              </div>
              <div>
                <p className="text-[10px] text-white/40">Clicks Today</p>
                <p className="text-lg font-bold text-white">6,840</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-xtube-red/10">
                <DollarSign className="h-4 w-4 text-xtube-red" />
              </div>
              <div>
                <p className="text-[10px] text-white/40">Revenue Today</p>
                <p className="text-lg font-bold text-emerald-400">$542.80</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-xtube-red/10">
                <Play className="h-4 w-4 text-xtube-red" />
              </div>
              <div>
                <p className="text-[10px] text-white/40">Ads Serving Now</p>
                <p className="text-lg font-bold text-white">42</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
