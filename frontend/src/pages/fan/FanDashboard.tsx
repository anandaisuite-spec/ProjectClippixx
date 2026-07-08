import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Loader2, Package, Clock, Video, Star as StarIcon, CheckCircle, Gift,
    Download, Inbox, MessageSquare, User,
} from 'lucide-react';
import { useAuth } from '@/providers/AuthProvider';
import { useRole } from '@/hooks/useRole';
import {
    getFanStats, getFanBookings, getFanVideos, getFanReviews, updateFanSettings, getMyProfile,
    type FanDashboardStats, type FanBookingRow, type FanReview, type BookingStatus,
} from '@/services/api';
import StarRating from '@/features/creator/components/StarRating';

const STATUS_BADGE: Record<BookingStatus, string> = {
    pending: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400',
    accepted: 'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400',
    in_progress: 'bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400',
    delivered: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
    cancelled: 'bg-gray-200 dark:bg-dark-700 text-gray-500 dark:text-gray-400',
};
const STATUS_LABEL: Record<BookingStatus, string> = {
    pending: 'Pending', accepted: 'Accepted', in_progress: 'In Progress', delivered: 'Delivered', cancelled: 'Cancelled',
};
const FILTERS: { label: string; value: BookingStatus | 'all' }[] = [
    { label: 'All', value: 'all' }, { label: 'Pending', value: 'pending' }, { label: 'Accepted', value: 'accepted' },
    { label: 'In Progress', value: 'in_progress' }, { label: 'Delivered', value: 'delivered' }, { label: 'Cancelled', value: 'cancelled' },
];

function relativeTime(iso: string): string {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
    const months = Math.floor(days / 30);
    return months < 12 ? `${months} month${months === 1 ? '' : 's'} ago` : `${Math.floor(months / 12)} year(s) ago`;
}
const formatINR = (n: number | null | undefined) => (Number.isFinite(Number(n)) ? Number(n) : 0).toLocaleString('en-IN');

/** Round avatar — image or initial fallback. */
function Avatar({ url, name, size = 'md' }: { url: string | null; name: string | null; size?: 'sm' | 'md' }) {
    const cls = size === 'sm' ? 'w-9 h-9 text-sm' : 'w-11 h-11 text-base';
    return url
        ? <img src={url} alt={name || ''} className={`${cls} rounded-full object-cover shrink-0`} />
        : <div className={`${cls} rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 font-bold flex items-center justify-center shrink-0`}>{(name || 'C').slice(0, 1).toUpperCase()}</div>;
}

