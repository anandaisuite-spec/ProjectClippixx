import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Clock, CheckCircle, Loader2, Truck, Award, IndianRupee, Package, Video,
    ChevronDown, X, BadgeCheck, AlertTriangle, Instagram, Youtube, Twitter,
    Play, Building2, CalendarDays, ShieldCheck, Users, FileText, Copy, Check,
    UserSquare2, KeyRound, LayoutDashboard, ClipboardList, Wallet, Star as StarIcon,
    Image as ImageIcon, BarChart3, Settings as SettingsIcon, LifeBuoy, Search,
    Bell, ChevronRight, Rocket, TrendingUp, Sparkles, PieChart, User,
    FolderClosed, Workflow, HelpCircle, LogOut,
} from 'lucide-react';
import {
    ResponsiveContainer, AreaChart, Area, LineChart, Line,
    XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import {
    getCreatorStats, getIncomingOrders, updateOrderStatus, deliverOrder,
    getVerificationStatus, submitVerification, notifyAdminVerification, getStarById,
    type Order, type OrderStatus, type CreatorStats,
    type VerificationInfo, type IdentityProofType,
    type SocialPlatform, type OwnershipMethod, type Star,
} from '@/services/api-extensions';
import {
    getDashboardStats, getDashboardBookings,
    type CreatorDashboardStats, type Booking,
} from '@/services/api';
import { ORDER_TYPE_LABELS, STATUS_LABELS, STATUS_COLORS } from '@/constants/orderTypes';
import { useAuth } from '@/providers/AuthProvider';
import { useModals } from '@/providers/ModalProvider';
import { useMyProfile } from '@/hooks/useMyProfile';
import { capitalizeFirst } from '@/utils/text';
import VerifiedBadge from '@/components/ui/VerifiedBadge';
import BookingReviewsSection from '@/features/creator/components/BookingReviewsSection';
import { BookingsTab, EarningsTab, SettingsTab } from './BookingsTabs';

// ─────────────────────────────────────────────────────────────────────────────
// The dashboard is a fixed-dark app shell (per design). All shell styling uses
// UNPREFIXED dark utilities (bg-[#0d0f1a], text-white/60, …) so it renders the
// same in both app themes. Embedded legacy tabs stay theme-aware.
// ─────────────────────────────────────────────────────────────────────────────

// Icons are components (not data), so they stay local; labels + colors come
// from the shared constants module.
const STATUS_ICONS: Record<OrderStatus, React.ElementType> = {
    pending: Clock,
    accepted: CheckCircle,
    in_progress: Loader2,
    delivered: Truck,
    completed: Award,
    rejected: X,
    cancelled: X,
    refunded: X,
};

const STATUS_FILTERS: { label: string; value: OrderStatus | 'all' }[] = [
    { label: 'All', value: 'all' },
    { label: 'Pending', value: 'pending' },
    { label: 'Accepted', value: 'accepted' },
    { label: 'In Progress', value: 'in_progress' },
    { label: 'Delivered', value: 'delivered' },
    { label: 'Completed', value: 'completed' },
];

const ID_TYPES: { value: IdentityProofType; label: string }[] = [
    { value: 'aadhaar', label: 'Aadhaar' },
    { value: 'pan', label: 'PAN' },
    { value: 'passport', label: 'Passport' },
    { value: 'driving_license', label: 'Driving License' },
    { value: 'voter_id', label: 'Voter ID' },
    { value: 'other', label: 'Other' },
];

const PLATFORMS: { value: SocialPlatform; label: string }[] = [
    { value: 'instagram', label: 'Instagram' },
    { value: 'youtube', label: 'YouTube' },
    { value: 'tiktok', label: 'TikTok' },
    { value: 'twitter', label: 'Twitter / X' },
];

const OWNERSHIP_OPTIONS: { value: OwnershipMethod; label: string; help: (code: string) => string }[] = [
    {
        value: 'bio',
        label: 'Add the code to your bio',
        help: (code) => `Temporarily add "${code}" to your Instagram / TikTok / YouTube bio. You can remove it once you're verified.`,
    },
    {
        value: 'story',
        label: 'Post a story with the code',
        help: (code) => `Post a story that says "Officially joined Clippixx – ${code}". A screenshot in the story works too.`,
    },
    {
        value: 'email',
        label: 'Reply from your business email',
        help: (code) => `Send "${code}" from the business email linked to your social profile to support@clippixx.com.`,
    },
];

function formatDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatINR(value: number | string): string {
    const n = typeof value === 'string' ? Number(value) : value;
    return (Number.isFinite(n) ? n : 0).toLocaleString('en-IN');
}

function timeAgo(iso: string): string {
    const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} min${m === 1 ? '' : 's'} ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d} day${d === 1 ? '' : 's'} ago`;
    return formatDate(iso);
}

// ─── Sidebar navigation ──────────────────────────────────────────────────────

type NavKey =
    | 'dashboard' | 'orders' | 'earnings' | 'reviews' | 'portfolio'
    | 'analytics' | 'verification' | 'settings';

const NAV_ITEMS: { key: NavKey; label: string; icon: React.ElementType }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'orders', label: 'Orders', icon: ClipboardList },
    { key: 'earnings', label: 'Earnings', icon: Wallet },
    { key: 'reviews', label: 'Reviews', icon: StarIcon },
    { key: 'portfolio', label: 'Portfolio', icon: ImageIcon },
    { key: 'analytics', label: 'Analytics', icon: BarChart3 },
    { key: 'verification', label: 'Verification', icon: ShieldCheck },
    { key: 'settings', label: 'Settings', icon: SettingsIcon },
];

// Pill badge colors for the recent-orders / recent-bookings list.
// (pending=yellow, accepted=purple, in_progress=blue, delivered/completed=green)
const PILL: Record<string, string> = {
    pending: 'bg-amber-500/15 text-amber-300',
    accepted: 'bg-violet-500/15 text-violet-300',
    in_progress: 'bg-blue-500/15 text-blue-300',
    delivered: 'bg-emerald-500/15 text-emerald-300',
    completed: 'bg-emerald-500/15 text-emerald-300',
    rejected: 'bg-red-500/15 text-red-300',
    cancelled: 'bg-slate-500/15 text-slate-300',
    refunded: 'bg-slate-500/15 text-slate-300',
};

// One unified record shape for bookings + legacy orders, used by the overview
// (recent list, activity feed, chart bucketing). Derived from ALREADY-FETCHED
// data — no extra endpoints invented.
type RecentItem = {
    id: string;
    source: 'booking' | 'order';
    title: string;
    client: string;
    status: OrderStatus;
    amount: number;
    created: string;
    updated: string;
    due: string | null;
};

/** Bucket point values into per-day sums over the trailing `days` window. */
function dailySeries(days: number, points: { ts: number; v: number }[]): { label: string; value: number }[] {
    const out: { label: string; value: number; start: number; end: number }[] = [];
    const dayMs = 86400000;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    for (let i = days - 1; i >= 0; i--) {
        const start = todayStart.getTime() - i * dayMs;
        out.push({
            label: new Date(start).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
            value: 0,
            start,
            end: start + dayMs,
        });
    }
    for (const p of points) {
        const b = out.find((x) => p.ts >= x.start && p.ts < x.end);
        if (b) b.value += p.v;
    }
    return out.map(({ label, value }) => ({ label, value }));
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

// ─── Main component ──────────────────────────────────────────────────────────

const NAV_KEYS = NAV_ITEMS.map((n) => n.key);

export default function CreatorDashboard() {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { openSearch, openFeedback, openLogin } = useModals();

    // Avatar quick-actions dropdown (top-right), closes on outside click.
    const [showUserMenu, setShowUserMenu] = useState(false);
    const userMenuRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const onDown = (e: MouseEvent) => {
            if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
                setShowUserMenu(false);
            }
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, []);

    // Deep-linkable sections: /creator-dashboard?tab=orders opens Orders, etc.
    const [searchParams] = useSearchParams();
    const tabParam = searchParams.get('tab');
    const [nav, setNav] = useState<NavKey>(
        NAV_KEYS.includes(tabParam as NavKey) ? (tabParam as NavKey) : 'dashboard',
    );
    useEffect(() => {
        if (tabParam && NAV_KEYS.includes(tabParam as NavKey)) setNav(tabParam as NavKey);
    }, [tabParam]);
    // Orders nav hosts BOTH the modern bookings flow and the legacy direct
    // orders flow (they were separate tabs before) via a small sub-toggle.
    const [ordersView, setOrdersView] = useState<'bookings' | 'direct'>('bookings');

    const [dashStats, setDashStats] = useState<CreatorDashboardStats | null>(null);
    const [bookingsError, setBookingsError] = useState<string | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const showToast = useCallback((m: string) => {
        setToast(m);
        setTimeout(() => setToast(null), 3000);
    }, []);
    const [stats, setStats] = useState<CreatorStats | null>(null);
    const [orders, setOrders] = useState<Order[]>([]);
    const [filter, setFilter] = useState<OrderStatus | 'all'>('all');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Overview data — bookings feed (recent list / chart / activity) + star (rating).
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [bookingsTotal, setBookingsTotal] = useState(0);
    const [star, setStar] = useState<Star | null>(null);
    const [range, setRange] = useState<7 | 30 | 90>(30);
    const [proTipDismissed, setProTipDismissed] = useState(
        () => localStorage.getItem('clipixx_dash_protip') === 'dismissed',
    );

    // Deliver modal
    const [deliverFor, setDeliverFor] = useState<Order | null>(null);
    const [videoUrl, setVideoUrl] = useState('');
    const [delivering, setDelivering] = useState(false);
    const [deliverError, setDeliverError] = useState<string | null>(null);

    // Verified status for the header badge + the creator's star id (for "View
    // My Profile" / reviews / rating). VerificationInfo is the star row, so its
    // `id` IS the star id.
    const [isVerified, setIsVerified] = useState(false);
    const [starId, setStarId] = useState<string | null>(null);
    useEffect(() => {
        getVerificationStatus()
            .then((v) => {
                setIsVerified(Boolean(v?.is_verified || v?.verification_status === 'approved'));
                if (v?.id) setStarId(v.id);
            })
            .catch(() => setIsVerified(false));
    }, []);

    // Star record → avg rating + review count for the stats row / reviews nav.
    useEffect(() => {
        if (!starId) return;
        getStarById(starId).then(setStar).catch(() => setStar(null));
    }, [starId]);

    // Dashboard stats (earnings, profile completion) — separate from order stats.
    const refreshDashStats = useCallback(() => {
        getDashboardStats().then(setDashStats).catch(() => setDashStats(null));
    }, []);
    useEffect(() => { refreshDashStats(); }, [refreshDashStats]);

    // Bookings feed for the overview widgets (recent orders, charts, activity).
    useEffect(() => {
        getDashboardBookings({ limit: 50 })
            .then((p) => { setBookings(p.bookings ?? []); setBookingsTotal(p.total ?? 0); })
            .catch(() => { setBookings([]); setBookingsTotal(0); });
    }, []);

    const loadData = useCallback(() => {
        setLoading(true);
        setError(null);
        let cancelled = false;

        Promise.all([
            getCreatorStats().catch(() => null),
            getIncomingOrders({ status: filter === 'all' ? undefined : filter, limit: 50 }),
        ])
            .then(([s, o]) => {
                if (cancelled) return;
                if (s) setStats(s);
                setOrders(o.data ?? []);
            })
            .catch((err: Error) => {
                if (!cancelled) {
                    setError(
                        /403|creator profile/i.test(err.message)
                            ? 'No creator profile linked to your account yet. Get verified to start receiving orders.'
                            : err.message,
                    );
                }
            })
            .finally(() => { if (!cancelled) setLoading(false); });

        return () => { cancelled = true; };
    }, [filter]);

    useEffect(() => { loadData(); }, [loadData]);

    const pendingCount = Number(dashStats?.pending_count ?? 0) + Number(stats?.pending_count ?? 0);

    const handleStatus = async (order: Order, status: OrderStatus, cancelReason?: string) => {
        try {
            await updateOrderStatus(order.id, status, cancelReason);
            loadData();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update order');
        }
    };

    const openDeliver = (order: Order) => {
        setDeliverFor(order);
        setVideoUrl('');
        setDeliverError(null);
    };

    const handleDeliver = async () => {
        if (!deliverFor) return;
        if (!videoUrl.trim()) { setDeliverError('Please enter a video URL.'); return; }
        setDelivering(true);
        setDeliverError(null);
        try {
            await deliverOrder(deliverFor.id, videoUrl.trim());
            setDeliverFor(null);
            loadData();
        } catch (err) {
            setDeliverError(err instanceof Error ? err.message : 'Failed to deliver video');
        } finally {
            setDelivering(false);
        }
    };

    // ── Unified records (bookings + legacy orders) for the overview ─────────
    const records: RecentItem[] = useMemo(() => {
        const fromBookings: RecentItem[] = bookings.map((b) => ({
            id: b.id,
            source: 'booking',
            title: b.tier_name || 'Personalized Video',
            client: b.fan_name || 'Fan',
            status: b.status as OrderStatus,
            amount: Number(b.tier_price ?? 0),
            created: b.created_at,
            updated: b.updated_at,
            due: null,
        }));
        const fromOrders: RecentItem[] = orders.map((o) => ({
            id: o.id,
            source: 'order',
            title: ORDER_TYPE_LABELS[o.order_type] ?? 'Order',
            client: o.buyer_name,
            status: o.status,
            amount: Number(o.price ?? 0),
            created: o.created_at,
            updated: o.updated_at,
            due: o.delivery_deadline,
        }));
        return [...fromBookings, ...fromOrders];
    }, [bookings, orders]);

    // Earnings points: value recognized when a record is delivered/completed.
    const earningPoints = useMemo(
        () => records
            .filter((r) => r.status === 'delivered' || r.status === 'completed')
            .map((r) => ({ ts: new Date(r.updated).getTime(), v: r.amount })),
        [records],
    );
    // Order-creation points (for the orders sparkline / "+X from last 7 days").
    const createdPoints = useMemo(
        () => records.map((r) => ({ ts: new Date(r.created).getTime(), v: 1 })),
        [records],
    );

    const earningsSeries = useMemo(() => dailySeries(range, earningPoints), [range, earningPoints]);
    const windowTotal = useMemo(() => sum(earningsSeries.map((p) => p.value)), [earningsSeries]);
    // % change vs the previous equal-length window (real math on real records).
    const prevWindowTotal = useMemo(() => {
        const dayMs = 86400000;
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        const curStart = todayStart.getTime() - (range - 1) * dayMs;
        const prevStart = curStart - range * dayMs;
        return sum(earningPoints.filter((p) => p.ts >= prevStart && p.ts < curStart).map((p) => p.v));
    }, [range, earningPoints]);
    const earningsDelta = prevWindowTotal > 0
        ? Math.round(((windowTotal - prevWindowTotal) / prevWindowTotal) * 100)
        : null;

    const newLast7 = useMemo(() => {
        const cutoff = Date.now() - 7 * 86400000;
        return createdPoints.filter((p) => p.ts >= cutoff).length;
    }, [createdPoints]);

    // Sparklines: last 7 days of real data; flat series when no history exists.
    const sparkOrders = useMemo(() => dailySeries(7, createdPoints).map((p) => p.value), [createdPoints]);
    const sparkEarnings = useMemo(() => dailySeries(7, earningPoints).map((p) => p.value), [earningPoints]);
    const avgRating = star ? Number(star.avg_rating ?? star.rating ?? 0) : 0;
    const reviewCount = star ? Number(star.review_count ?? star.reviews_count ?? 0) : 0;
    const sparkFlat = useMemo(() => [1, 1, 1, 1, 1, 1, 1], []);

    // Top-row stats — all from real endpoints.
    const totalOrdersCount = bookingsTotal + Number(stats?.total_orders ?? 0);
    const ordersPct = totalOrdersCount > 0
        ? Math.round((Number(dashStats?.this_month_bookings ?? 0) / totalOrdersCount) * 100)
        : 0;
    const totalEarnings = Number(dashStats?.total_earnings ?? 0);
    const earnPct = totalEarnings > 0
        ? Math.round((Number(dashStats?.this_month_earnings ?? 0) / totalEarnings) * 100)
        : 0;
    const responded = Number(dashStats?.accepted_count ?? 0) + Number(dashStats?.in_progress_count ?? 0) + Number(dashStats?.delivered_count ?? 0);
    const respBase = responded + Number(dashStats?.pending_count ?? 0);
    const responseRate = respBase > 0 ? Math.round((responded / respBase) * 100) : null;

    const recentItems = useMemo(
        () => [...records].sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()).slice(0, 4),
        [records],
    );
    const activityItems = useMemo(
        () => [...records]
            .filter((r) => r.status !== 'cancelled' && r.status !== 'rejected' && r.status !== 'refunded')
            .sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime())
            .slice(0, 4),
        [records],
    );

    const displayName = capitalizeFirst(user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'Creator');
    const initial = (displayName[0] || 'C').toUpperCase();
    // Shared profile cache — avatar updates live after an upload anywhere.
    const myProfile = useMyProfile();
    const avatarUrl = myProfile?.avatar_url || null;
    const avatarOrInitial = avatarUrl
        ? <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
        : initial;
    const viewProfile = () => (starId ? navigate(`/creator/${starId}`) : navigate('/my-profile'));

    const profileCompletion = Math.max(0, Math.min(100, Number(dashStats?.profile_completion ?? 0)));

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-[#0d0f1a] text-white flex">
            {/* Success toast */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
                        className="fixed top-6 right-4 z-[150] flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 text-white text-sm shadow-lg"
                    >
                        <CheckCircle className="w-4 h-4" /> {toast}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Sidebar ─────────────────────────────────────────────────── */}
            <aside className="hidden lg:flex w-60 shrink-0 flex-col fixed inset-y-0 left-0 bg-[#12142a] border-r border-white/5 z-40">
                <a href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }} className="flex items-center gap-2.5 px-5 pt-5 pb-4">
                    <img src="/logo-light.png" alt="Clippixx" className="h-10 w-auto" />
                    <img src="/clippixx-light.png" alt="Clippixx" className="h-5 w-auto" />
                </a>

                <nav className="px-3 py-2 space-y-1 flex-1 overflow-y-auto">
                    {NAV_ITEMS.map((item) => (
                        <button
                            key={item.key}
                            onClick={() => setNav(item.key)}
                            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                                nav === item.key
                                    ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-purple-950/40'
                                    : 'text-white/50 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            <item.icon className="w-4 h-4 shrink-0" />
                            {item.label}
                            {item.key === 'orders' && pendingCount > 0 && (
                                <span className="ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white">{pendingCount}</span>
                            )}
                        </button>
                    ))}
                    <button
                        onClick={() => openFeedback()}
                        className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-white/50 hover:text-white hover:bg-white/5 transition-all"
                    >
                        <LifeBuoy className="w-4 h-4 shrink-0" /> Support
                    </button>
                </nav>

                {/* Grow-your-business promo */}
                <div className="mx-3 mb-3 rounded-2xl bg-gradient-to-br from-violet-600/30 to-indigo-600/20 border border-violet-500/25 p-4 text-center">
                    <div className="w-12 h-12 mx-auto rounded-xl bg-violet-500/20 flex items-center justify-center mb-2">
                        <Rocket className="w-6 h-6 text-violet-300" />
                    </div>
                    <p className="text-sm font-semibold">Grow your business</p>
                    <p className="text-[11px] text-white/50 mt-1 mb-3">Create more services and increase your visibility.</p>
                    <button
                        onClick={() => setNav('settings')}
                        className="w-full py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-semibold transition-colors"
                    >
                        Create Service
                    </button>
                </div>

                {/* Creator identity */}
                <button onClick={viewProfile} className="flex items-center gap-3 px-5 py-4 border-t border-white/5 text-left hover:bg-white/5 transition-colors">
                    <div className="w-9 h-9 rounded-full overflow-hidden bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-sm font-bold shrink-0">
                        {avatarOrInitial}
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{displayName}</p>
                        <p className="text-[11px] text-white/40">Creator</p>
                    </div>
                    <ChevronDown className="w-4 h-4 text-white/30 ml-auto" />
                </button>
            </aside>

            {/* ── Main ────────────────────────────────────────────────────── */}
            <div className="flex-1 min-w-0 lg:pl-60">
                {/* Top bar */}
                <header className="sticky top-0 z-30 bg-[#0d0f1a]/90 backdrop-blur-xl border-b border-white/5">
                    <div className="flex items-center gap-3 px-4 sm:px-6 py-3">
                        {/* Mobile brand */}
                        <a href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }} className="lg:hidden shrink-0">
                            <img src="/logo-light.png" alt="Clippixx" className="h-7 w-auto" />
                        </a>
                        <button
                            onClick={openSearch}
                            className="flex-1 max-w-md flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white/40 hover:bg-white/10 transition-colors"
                        >
                            <Search className="w-4 h-4" />
                            Search anything...
                        </button>
                        <div className="ml-auto flex items-center gap-3">
                            <button
                                onClick={() => setNav('orders')}
                                className="relative w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
                                aria-label="Notifications"
                            >
                                <Bell className="w-4 h-4" />
                                {pendingCount > 0 && (
                                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-[10px] font-bold flex items-center justify-center">
                                        {pendingCount}
                                    </span>
                                )}
                            </button>
                            {/* Avatar → quick-actions dropdown */}
                            <div className="relative" ref={userMenuRef}>
                                <button
                                    onClick={() => setShowUserMenu((v) => !v)}
                                    className="w-9 h-9 rounded-full overflow-hidden bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-sm font-bold hover:shadow-lg hover:shadow-violet-900/40 transition-shadow"
                                    aria-label="Account menu"
                                    aria-expanded={showUserMenu}
                                >
                                    {avatarOrInitial}
                                </button>
                                <AnimatePresence>
                                    {showUserMenu && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 8, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 8, scale: 0.95 }}
                                            transition={{ duration: 0.15 }}
                                            className="absolute right-0 mt-2 w-64 rounded-2xl bg-[#171a2e] border border-white/10 shadow-2xl shadow-black/50 overflow-hidden"
                                        >
                                            {/* Header: avatar + name + email */}
                                            <div className="px-4 py-4 border-b border-white/5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center font-semibold shrink-0">
                                                        {avatarOrInitial}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold truncate">{displayName}</p>
                                                        <p className="text-xs text-white/40 truncate">{user?.email}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Quick actions */}
                                            <div className="py-1">
                                                {[
                                                    { label: 'My Profile', icon: User, run: () => navigate('/my-profile') },
                                                    { label: 'My Orders', icon: Package, run: () => setNav('orders') },
                                                    { label: 'My Collections', icon: FolderClosed, run: () => navigate('/collections') },
                                                    { label: 'My Workflows', icon: Workflow, run: () => navigate('/workflows') },
                                                    { label: 'Notifications', icon: Bell, run: () => navigate('/notifications') },
                                                ].map((item) => (
                                                    <button
                                                        key={item.label}
                                                        onClick={() => { setShowUserMenu(false); item.run(); }}
                                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/70 hover:bg-white/5 hover:text-white transition-colors"
                                                    >
                                                        <item.icon className="w-4 h-4 text-white/35" />
                                                        {item.label}
                                                    </button>
                                                ))}
                                            </div>

                                            {/* Settings / support */}
                                            <div className="py-1 border-t border-white/5">
                                                <button
                                                    onClick={() => { setShowUserMenu(false); navigate('/settings'); }}
                                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/70 hover:bg-white/5 hover:text-white transition-colors"
                                                >
                                                    <SettingsIcon className="w-4 h-4 text-white/35" />
                                                    Account Settings
                                                </button>
                                                <button
                                                    onClick={() => { setShowUserMenu(false); navigate('/help'); }}
                                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/70 hover:bg-white/5 hover:text-white transition-colors"
                                                >
                                                    <HelpCircle className="w-4 h-4 text-white/35" />
                                                    Help & Support
                                                </button>
                                            </div>

                                            {/* Sign out */}
                                            <div className="py-1 border-t border-white/5">
                                                <button
                                                    onClick={async () => {
                                                        setShowUserMenu(false);
                                                        await logout();
                                                        navigate('/');
                                                        openLogin();
                                                    }}
                                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                                                >
                                                    <LogOut className="w-4 h-4" />
                                                    Sign Out
                                                </button>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </div>
                    {/* Mobile nav pills */}
                    <div className="lg:hidden flex gap-2 px-4 pb-3 overflow-x-auto">
                        {NAV_ITEMS.map((item) => (
                            <button
                                key={item.key}
                                onClick={() => setNav(item.key)}
                                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                                    nav === item.key ? 'bg-violet-600 text-white' : 'bg-white/5 text-white/50'
                                }`}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                </header>

                <main className="p-4 sm:p-6 space-y-6">
                    {nav === 'dashboard' && (
                        <>
                            {/* Welcome row */}
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <h1 className="text-2xl sm:text-3xl font-bold">Welcome back, {displayName}!</h1>
                                        {isVerified && <VerifiedBadge />}
                                    </div>
                                    <p className="text-sm text-white/50 mt-1">Here's your performance overview. Keep up the great work!</p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2.5">
                                    <button onClick={() => setNav('settings')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm font-semibold transition-colors">
                                        <Sparkles className="w-4 h-4" /> Create Service
                                    </button>
                                    <button onClick={() => setNav('earnings')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm font-medium transition-colors">
                                        <Wallet className="w-4 h-4" /> Withdraw Earnings
                                    </button>
                                    <button onClick={viewProfile} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm font-medium transition-colors">
                                        <User className="w-4 h-4" /> View Profile
                                    </button>
                                </div>
                            </div>

                            {error && (
                                <div className="p-4 bg-red-500/10 border border-red-500/25 text-red-300 rounded-xl flex items-center justify-between gap-4">
                                    <span className="text-sm">{error}</span>
                                    <button onClick={loadData} className="text-sm underline hover:no-underline shrink-0">Retry</button>
                                </div>
                            )}

                            {/* ── Stat cards ─────────────────────────────── */}
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                                <StatCard
                                    icon={<Package className="w-5 h-5 text-violet-300" />} iconBg="bg-violet-500/15"
                                    label="Total Orders" value={String(totalOrdersCount)}
                                    delta={`${ordersPct}% this month`} spark={sparkOrders} sparkColor="#8b5cf6"
                                    loading={!dashStats && !stats}
                                />
                                <StatCard
                                    icon={<IndianRupee className="w-5 h-5 text-emerald-300" />} iconBg="bg-emerald-500/15"
                                    label="Total Earnings" value={`₹${formatINR(totalEarnings)}`}
                                    delta={`${earnPct}% this month`} spark={sparkEarnings.some((v) => v > 0) ? sparkEarnings : sparkFlat} sparkColor="#34d399"
                                    loading={!dashStats}
                                />
                                <StatCard
                                    icon={<StarIcon className="w-5 h-5 text-amber-300" />} iconBg="bg-amber-500/15"
                                    label="Average Rating" value={avgRating > 0 ? avgRating.toFixed(1) : '—'}
                                    delta={reviewCount > 0 ? `${reviewCount} review${reviewCount === 1 ? '' : 's'}` : 'No reviews yet'}
                                    spark={sparkFlat} sparkColor="#fbbf24" neutralDelta
                                    loading={Boolean(starId) && !star}
                                />
                                <StatCard
                                    icon={<PieChart className="w-5 h-5 text-sky-300" />} iconBg="bg-sky-500/15"
                                    label="Response Rate" value={responseRate === null ? '—' : `${responseRate}%`}
                                    delta={respBase > 0 ? `based on ${respBase} orders` : 'No orders yet'}
                                    spark={sparkFlat} sparkColor="#38bdf8" neutralDelta
                                    loading={!dashStats}
                                />
                            </div>

                            {/* ── Middle row: earnings chart + pipeline ──── */}
                            <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
                                <EarningsOverview
                                    range={range} setRange={setRange}
                                    series={earningsSeries} windowTotal={windowTotal} delta={earningsDelta}
                                />
                                <OrdersPipeline
                                    dashStats={dashStats} totalOrders={bookingsTotal}
                                    newLast7={newLast7} onViewAll={() => setNav('orders')}
                                />
                            </div>

                            {/* ── Bottom row ─────────────────────────────── */}
                            <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr_1fr]">
                                {/* Recent orders */}
                                <Panel title="Recent Orders" action={{ label: 'View All', onClick: () => setNav('orders') }}>
                                    {recentItems.length === 0 ? (
                                        <EmptyHint icon={Package} text="No orders yet. Share your profile to get booked!" />
                                    ) : (
                                        <div className="space-y-2.5">
                                            {recentItems.map((r) => (
                                                <button
                                                    key={`${r.source}-${r.id}`}
                                                    onClick={() => setNav('orders')}
                                                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-violet-500/30 transition-colors text-left"
                                                >
                                                    <div className="w-10 h-10 shrink-0 rounded-lg bg-gradient-to-br from-violet-500/30 to-indigo-500/20 flex items-center justify-center text-sm font-bold text-violet-200">
                                                        {(r.client[0] || 'C').toUpperCase()}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-semibold truncate">{r.title}</p>
                                                        <p className="text-xs text-white/40 truncate">Client: {r.client}</p>
                                                    </div>
                                                    <div className="shrink-0 flex flex-col items-end gap-1">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${PILL[r.status] ?? PILL.pending}`}>
                                                            {STATUS_LABELS[r.status] ?? r.status}
                                                        </span>
                                                        <span className="text-[11px] text-white/40">
                                                            {r.due ? `Due ${formatDate(r.due)}` : formatDate(r.created)}
                                                        </span>
                                                    </div>
                                                    <div className="shrink-0 text-right">
                                                        <p className="text-sm font-bold">₹{formatINR(r.amount)}</p>
                                                    </div>
                                                    <ChevronRight className="w-4 h-4 text-white/25 shrink-0" />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </Panel>

                                {/* Profile & verification */}
                                <Panel title="Profile & Verification">
                                    <div className="flex items-center gap-4 mb-5">
                                        <ProgressRing pct={profileCompletion} />
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold">Profile Completion</p>
                                            <p className="text-xs text-white/40 mt-0.5">
                                                {profileCompletion >= 100
                                                    ? 'All set! Your profile is fully complete.'
                                                    : 'Almost there! Complete the steps below to unlock all features.'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <ChecklistRow
                                            label="Identity Verification"
                                            ok={isVerified} okText="Verified"
                                            warnText="Get verified" onAction={() => setNav('verification')}
                                        />
                                        <ChecklistRow
                                            label="Portfolio"
                                            ok={false} okText="Added"
                                            warnText="Add your portfolio" onAction={() => setNav('portfolio')}
                                        />
                                        <ChecklistRow
                                            label="Payment Method"
                                            ok={false} okText="Added"
                                            warnText="Add bank details" onAction={() => setNav('settings')}
                                        />
                                        <ChecklistRow
                                            label="Profile Details"
                                            ok={profileCompletion >= 100} okText="Completed"
                                            warnText={`${profileCompletion}% complete`} onAction={() => setNav('settings')}
                                        />
                                    </div>
                                    <button
                                        onClick={() => setNav('settings')}
                                        className="mt-5 w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm font-semibold transition-colors"
                                    >
                                        Complete Your Profile
                                    </button>
                                </Panel>

                                {/* Recent activity + balance */}
                                <div className="space-y-4">
                                    <Panel title="Recent Activity" action={{ label: 'View All', onClick: () => setNav('orders') }}>
                                        {activityItems.length === 0 ? (
                                            <EmptyHint icon={TrendingUp} text="Activity will appear here as orders come in." />
                                        ) : (
                                            <div className="space-y-3.5">
                                                {activityItems.map((r) => {
                                                    const meta = activityMeta(r);
                                                    return (
                                                        <div key={`${r.source}-${r.id}-${r.status}`} className="flex items-start gap-3">
                                                            <div className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center ${meta.bg}`}>
                                                                <meta.icon className={`w-4 h-4 ${meta.fg}`} />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm truncate">{meta.text}</p>
                                                            </div>
                                                            <span className="text-[11px] text-white/35 shrink-0">{timeAgo(r.updated)}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </Panel>

                                    {/* Available balance */}
                                    <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-4 flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
                                            <Wallet className="w-5 h-5 text-emerald-300" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[11px] text-white/40">Available Balance</p>
                                            <p className="text-lg font-bold">₹{formatINR(totalEarnings)}</p>
                                            <p className="text-[10px] text-emerald-400">Ready to withdraw</p>
                                        </div>
                                        <button
                                            onClick={() => setNav('earnings')}
                                            className="shrink-0 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-semibold transition-colors"
                                        >
                                            Withdraw Now
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* ── Pro tip banner ─────────────────────────── */}
                            {!proTipDismissed && (
                                <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-4 flex flex-wrap items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-violet-500/15 flex items-center justify-center shrink-0">
                                        <StarIcon className="w-4 h-4 text-violet-300" />
                                    </div>
                                    <div className="flex-1 min-w-[200px]">
                                        <p className="text-sm font-semibold text-violet-300">Pro Tip</p>
                                        <p className="text-sm text-white/60">Add more portfolio pieces to increase your chances of getting hired by 40%.</p>
                                    </div>
                                    <button
                                        onClick={() => setNav('portfolio')}
                                        className="shrink-0 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm font-medium transition-colors"
                                    >
                                        Upload Portfolio
                                    </button>
                                    <button
                                        onClick={() => { setProTipDismissed(true); localStorage.setItem('clipixx_dash_protip', 'dismissed'); }}
                                        className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                                        aria-label="Dismiss tip"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </>
                    )}

                    {/* ── Orders (bookings + legacy) ─────────────────────── */}
                    {nav === 'orders' && (
                        <>
                            <SectionHeading title="Orders" subtitle="Manage your bookings and direct orders." />
                            <div className="inline-flex items-center gap-1 bg-white/5 rounded-xl p-1">
                                <button
                                    onClick={() => setOrdersView('bookings')}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${ordersView === 'bookings' ? 'bg-violet-600 text-white' : 'text-white/50 hover:text-white'}`}
                                >
                                    Bookings
                                    {Number(dashStats?.pending_count ?? 0) > 0 && (
                                        <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white">{dashStats?.pending_count}</span>
                                    )}
                                </button>
                                <button
                                    onClick={() => setOrdersView('direct')}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${ordersView === 'direct' ? 'bg-violet-600 text-white' : 'text-white/50 hover:text-white'}`}
                                >
                                    Direct Orders
                                    {Number(stats?.pending_count ?? 0) > 0 && (
                                        <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white">{stats?.pending_count}</span>
                                    )}
                                </button>
                            </div>
                            {bookingsError && <p className="text-sm text-red-400">{bookingsError}</p>}
                            {ordersView === 'bookings' ? (
                                <BookingsTab profileId={starId} onError={setBookingsError} />
                            ) : (
                                <OrdersTab
                                    orders={orders} loading={loading} error={error}
                                    filter={filter} setFilter={setFilter}
                                    expandedId={expandedId} setExpandedId={setExpandedId}
                                    onRetry={loadData} onStatus={handleStatus} onDeliver={openDeliver}
                                />
                            )}
                        </>
                    )}

                    {nav === 'earnings' && (
                        <>
                            <SectionHeading title="Earnings" subtitle="Your income, payouts and monthly performance." />
                            {bookingsError && <p className="text-sm text-red-400">{bookingsError}</p>}
                            <EarningsTab
                                thisMonthEarnings={dashStats?.this_month_earnings ?? 0}
                                thisMonthBookings={dashStats?.this_month_bookings ?? 0}
                                onError={setBookingsError}
                            />
                        </>
                    )}

                    {nav === 'reviews' && (
                        <>
                            <SectionHeading title="Reviews" subtitle="What fans say after their orders are delivered." />
                            {starId && reviewCount > 0 ? (
                                <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-6">
                                    <BookingReviewsSection starId={starId} totalCount={reviewCount} />
                                </div>
                            ) : (
                                <EmptyPanel icon={StarIcon} title="No reviews yet" text="Reviews appear here once fans rate your delivered videos." />
                            )}
                        </>
                    )}

                    {nav === 'portfolio' && (
                        <>
                            <SectionHeading title="Portfolio" subtitle="Showcase your best work to win more bookings." />
                            <EmptyPanel
                                icon={ImageIcon}
                                title="Portfolio coming soon"
                                text="Portfolio management is on its way. Meanwhile, your gallery is shown on your public profile."
                                action={starId ? { label: 'View my public profile', onClick: () => navigate(`/creator/${starId}`) } : undefined}
                            />
                        </>
                    )}

                    {nav === 'analytics' && (
                        <>
                            <SectionHeading title="Analytics" subtitle="Earnings trend and order flow at a glance." />
                            <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
                                <EarningsOverview
                                    range={range} setRange={setRange}
                                    series={earningsSeries} windowTotal={windowTotal} delta={earningsDelta}
                                />
                                <OrdersPipeline
                                    dashStats={dashStats} totalOrders={bookingsTotal}
                                    newLast7={newLast7} onViewAll={() => setNav('orders')}
                                />
                            </div>
                        </>
                    )}

                    {nav === 'verification' && (
                        <>
                            <SectionHeading title="Verification" subtitle="Verify your identity and social account ownership." />
                            <div className="max-w-3xl"><VerificationTab /></div>
                        </>
                    )}

                    {nav === 'settings' && (
                        <>
                            <SectionHeading title="Settings" subtitle="Profile, pricing and account preferences." />
                            {bookingsError && <p className="text-sm text-red-400">{bookingsError}</p>}
                            <SettingsTab onError={setBookingsError} onToast={showToast} />
                        </>
                    )}
                </main>
            </div>

            {/* Deliver modal */}
            <AnimatePresence>
                {deliverFor && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[120] flex items-center justify-center p-4"
                    >
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !delivering && setDeliverFor(null)} />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-md bg-white dark:bg-dark-800 rounded-2xl border border-gray-100 dark:border-dark-700 shadow-xl p-6"
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-11 h-11 rounded-xl bg-indigo-100 dark:bg-indigo-500/15 flex items-center justify-center">
                                    <Video className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-semibold text-gray-900 dark:text-white">Deliver Video</h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                        {ORDER_TYPE_LABELS[deliverFor.order_type]} · {deliverFor.buyer_name}
                                    </p>
                                </div>
                            </div>

                            {deliverFor.instructions && (
                                <div className="mb-4 p-3 rounded-xl bg-gray-50 dark:bg-dark-700 text-sm text-gray-600 dark:text-gray-300">
                                    <p className="text-xs font-medium text-gray-400 mb-1">Instructions</p>
                                    {deliverFor.instructions}
                                </div>
                            )}

                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5">Video URL</label>
                            <input
                                type="url"
                                value={videoUrl}
                                onChange={(e) => setVideoUrl(e.target.value)}
                                placeholder="https://…"
                                className="w-full rounded-xl bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 px-3 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                            />

                            {deliverError && <p className="mt-2 text-sm text-red-500">{deliverError}</p>}

                            <div className="flex items-center justify-end gap-2 mt-5">
                                <button
                                    onClick={() => setDeliverFor(null)}
                                    disabled={delivering}
                                    className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeliver}
                                    disabled={delivering}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white transition"
                                >
                                    {delivering && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {delivering ? 'Delivering…' : 'Deliver'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── Overview building blocks ────────────────────────────────────────────────

function SectionHeading({ title, subtitle }: { title: string; subtitle: string }) {
    return (
        <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="text-sm text-white/50">{subtitle}</p>
        </div>
    );
}

function Panel({ title, action, children }: {
    title: string;
    action?: { label: string; onClick: () => void };
    children: React.ReactNode;
}) {
    return (
        <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-5">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold">{title}</h2>
                {action && (
                    <button onClick={action.onClick} className="text-xs font-medium text-violet-300 hover:text-violet-200 transition-colors">
                        {action.label}
                    </button>
                )}
            </div>
            {children}
        </div>
    );
}

function EmptyHint({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
    return (
        <div className="py-8 text-center">
            <Icon className="w-8 h-8 text-white/15 mx-auto mb-2" />
            <p className="text-sm text-white/40">{text}</p>
        </div>
    );
}

function EmptyPanel({ icon: Icon, title, text, action }: {
    icon: React.ElementType; title: string; text: string;
    action?: { label: string; onClick: () => void };
}) {
    return (
        <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-12 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                <Icon className="w-7 h-7 text-white/30" />
            </div>
            <h3 className="font-semibold">{title}</h3>
            <p className="text-sm text-white/40 mt-1 max-w-sm mx-auto">{text}</p>
            {action && (
                <button onClick={action.onClick} className="mt-4 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm font-medium transition-colors">
                    {action.label}
                </button>
            )}
        </div>
    );
}

function StatCard({ icon, iconBg, label, value, delta, spark, sparkColor, loading, neutralDelta }: {
    icon: React.ReactNode; iconBg: string;
    label: string; value: string; delta: string;
    spark: number[]; sparkColor: string;
    loading?: boolean; neutralDelta?: boolean;
}) {
    const data = spark.map((v, i) => ({ i, v }));
    return (
        <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-4 flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>{icon}</div>
            <div className="flex-1 min-w-0">
                <p className="text-xs text-white/45">{label}</p>
                {loading ? (
                    <div className="h-7 w-16 mt-1 bg-white/5 rounded animate-pulse" />
                ) : (
                    <p className="text-2xl font-bold truncate">{value}</p>
                )}
                <p className={`mt-0.5 text-[11px] flex items-center gap-1 ${neutralDelta ? 'text-white/40' : 'text-emerald-400'}`}>
                    {!neutralDelta && <TrendingUp className="w-3 h-3" />} {delta}
                </p>
            </div>
            <div className="w-20 h-10 shrink-0 self-center">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 4, right: 0, bottom: 4, left: 0 }}>
                        <Line type="monotone" dataKey="v" stroke={sparkColor} strokeWidth={2} dot={false} isAnimationActive={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

function EarningsOverview({ range, setRange, series, windowTotal, delta }: {
    range: 7 | 30 | 90; setRange: (r: 7 | 30 | 90) => void;
    series: { label: string; value: number }[];
    windowTotal: number; delta: number | null;
}) {
    return (
        <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-5">
            <div className="flex items-center justify-between gap-3 mb-2">
                <h2 className="text-base font-semibold">Earnings Overview</h2>
                <select
                    value={range}
                    onChange={(e) => setRange(Number(e.target.value) as 7 | 30 | 90)}
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:ring-2 focus:ring-violet-500 [color-scheme:dark]"
                >
                    <option value={7}>Last 7 Days</option>
                    <option value={30}>Last 30 Days</option>
                    <option value={90}>Last 90 Days</option>
                </select>
            </div>
            <p className="text-xs text-white/40">Total Earnings</p>
            <div className="flex items-baseline gap-3 mb-4">
                <p className="text-3xl font-bold">₹{formatINR(windowTotal)}</p>
                {delta !== null ? (
                    <span className={`text-xs flex items-center gap-1 ${delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        <TrendingUp className={`w-3.5 h-3.5 ${delta < 0 ? 'rotate-180' : ''}`} />
                        {delta >= 0 ? '+' : ''}{delta}% from previous {range} days
                    </span>
                ) : (
                    <span className="text-xs text-white/35">last {range} days</span>
                )}
            </div>
            <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                        <defs>
                            <linearGradient id="earnGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.4} />
                                <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                        <XAxis
                            dataKey="label" axisLine={false} tickLine={false}
                            tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                            interval="preserveStartEnd" minTickGap={48}
                        />
                        <YAxis
                            axisLine={false} tickLine={false} width={48}
                            tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                            tickFormatter={(v: number) => `₹${v >= 1000 ? `${Math.round(v / 1000)}K` : v}`}
                        />
                        <Tooltip
                            cursor={{ stroke: 'rgba(139,92,246,0.35)' }}
                            contentStyle={{
                                background: '#171a2e', border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: 12, color: '#fff', fontSize: 12,
                            }}
                            formatter={(v) => [`₹${formatINR(Number(v))}`, 'Earnings']}
                        />
                        <Area type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={2} fill="url(#earnGrad)" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

const PIPELINE_META = [
    { key: 'pending_count', label: 'Pending', color: 'text-amber-400', bar: 'bg-amber-500', icon: Clock },
    { key: 'accepted_count', label: 'Accepted', color: 'text-blue-400', bar: 'bg-blue-500', icon: CheckCircle },
    { key: 'in_progress_count', label: 'In Progress', color: 'text-violet-400', bar: 'bg-violet-500', icon: Loader2 },
    { key: 'delivered_count', label: 'Delivered', color: 'text-emerald-400', bar: 'bg-emerald-500', icon: Truck },
] as const;

function OrdersPipeline({ dashStats, totalOrders, newLast7, onViewAll }: {
    dashStats: CreatorDashboardStats | null;
    totalOrders: number; newLast7: number; onViewAll: () => void;
}) {
    const counts = PIPELINE_META.map((m) => Number(dashStats?.[m.key] ?? 0));
    const total = sum(counts);
    return (
        <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-5 flex flex-col">
            <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-semibold">Orders Pipeline</h2>
                <button onClick={onViewAll} className="text-xs font-medium text-violet-300 hover:text-violet-200 transition-colors">
                    View All Orders
                </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
                {PIPELINE_META.map((m, i) => (
                    <div key={m.key} className="text-center sm:border-r last:border-r-0 sm:border-white/5">
                        <p className={`text-xs font-medium ${m.color}`}>{m.label}</p>
                        <div className="flex items-center justify-center gap-2 mt-2">
                            <span className={`text-3xl font-bold ${m.color}`}>
                                {dashStats ? counts[i] : '—'}
                            </span>
                            <span className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                                <m.icon className={`w-4 h-4 ${m.color}`} />
                            </span>
                        </div>
                    </div>
                ))}
            </div>
            {/* Proportional progress bar */}
            <div className="mt-5 h-1.5 rounded-full overflow-hidden flex bg-white/5">
                {total > 0 ? (
                    PIPELINE_META.map((m, i) => (
                        counts[i] > 0 && (
                            <div key={m.key} className={m.bar} style={{ width: `${(counts[i] / total) * 100}%` }} />
                        )
                    ))
                ) : (
                    <div className="w-full bg-white/5" />
                )}
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-white/50">{totalOrders} Total Orders</span>
                <span className="text-emerald-400">+{newLast7} from last 7 days</span>
            </div>
        </div>
    );
}

function ProgressRing({ pct }: { pct: number }) {
    const r = 30;
    const c = 2 * Math.PI * r;
    return (
        <div className="relative w-[76px] h-[76px] shrink-0">
            <svg viewBox="0 0 76 76" className="w-full h-full -rotate-90">
                <circle cx="38" cy="38" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
                <circle
                    cx="38" cy="38" r={r} fill="none"
                    stroke="#34d399" strokeWidth="6" strokeLinecap="round"
                    strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
                />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">{pct}%</span>
        </div>
    );
}

function ChecklistRow({ label, ok, okText, warnText, onAction }: {
    label: string; ok: boolean; okText: string; warnText: string; onAction: () => void;
}) {
    return (
        <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-white/70">{label}</span>
            {ok ? (
                <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                    <CheckCircle className="w-3.5 h-3.5" /> {okText}
                </span>
            ) : (
                <button onClick={onAction} className="flex items-center gap-1.5 text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors">
                    <AlertTriangle className="w-3.5 h-3.5" /> {warnText}
                </button>
            )}
        </div>
    );
}

function activityMeta(r: RecentItem): { icon: React.ElementType; text: string; bg: string; fg: string } {
    switch (r.status) {
        case 'completed':
            return { icon: IndianRupee, text: `Payment received — ₹${formatINR(r.amount)} from ${r.client}`, bg: 'bg-emerald-500/15', fg: 'text-emerald-300' };
        case 'delivered':
            return { icon: Truck, text: `Order delivered to ${r.client}`, bg: 'bg-emerald-500/15', fg: 'text-emerald-300' };
        case 'in_progress':
            return { icon: Loader2, text: `Working on ${r.client}'s order`, bg: 'bg-violet-500/15', fg: 'text-violet-300' };
        case 'accepted':
            return { icon: Package, text: `Order from ${r.client} accepted`, bg: 'bg-blue-500/15', fg: 'text-blue-300' };
        default:
            return { icon: Clock, text: `New order received from ${r.client}`, bg: 'bg-amber-500/15', fg: 'text-amber-300' };
    }
}

// ─── Orders Tab (legacy direct orders — logic unchanged) ─────────────────────

type OrdersTabProps = {
    orders: Order[];
    loading: boolean;
    error: string | null;
    filter: OrderStatus | 'all';
    setFilter: (f: OrderStatus | 'all') => void;
    expandedId: string | null;
    setExpandedId: (id: string | null) => void;
    onRetry: () => void;
    onStatus: (order: Order, status: OrderStatus, reason?: string) => void;
    onDeliver: (order: Order) => void;
};

function OrdersTab({ orders, loading, error, filter, setFilter, expandedId, setExpandedId, onRetry, onStatus, onDeliver }: OrdersTabProps) {
    return (
        <>
            {/* Filter pills */}
            <div className="flex flex-wrap gap-2 mb-6">
                {STATUS_FILTERS.map((f) => (
                    <button
                        key={f.value}
                        onClick={() => setFilter(f.value)}
                        className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
                            filter === f.value
                                ? 'bg-violet-600 text-white'
                                : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
                        }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/25 text-red-300 rounded-xl flex items-center justify-between gap-4">
                    <span className="text-sm">{error}</span>
                    <button onClick={onRetry} className="text-sm underline hover:no-underline shrink-0">Retry</button>
                </div>
            )}

            {loading ? (
                <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-100 dark:border-dark-700 shadow-sm p-5 animate-pulse">
                            <div className="h-4 w-1/3 bg-gray-200 dark:bg-dark-700 rounded mb-3" />
                            <div className="h-3 w-2/3 bg-gray-200 dark:bg-dark-700 rounded" />
                        </div>
                    ))}
                </div>
            ) : orders.length === 0 && !error ? (
                <div className="text-center py-20">
                    <div className="w-14 h-14 mx-auto rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                        <Package className="w-7 h-7 text-white/30" />
                    </div>
                    <p className="text-white/40">No orders here yet.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {orders.map((order) => (
                        <OrderCard
                            key={order.id}
                            order={order}
                            expanded={expandedId === order.id}
                            onToggle={() => setExpandedId(expandedId === order.id ? null : order.id)}
                            onStatus={onStatus}
                            onDeliver={onDeliver}
                        />
                    ))}
                </div>
            )}
        </>
    );
}

function StatusBadge({ status }: { status: OrderStatus }) {
    const Icon = STATUS_ICONS[status];
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[status]}`}>
            <Icon className={`w-3.5 h-3.5 ${status === 'in_progress' ? 'animate-spin' : ''}`} />
            {STATUS_LABELS[status]}
        </span>
    );
}

function OrderCard({ order, expanded, onToggle, onStatus, onDeliver }: {
    order: Order;
    expanded: boolean;
    onToggle: () => void;
    onStatus: (order: Order, status: OrderStatus, reason?: string) => void;
    onDeliver: (order: Order) => void;
}) {
    return (
        <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-100 dark:border-dark-700 shadow-sm overflow-hidden">
            {/* Collapsed header */}
            <button onClick={onToggle} className="w-full text-left p-5 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 dark:text-white">{order.buyer_name}</span>
                        <StatusBadge status={order.status} />
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">
                        {ORDER_TYPE_LABELS[order.order_type]}
                        {order.recipient_name ? ` · for ${order.recipient_name}` : ''}
                        {order.occasion ? ` · ${order.occasion}` : ''}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDate(order.created_at)}</p>
                </div>
                <div className="text-right shrink-0">
                    <p className="font-bold text-gray-900 dark:text-white">₹{formatINR(order.price)}</p>
                </div>
                <ChevronDown className={`w-5 h-5 text-gray-400 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>

            {/* Expanded */}
            <AnimatePresence initial={false}>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="px-5 pb-5 pt-1 border-t border-gray-100 dark:border-dark-700 space-y-4">
                            {order.instructions && (
                                <div className="p-3 rounded-xl bg-gray-50 dark:bg-dark-700">
                                    <p className="text-xs font-medium text-gray-400 mb-1">Instructions</p>
                                    <p className="text-sm text-gray-700 dark:text-gray-300">{order.instructions}</p>
                                </div>
                            )}

                            {(order.company_name || order.event_name || order.event_date) && (
                                <div className="grid sm:grid-cols-2 gap-3">
                                    {order.company_name && (
                                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                                            <Building2 className="w-4 h-4 text-gray-400" /> {order.company_name}
                                        </div>
                                    )}
                                    {order.event_name && (
                                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                                            <CalendarDays className="w-4 h-4 text-gray-400" /> {order.event_name}
                                        </div>
                                    )}
                                    {order.event_date && (
                                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                                            <CalendarDays className="w-4 h-4 text-gray-400" /> {formatDate(order.event_date)}
                                        </div>
                                    )}
                                </div>
                            )}

                            {order.video_url && (
                                <a
                                    href={order.video_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                                >
                                    <Play className="w-4 h-4" /> View delivered video
                                </a>
                            )}

                            {/* Actions */}
                            <div className="flex flex-wrap gap-2 pt-1">
                                {order.status === 'pending' && (
                                    <>
                                        <button
                                            onClick={() => onStatus(order, 'accepted')}
                                            className="px-4 py-2 rounded-xl text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white transition"
                                        >
                                            Accept
                                        </button>
                                        <button
                                            onClick={() => onStatus(order, 'rejected')}
                                            className="px-4 py-2 rounded-xl text-sm font-medium border border-red-300 dark:border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
                                        >
                                            Reject
                                        </button>
                                    </>
                                )}
                                {order.status === 'accepted' && (
                                    <button
                                        onClick={() => onStatus(order, 'in_progress')}
                                        className="px-4 py-2 rounded-xl text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white transition"
                                    >
                                        Start Working
                                    </button>
                                )}
                                {(order.status === 'accepted' || order.status === 'in_progress') && (
                                    <button
                                        onClick={() => onDeliver(order)}
                                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition"
                                    >
                                        <Video className="w-4 h-4" /> Deliver Video
                                    </button>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── Verification Tab (logic unchanged) ──────────────────────────────────────

function VerificationTab() {
    const [info, setInfo] = useState<VerificationInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({
        platform: '' as SocialPlatform | '',
        profile_url: '',
        follower_count: '',
        identity_proof_type: '' as IdentityProofType | '',
        identity_proof_url: '',
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [consent, setConsent] = useState(false);

    // Ownership-proof step (appears after the form is first submitted).
    const [ownershipMethod, setOwnershipMethod] = useState<OwnershipMethod | ''>('');
    const [notifying, setNotifying] = useState(false);
    const [copied, setCopied] = useState(false);

    // Pre-fill the profile URL from whichever platform link the star already has.
    const profileUrlFor = (v: VerificationInfo, p: SocialPlatform | ''): string => {
        switch (p) {
            case 'instagram': return v.instagram_url || '';
            case 'youtube':   return v.youtube_url || '';
            case 'twitter':   return v.twitter_url || '';
            case 'tiktok':    return v.tiktok_url || '';
            default:          return v.instagram_url || v.youtube_url || v.twitter_url || v.tiktok_url || '';
        }
    };

    const load = useCallback(() => {
        setLoading(true);
        getVerificationStatus()
            .then((v) => {
                setInfo(v);
                if (v) {
                    const platform = v.platform || '';
                    setForm({
                        platform,
                        profile_url: profileUrlFor(v, platform),
                        follower_count: v.follower_count != null ? String(v.follower_count) : '',
                        identity_proof_type: v.identity_proof_type || '',
                        identity_proof_url: v.identity_proof_url || '',
                    });
                    setOwnershipMethod(v.ownership_method || '');
                }
            })
            .catch(() => setInfo(null))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    const isVerified = info?.is_verified || info?.verification_status === 'approved' || info?.verification_status === 'verified';
    const isPending = !isVerified && info?.verification_status === 'pending';
    const isRejected = info?.verification_status === 'rejected';
    // The ownership section unlocks once a code has been generated by a submit.
    const hasCode = Boolean(info?.ownership_code);

    const buildSocialPayload = (): Partial<Record<'instagram_url' | 'youtube_url' | 'twitter_url' | 'tiktok_url', string>> => {
        const url = form.profile_url.trim();
        if (!url || !form.platform) return {};
        return { [`${form.platform}_url`]: url };
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!form.platform) { setError('Select your primary social platform.'); return; }
        if (!form.profile_url.trim()) { setError('Enter your profile URL.'); return; }
        if (!form.identity_proof_url.trim() || !form.identity_proof_type) {
            setError('Identity proof URL and ID type are required.');
            return;
        }
        if (!consent) {
            setError('Please confirm the ownership consent before submitting.');
            return;
        }
        setSubmitting(true);
        try {
            const updated = await submitVerification({
                platform: form.platform,
                follower_count: form.follower_count ? Number(form.follower_count) : undefined,
                identity_proof_url: form.identity_proof_url.trim(),
                identity_proof_type: form.identity_proof_type as IdentityProofType,
                consent,
                ...buildSocialPayload(),
            });
            setInfo(updated);
            setOwnershipMethod(updated.ownership_method || '');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to submit verification');
        } finally {
            setSubmitting(false);
        }
    };

    const handleNotifyAdmin = async () => {
        if (!ownershipMethod) { setError('Pick how you added the ownership code.'); return; }
        setError(null);
        setNotifying(true);
        try {
            const updated = await notifyAdminVerification(ownershipMethod as OwnershipMethod);
            setInfo(updated);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to notify admin');
        } finally {
            setNotifying(false);
        }
    };

    const copyCode = async () => {
        if (!info?.ownership_code) return;
        try {
            await navigator.clipboard.writeText(info.ownership_code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch { /* clipboard unavailable — ignore */ }
    };

    if (loading) {
        return (
            <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-100 dark:border-dark-700 shadow-sm p-10 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
            </div>
        );
    }

    if (isVerified) {
        return (
            <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-100 dark:border-dark-700 shadow-sm p-8 text-center">
                <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center mb-4">
                    <BadgeCheck className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">You're Verified!</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Verified on {formatDate(info?.verified_at ?? null)}</p>
                <div className="flex items-center justify-center gap-3 mt-5">
                    {info?.instagram_url && <a href={info.instagram_url} target="_blank" rel="noreferrer" className="text-pink-500 hover:opacity-80"><Instagram className="w-5 h-5" /></a>}
                    {info?.youtube_url && <a href={info.youtube_url} target="_blank" rel="noreferrer" className="text-red-500 hover:opacity-80"><Youtube className="w-5 h-5" /></a>}
                    {info?.twitter_url && <a href={info.twitter_url} target="_blank" rel="noreferrer" className="text-sky-500 hover:opacity-80"><Twitter className="w-5 h-5" /></a>}
                </div>
            </div>
        );
    }

    if (isPending) {
        return (
            <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-100 dark:border-dark-700 shadow-sm p-8 text-center">
                <div className="w-16 h-16 mx-auto rounded-full bg-amber-100 dark:bg-amber-500/15 flex items-center justify-center mb-4">
                    <Clock className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Verification Pending</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Your submission is under review. We'll notify you once it's processed.</p>
                {info?.ownership_code && (
                    <p className="text-xs text-gray-400 mt-3">
                        Keep <span className="font-mono font-semibold text-purple-500">{info.ownership_code}</span> in your{' '}
                        {info.ownership_method === 'bio' ? 'bio' : info.ownership_method === 'story' ? 'story' : 'email reply'} until an admin confirms it.
                    </p>
                )}
            </div>
        );
    }

    // Unverified or rejected → the full submission form.
    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-purple-500" />
                <h3 className="font-semibold text-white">Get Verified</h3>
            </div>

            {isRejected && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-sm text-red-600 dark:text-red-400 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                        Your previous submission was rejected
                        {info?.verification_notes ? <>: <span className="font-medium">{info.verification_notes}</span></> : '.'} Please review your details and resubmit.
                    </span>
                </div>
            )}

            {/* ── Section 1: Social Account ── */}
            <Section icon={<Users className="w-4 h-4 text-purple-500" />} title="Social Account" subtitle="Tell us which account you want verified.">
                <Field label="Platform" required>
                    <select
                        value={form.platform}
                        onChange={(e) => {
                            const platform = e.target.value as SocialPlatform | '';
                            setForm((f) => ({ ...f, platform, profile_url: info && platform ? profileUrlFor(info, platform) : f.profile_url }));
                        }}
                        className={selectCls}
                    >
                        <option value="">Select platform…</option>
                        {PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                </Field>
                <Field label="Profile URL" required>
                    <input
                        type="url"
                        value={form.profile_url}
                        onChange={(e) => setForm({ ...form, profile_url: e.target.value })}
                        placeholder="https://instagram.com/yourhandle"
                        className={inputCls}
                    />
                </Field>
                <Field label="Follower count">
                    <input
                        type="number"
                        min={0}
                        value={form.follower_count}
                        onChange={(e) => setForm({ ...form, follower_count: e.target.value })}
                        placeholder="e.g. 25000"
                        className={inputCls}
                    />
                </Field>
            </Section>

            {/* ── Section 2: Identity Proof ── */}
            <Section icon={<UserSquare2 className="w-4 h-4 text-purple-500" />} title="Identity Proof" subtitle="Confirm who you are with a government ID.">
                <Field label="ID type" required>
                    <select
                        value={form.identity_proof_type}
                        onChange={(e) => setForm({ ...form, identity_proof_type: e.target.value as IdentityProofType })}
                        className={selectCls}
                    >
                        <option value="">Select ID type…</option>
                        {ID_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                </Field>
                <Field label="ID document URL" required>
                    <input
                        type="url"
                        value={form.identity_proof_url}
                        onChange={(e) => setForm({ ...form, identity_proof_url: e.target.value })}
                        placeholder="https://drive.google.com/…"
                        className={inputCls}
                    />
                    <p className="mt-1.5 text-xs text-gray-400 flex items-start gap-1.5">
                        <FileText className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        Upload your document to Google Drive or Dropbox (set to "Anyone with link can view") and paste the link here. We keep this private and secure.
                    </p>
                </Field>
            </Section>

            {/* ── Section 3: Ownership Proof (after first submit) ── */}
            <Section icon={<KeyRound className="w-4 h-4 text-purple-500" />} title="Ownership Proof" subtitle="Prove you control the social account.">
                {!hasCode ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Submit the form below and we'll generate a unique ownership code for you here.
                    </p>
                ) : (
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30">
                            <span className="font-mono text-lg font-bold tracking-wider text-purple-700 dark:text-purple-300">{info!.ownership_code}</span>
                            <button
                                type="button"
                                onClick={copyCode}
                                className="ml-auto flex items-center gap-1.5 text-xs font-medium text-purple-600 dark:text-purple-300 hover:opacity-80"
                            >
                                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                {copied ? 'Copied' : 'Copy'}
                            </button>
                        </div>

                        <p className="text-sm text-gray-600 dark:text-gray-300">Choose how you'll prove ownership:</p>
                        <div className="space-y-2.5">
                            {OWNERSHIP_OPTIONS.map((opt) => (
                                <label
                                    key={opt.value}
                                    className={`flex gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                                        ownershipMethod === opt.value
                                            ? 'border-purple-400 dark:border-purple-500/60 bg-purple-50 dark:bg-purple-500/10'
                                            : 'border-gray-200 dark:border-dark-600 hover:bg-gray-50 dark:hover:bg-dark-700'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="ownership_method"
                                        value={opt.value}
                                        checked={ownershipMethod === opt.value}
                                        onChange={() => setOwnershipMethod(opt.value)}
                                        className="mt-1 accent-purple-600"
                                    />
                                    <span className="min-w-0">
                                        <span className="block text-sm font-medium text-gray-900 dark:text-white">{opt.label}</span>
                                        <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">{opt.help(info!.ownership_code!)}</span>
                                    </span>
                                </label>
                            ))}
                        </div>

                        <button
                            type="button"
                            onClick={handleNotifyAdmin}
                            disabled={notifying || !ownershipMethod}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white transition"
                        >
                            {notifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <BadgeCheck className="w-4 h-4" />}
                            {notifying ? 'Notifying…' : "I've done this — notify admin to verify"}
                        </button>
                    </div>
                )}
            </Section>

            {/* Digital consent — required before submitting */}
            <label className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-300">
                <input
                    type="checkbox"
                    required
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-1 h-4 w-4 accent-purple-600"
                />
                <span>
                    I confirm that I am the owner, manager, or authorized representative of this account,
                    and that the information I have provided is accurate.
                </span>
            </label>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button
                type="submit"
                disabled={submitting || !consent}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white transition"
            >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                {submitting ? 'Saving…' : hasCode ? 'Update details' : 'Submit for Verification'}
            </button>
        </form>
    );
}

const inputCls = 'w-full rounded-xl bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 px-3 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500';
const selectCls = inputCls;

function Section({ icon, title, subtitle, children }: {
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    children: React.ReactNode;
}) {
    return (
        <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-100 dark:border-dark-700 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-1">
                {icon}
                <h4 className="font-semibold text-gray-900 dark:text-white">{title}</h4>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{subtitle}</p>
            <div className="space-y-4">{children}</div>
        </div>
    );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
    return (
        <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            {children}
        </div>
    );
}