export default function FanDashboard() {
    const navigate = useNavigate();
    const { user, loading: authLoading } = useAuth();
    const { isCreator, loading: roleLoading } = useRole();

    const [tab, setTab] = useState<'bookings' | 'videos' | 'reviews' | 'settings'>('bookings');
    const [stats, setStats] = useState<FanDashboardStats | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const showToast = useCallback((m: string) => { setToast(m); setTimeout(() => setToast(null), 3000); }, []);

    // Auth + creator redirect.
    useEffect(() => {
        if (authLoading || roleLoading) return;
        if (!user) { navigate('/', { replace: true }); return; }
        if (isCreator) { navigate('/creator-dashboard', { replace: true }); }
    }, [authLoading, roleLoading, user, isCreator, navigate]);

    useEffect(() => {
        getFanStats().then(setStats).catch(() => setStats(null));
    }, []);

    if (authLoading || roleLoading || !user || isCreator) {
        return <div className="min-h-screen bg-gray-50 dark:bg-dark-900 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>;
    }

    const statCards = [
        { label: 'Total Bookings', value: stats?.total_bookings, icon: Package, color: 'bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400' },
        { label: 'Pending', value: stats?.pending_count, icon: Clock, color: 'bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400' },
        { label: 'Videos Received', value: stats?.videos_received, icon: Video, color: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
        { label: 'Reviews Left', value: stats?.reviews_left, icon: StarIcon, color: 'bg-purple-100 dark:bg-purple-500/15 text-purple-600 dark:text-purple-400' },
    ];

    const tabs = [
        { key: 'bookings', label: 'Bookings' },
        { key: 'videos', label: 'My Videos' },
        { key: 'reviews', label: 'Reviews' },
        { key: 'settings', label: 'Settings' },
    ] as const;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-dark-900 pt-24 pb-16 px-4 sm:px-6">
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
                        className="fixed top-20 right-4 z-[150] flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 text-white text-sm shadow-lg"
                    >
                        <CheckCircle className="w-4 h-4" /> {toast}
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="max-w-5xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">My Dashboard</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Your bookings, videos and reviews.</p>
                </div>

                {/* Stats — 2x2 mobile, 4-up desktop */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {statCards.map((c) => (
                        <div key={c.label} className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-100 dark:border-dark-700 shadow-sm p-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 ${c.color}`}><c.icon className="w-5 h-5" /></div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{c.label}</p>
                            {!stats ? <div className="h-6 w-12 mt-1 bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
                                : <p className="text-xl font-bold text-gray-900 dark:text-white">{c.value ?? 0}</p>}
                        </div>
                    ))}
                </div>

                {/* Tabs */}
                <div className="inline-flex items-center gap-1 bg-gray-100 dark:bg-dark-800 rounded-xl p-1 mb-6 max-w-full overflow-x-auto">
                    {tabs.map((t) => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors shrink-0 ${
                                tab === t.key ? 'bg-white dark:bg-dark-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {tab === 'bookings' && <BookingsTab onError={showToast} />}
                {tab === 'videos' && <VideosTab onError={showToast} />}
                {tab === 'reviews' && <ReviewsTab onError={showToast} />}
                {tab === 'settings' && <SettingsTab onToast={showToast} onError={showToast} />}
            </div>
        </div>
    );
}

// ─── Bookings tab ─────────────────────────────────────────────────────────────
function BookingsTab({ onError }: { onError: (m: string) => void }) {
    const [filter, setFilter] = useState<BookingStatus | 'all'>('all');
    const [rows, setRows] = useState<FanBookingRow[]>([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    const fetchPage = useCallback(async (target: number, replace: boolean) => {
        if (replace) setLoading(true); else setLoadingMore(true);
        try {
            const res = await getFanBookings({ status: filter === 'all' ? undefined : filter, page: target, limit: 10 });
            setRows((prev) => (replace ? res.bookings : [...prev, ...res.bookings]));
            setPage(res.page);
            setTotalPages(res.total_pages);
        } catch (err) {
            onError(err instanceof Error ? err.message : 'Failed to load bookings');
        } finally {
            setLoading(false); setLoadingMore(false);
        }
    }, [filter, onError]);

    useEffect(() => { fetchPage(1, true); }, [fetchPage]);

    if (loading) return <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

    return (
        <div>
            <div className="flex gap-2 mb-6 overflow-x-auto pb-1 -mx-1 px-1">
                {FILTERS.map((f) => (
                    <button key={f.value} onClick={() => setFilter(f.value)}
                        className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
                            filter === f.value ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-gray-100 dark:bg-dark-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-dark-700'}`}>
                        {f.label}
                    </button>
                ))}
            </div>

            {rows.length === 0 ? (
                <div className="py-16 flex flex-col items-center text-center">
                    <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-dark-800 flex items-center justify-center mb-4"><Inbox className="w-8 h-8 text-gray-400" /></div>
                    <p className="text-gray-600 dark:text-gray-300 font-medium">No bookings yet.</p>
                    <p className="text-sm text-gray-400 mt-1">Discover creators and book a personalized video!</p>
                    <Link to="/explore" className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white transition">Explore Creators</Link>
                </div>
            ) : (
                <div className="space-y-4">
                    {rows.map((b) => <BookingCard key={b.id} b={b} />)}
                    {page < totalPages && (
                        <div className="pt-2 flex justify-center">
                            <button onClick={() => fetchPage(page + 1, false)} disabled={loadingMore}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-gray-100 dark:bg-dark-800 hover:bg-gray-200 dark:hover:bg-dark-700 text-gray-700 dark:text-gray-200 transition disabled:opacity-50">
                                {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}{loadingMore ? 'Loading…' : 'Load more'}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function BookingCard({ b }: { b: FanBookingRow }) {
    const cancelled = b.status === 'cancelled';
    const delivered = b.status === 'delivered';
    return (
        <div className={`bg-white dark:bg-dark-800 rounded-2xl border border-gray-100 dark:border-dark-700 shadow-sm p-4 sm:p-5 ${cancelled ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between gap-3">
                <Link to={`/creator/${b.creator.id}`} className="flex items-center gap-3 min-w-0 group">
                    <Avatar url={b.creator.profile_picture_url} name={b.creator.display_name} />
                    <div className="min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-white group-hover:underline truncate">{b.creator.display_name || 'Creator'}</p>
                        {b.occasion && <p className="text-xs text-gray-500 dark:text-gray-400">{b.occasion}</p>}
                    </div>
                </Link>
                <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[b.status]}`}>{STATUS_LABEL[b.status]}</span>
            </div>

            <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-3">
                {b.tier_name && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-200">
                        {b.tier_name}{b.tier_price != null && <span className="font-bold">· ₹{formatINR(b.tier_price)}</span>}
                    </span>
                )}
                {b.is_gift && b.gift_recipient_name && (
                    <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400"><Gift className="w-3.5 h-3.5" /> Gift for {b.gift_recipient_name}</span>
                )}
                <span className="text-xs text-gray-400">{relativeTime(b.created_at)}</span>
            </div>

            {delivered && (
                <div className="flex flex-wrap gap-2 mt-4">
                    {b.video_url && (
                        <Link to={`/fan/bookings/${b.id}`} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white transition">
                            <Download className="w-4 h-4" /> Watch / Download
                        </Link>
                    )}
                    {!b.has_review ? (
                        <Link to={`/fan/bookings/${b.id}`} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 transition">
                            <StarIcon className="w-4 h-4" /> Leave a Review
                        </Link>
                    ) : (
                        <span className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                            <CheckCircle className="w-4 h-4" /> Reviewed
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Videos tab ───────────────────────────────────────────────────────────────
function VideosTab({ onError }: { onError: (m: string) => void }) {
    const [videos, setVideos] = useState<FanBookingRow[]>([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        let cancelled = false;
        getFanVideos().then((r) => { if (!cancelled) setVideos(r.videos); })
            .catch((err) => { if (!cancelled) onError(err instanceof Error ? err.message : 'Failed to load videos'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [onError]);

    if (loading) return <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
    if (videos.length === 0) {
        return (
            <div className="py-16 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-dark-800 flex items-center justify-center mb-4"><Video className="w-8 h-8 text-gray-400" /></div>
                <p className="text-gray-600 dark:text-gray-300 font-medium">No videos yet.</p>
                <p className="text-sm text-gray-400 mt-1">Your delivered videos will appear here.</p>
            </div>
        );
    }
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {videos.map((v) => (
                <div key={v.id} className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-100 dark:border-dark-700 shadow-sm p-5">
                    <div className="flex items-center gap-3">
                        <Avatar url={v.creator.profile_picture_url} name={v.creator.display_name} />
                        <div className="min-w-0">
                            <p className="font-semibold text-gray-900 dark:text-white truncate">{v.creator.display_name || 'Creator'}</p>
                            {v.tier_name && <p className="text-xs text-gray-500 dark:text-gray-400">{v.tier_name}</p>}
                        </div>
                    </div>
                    {v.is_gift && v.gift_recipient_name && (
                        <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">🎁 Gift for {v.gift_recipient_name}</p>
                    )}
                    <p className="mt-2 text-xs text-gray-400">{v.video_delivered_at ? `Delivered ${new Date(v.video_delivered_at).toLocaleDateString('en-IN')}` : 'Delivered'}</p>
                    <Link to={`/fan/bookings/${v.id}`} className="mt-4 w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white transition">
                        <Download className="w-5 h-5" /> Watch / Download
                    </Link>
                </div>
            ))}
        </div>
    );
}

// ─── Reviews tab ──────────────────────────────────────────────────────────────
function ReviewsTab({ onError }: { onError: (m: string) => void }) {
    const [reviews, setReviews] = useState<FanReview[]>([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        let cancelled = false;
        getFanReviews().then((r) => { if (!cancelled) setReviews(r.reviews); })
            .catch((err) => { if (!cancelled) onError(err instanceof Error ? err.message : 'Failed to load reviews'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [onError]);

    if (loading) return <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
    if (reviews.length === 0) {
        return (
            <div className="py-16 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-dark-800 flex items-center justify-center mb-4"><MessageSquare className="w-8 h-8 text-gray-400" /></div>
                <p className="text-gray-600 dark:text-gray-300 font-medium">You haven't left any reviews yet.</p>
                <p className="text-sm text-gray-400 mt-1">Reviews help other fans discover great creators!</p>
            </div>
        );
    }
    return (
        <div className="space-y-4">
            {reviews.map((r) => (
                <div key={r.id} className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-100 dark:border-dark-700 shadow-sm p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-3">
                        <Link to={`/creator/${r.creator.id}`} className="flex items-center gap-3 min-w-0 group">
                            <Avatar url={r.creator.profile_picture_url} name={r.creator.display_name} size="sm" />
                            <p className="font-medium text-gray-900 dark:text-white group-hover:underline truncate">{r.creator.display_name || 'Creator'}</p>
                        </Link>
                        <StarRating value={r.rating} size="sm" />
                    </div>
                    {r.review_text && <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{r.review_text}</p>}
                    <p className="mt-2 text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString('en-IN')}</p>
                </div>
            ))}
        </div>
    );
}

// ─── Settings tab ─────────────────────────────────────────────────────────────
function SettingsTab({ onToast, onError }: { onToast: (m: string) => void; onError: (m: string) => void }) {
    const [displayName, setDisplayName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let cancelled = false;
        getMyProfile().then((p) => {
            if (cancelled) return;
            setDisplayName(`${p.first_name || ''} ${p.last_name || ''}`.trim());
            setPhone(p.phone ?? '');
            setEmail(p.email ?? '');
        }).catch((err) => { if (!cancelled) onError(err instanceof Error ? err.message : 'Failed to load profile'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [onError]);

    const save = async () => {
        setSaving(true);
        try {
            const res = await updateFanSettings({ display_name: displayName.trim(), phone: phone.trim() });
            setDisplayName(res.display_name);
            setPhone(res.phone ?? '');
            onToast('Settings saved');
        } catch (err) {
            onError(err instanceof Error ? err.message : 'Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

    const inputCls = 'w-full rounded-xl bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 px-3 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500';
    const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5';

    return (
        <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-100 dark:border-dark-700 shadow-sm p-5 max-w-lg space-y-5">
            <div className="flex items-center gap-2"><User className="w-5 h-5 text-gray-400" /><h3 className="font-semibold text-gray-900 dark:text-white">Account Settings</h3></div>
            <div>
                <label className={labelCls}>Display name</label>
                <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputCls} placeholder="Your name" />
            </div>
            <div>
                <label className={labelCls}>Email <span className="text-gray-400 font-normal">(read-only)</span></label>
                <input value={email} readOnly disabled className={`${inputCls} opacity-60 cursor-not-allowed`} />
            </div>
            <div>
                <label className={labelCls}>Phone</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="Phone number" />
            </div>
            <button onClick={save} disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white transition">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}{saving ? 'Saving…' : 'Save Changes'}
            </button>
        </div>
    );
}
