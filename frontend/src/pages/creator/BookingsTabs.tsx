import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, Inbox, ExternalLink, Upload, LinkIcon, X, Send, AlertCircle, Check, Pencil, ImagePlus, Trash2, Camera, Film } from 'lucide-react';
import {
    getDashboardBookings, updateBookingStatus, updateBookingNote, deliverVideoByLink,
    getCreatorSettings, updateCreatorSettings, toggleTierActive,
    uploadAvatar, uploadCover, uploadGalleryItem, deleteGalleryItem,
    type Booking, type BookingStatus, type CreatorSettings, type SettingsPricingTier,
    type GalleryItem,
} from '@/services/api';

const CATEGORY_OPTIONS = ['Actor', 'Musician', 'Comedian', 'Athlete', 'Influencer', 'YouTuber', 'Podcaster', 'Other'];
const LANGUAGE_OPTIONS = ['English', 'Hindi', 'Tamil', 'Telugu', 'Kannada', 'Bengali', 'Marathi', 'Other'];
const TURNAROUND_OPTIONS = [1, 3, 7, 14, 30];

// ─── Shared helpers ──────────────────────────────────────────────────────────
const PAGE_SIZE = 10;

const STATUS_BADGE: Record<BookingStatus, string> = {
    pending: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400',
    accepted: 'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400',
    in_progress: 'bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400',
    delivered: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
    cancelled: 'bg-gray-200 dark:bg-dark-700 text-gray-500 dark:text-gray-400',
};

const STATUS_LABEL: Record<BookingStatus, string> = {
    pending: 'Pending', accepted: 'Accepted', in_progress: 'In Progress',
    delivered: 'Delivered', cancelled: 'Cancelled',
};

const FILTERS: { label: string; value: BookingStatus | 'all' }[] = [
    { label: 'All', value: 'all' },
    { label: 'Pending', value: 'pending' },
    { label: 'Accepted', value: 'accepted' },
    { label: 'In Progress', value: 'in_progress' },
    { label: 'Delivered', value: 'delivered' },
    { label: 'Cancelled', value: 'cancelled' },
];

// Next-status actions per current status.
const ACTIONS: Record<BookingStatus, { label: string; to: BookingStatus; variant: 'primary' | 'ghost' }[]> = {
    pending: [
        { label: 'Accept', to: 'accepted', variant: 'primary' },
        { label: 'Cancel', to: 'cancelled', variant: 'ghost' },
    ],
    accepted: [
        { label: 'Mark In Progress', to: 'in_progress', variant: 'primary' },
        { label: 'Cancel', to: 'cancelled', variant: 'ghost' },
    ],
    // in_progress has no plain status action — delivery happens via the
    // "Deliver Video" modal, which sets status to 'delivered' on success.
    in_progress: [],
    delivered: [],
    cancelled: [],
};

function relativeTime(iso: string): string {
    const then = new Date(iso).getTime();
    const diff = Date.now() - then;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
    return `${Math.floor(months / 12)} year(s) ago`;
}

const formatINR = (n: number | null | undefined) =>
    (Number.isFinite(Number(n)) ? Number(n) : 0).toLocaleString('en-IN');

// ─── Bookings Tab ────────────────────────────────────────────────────────────
export function BookingsTab({ profileId, onError }: { profileId: string | null; onError: (m: string) => void }) {
    const [filter, setFilter] = useState<BookingStatus | 'all'>('all');
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    const fetchPage = useCallback(async (targetPage: number, replace: boolean) => {
        if (replace) setLoading(true); else setLoadingMore(true);
        try {
            const res = await getDashboardBookings({
                status: filter === 'all' ? undefined : filter,
                page: targetPage,
                limit: PAGE_SIZE,
            });
            setBookings((prev) => (replace ? res.bookings : [...prev, ...res.bookings]));
            setPage(res.page);
            setTotalPages(res.total_pages);
        } catch (err) {
            onError(err instanceof Error ? err.message : 'Failed to load bookings');
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [filter, onError]);

    // Reload from page 1 when the filter changes.
    useEffect(() => { fetchPage(1, true); }, [fetchPage]);

    // Optimistic status update with rollback on failure.
    const handleStatus = async (booking: Booking, to: BookingStatus) => {
        const prev = booking.status;
        setBookings((list) => list.map((b) => (b.id === booking.id ? { ...b, status: to, _pending: true } as Booking & { _pending?: boolean } : b)));
        try {
            const updated = await updateBookingStatus(booking.id, to);
            setBookings((list) => list.map((b) => (b.id === booking.id ? updated : b)));
        } catch (err) {
            setBookings((list) => list.map((b) => (b.id === booking.id ? { ...b, status: prev } : b)));
            onError(err instanceof Error ? err.message : 'Failed to update booking');
        }
    };

    const saveNote = async (bookingId: string, note: string) => {
        try {
            await updateBookingNote(bookingId, note);
        } catch (err) {
            onError(err instanceof Error ? err.message : 'Failed to save note');
        }
    };

    // Replace the card with its delivered version (optimistic close from modal).
    const handleDelivered = (updated: Booking) => {
        setBookings((list) => list.map((b) => (b.id === updated.id ? updated : b)));
    };

    if (loading) {
        return <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
    }

    return (
        <div>
            {/* Status filter — scrollable on mobile */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-1 -mx-1 px-1">
                {FILTERS.map((f) => (
                    <button
                        key={f.value}
                        onClick={() => setFilter(f.value)}
                        className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
                            filter === f.value
                                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                                : 'bg-gray-100 dark:bg-dark-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-dark-700'
                        }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {bookings.length === 0 ? (
                <EmptyState profileId={profileId} />
            ) : (
                <div className="space-y-4">
                    {bookings.map((b) => (
                        <BookingCardRow key={b.id} booking={b} onStatus={handleStatus} onSaveNote={saveNote} onDelivered={handleDelivered} />
                    ))}

                    {page < totalPages && (
                        <div className="pt-2 flex justify-center">
                            <button
                                onClick={() => fetchPage(page + 1, false)}
                                disabled={loadingMore}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-gray-100 dark:bg-dark-800 hover:bg-gray-200 dark:hover:bg-dark-700 text-gray-700 dark:text-gray-200 transition disabled:opacity-50"
                            >
                                {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                                {loadingMore ? 'Loading…' : 'Load more'}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Single booking card ─────────────────────────────────────────────────────
function BookingCardRow({
    booking, onStatus, onSaveNote, onDelivered,
}: {
    booking: Booking;
    onStatus: (b: Booking, to: BookingStatus) => Promise<void>;
    onSaveNote: (id: string, note: string) => Promise<void>;
    onDelivered: (updated: Booking) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const [note, setNote] = useState(booking.creator_note ?? '');
    const [pendingTo, setPendingTo] = useState<BookingStatus | null>(null);
    const [showDeliver, setShowDeliver] = useState(false);
    const savedNoteRef = useRef(booking.creator_note ?? '');

    const actions = ACTIONS[booking.status] ?? [];

    const runAction = async (to: BookingStatus) => {
        setPendingTo(to);
        await onStatus(booking, to);
        setPendingTo(null);
    };

    const handleNoteBlur = () => {
        if (note !== savedNoteRef.current) {
            savedNoteRef.current = note;
            onSaveNote(booking.id, note);
        }
    };

    return (
        <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-100 dark:border-dark-700 shadow-sm p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white">{booking.fan_name || 'Anonymous fan'}</p>
                    {booking.fan_message && (
                        <p className={`mt-1 text-sm text-gray-600 dark:text-gray-300 ${expanded ? '' : 'line-clamp-2'}`}>
                            {booking.fan_message}
                        </p>
                    )}
                    {booking.fan_message && booking.fan_message.length > 80 && (
                        <button
                            onClick={() => setExpanded((e) => !e)}
                            className="mt-0.5 text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
                        >
                            {expanded ? 'Show less' : 'Show more'}
                        </button>
                    )}
                </div>
                <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[booking.status]}`}>
                    {STATUS_LABEL[booking.status]}
                </span>
            </div>

            <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-3">
                {booking.tier_name && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-200">
                        {booking.tier_name}
                        {booking.tier_price != null && <span className="font-bold">· ₹{formatINR(booking.tier_price)}</span>}
                    </span>
                )}
                <span className="text-xs text-gray-400">{relativeTime(booking.created_at)}</span>
                {booking.video_url && (
                    <a
                        href={booking.video_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
                    >
                        <ExternalLink className="w-3 h-3" /> Video
                    </a>
                )}
            </div>

            {(actions.length > 0 || booking.status === 'in_progress') && (
                <div className="flex flex-wrap gap-2 mt-4">
                    {actions.map((a) => (
                        <button
                            key={a.to}
                            onClick={() => runAction(a.to)}
                            disabled={pendingTo !== null}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition disabled:opacity-50 ${
                                a.variant === 'primary'
                                    ? 'bg-primary-600 hover:bg-primary-700 text-white'
                                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700'
                            }`}
                        >
                            {pendingTo === a.to && <Loader2 className="w-4 h-4 animate-spin" />}
                            {a.label}
                        </button>
                    ))}
                    {booking.status === 'in_progress' && (
                        <button
                            onClick={() => setShowDeliver(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white transition"
                        >
                            <Send className="w-4 h-4" /> Deliver Video
                        </button>
                    )}
                </div>
            )}

            {/* Private creator note — auto-saves on blur */}
            <textarea
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 500))}
                onBlur={handleNoteBlur}
                rows={2}
                placeholder="Add a private note…"
                className="mt-4 w-full rounded-xl bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />

            {showDeliver && (
                <DeliverModal
                    booking={booking}
                    onClose={() => setShowDeliver(false)}
                    onDelivered={(updated) => { onDelivered(updated); setShowDeliver(false); }}
                />
            )}
        </div>
    );
}

// ─── Deliver Video modal ─────────────────────────────────────────────────────
// Full-screen bottom sheet on mobile; centered dialog on desktop. Two tabs:
// "Upload File" (disabled — object storage not enabled yet) and "Paste Link".
function DeliverModal({
    booking, onClose, onDelivered,
}: {
    booking: Booking;
    onClose: () => void;
    onDelivered: (updated: Booking) => void;
}) {
    const [activeTab, setActiveTab] = useState<'upload' | 'link'>('link');
    const [url, setUrl] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isValidUrl = (v: string) => {
        try { const u = new URL(v); return u.protocol === 'http:' || u.protocol === 'https:'; }
        catch { return false; }
    };

    const submitLink = async () => {
        if (!isValidUrl(url.trim())) { setError('Enter a valid URL (https://…).'); return; }
        setSubmitting(true);
        setError(null);
        try {
            const updated = await deliverVideoByLink(booking.id, url.trim());
            onDelivered(updated);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to deliver video');
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[140] flex items-end sm:items-center justify-center">
            {/* Backdrop — clicking it does NOT close while submitting */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={() => { if (!submitting) onClose(); }}
            />
            <div className="relative w-full sm:max-w-lg bg-white dark:bg-dark-800 sm:rounded-2xl rounded-t-2xl border border-gray-100 dark:border-dark-700 shadow-xl p-5 sm:p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                        Deliver Video for {booking.fan_name || 'this fan'}
                    </h3>
                    <button
                        onClick={() => { if (!submitting) onClose(); }}
                        disabled={submitting}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-40"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="inline-flex items-center gap-1 bg-gray-100 dark:bg-dark-700 rounded-xl p-1 mb-5">
                    <button
                        onClick={() => setActiveTab('upload')}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition ${
                            activeTab === 'upload' ? 'bg-white dark:bg-dark-600 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'
                        }`}
                    >
                        <Upload className="w-4 h-4" /> Upload File
                    </button>
                    <button
                        onClick={() => setActiveTab('link')}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition ${
                            activeTab === 'link' ? 'bg-white dark:bg-dark-600 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'
                        }`}
                    >
                        <LinkIcon className="w-4 h-4" /> Paste Link
                    </button>
                </div>

                {activeTab === 'upload' ? (
                    <div className="rounded-xl border border-dashed border-gray-300 dark:border-dark-600 p-6 text-center">
                        <div className="w-12 h-12 mx-auto rounded-xl bg-gray-100 dark:bg-dark-700 flex items-center justify-center mb-3">
                            <AlertCircle className="w-6 h-6 text-gray-400" />
                        </div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">File upload isn't enabled yet</p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Object storage isn't configured. For now, upload your video to Google Drive,
                            WeTransfer, YouTube, etc., and deliver it via the <b>Paste Link</b> tab.
                        </p>
                        <button
                            onClick={() => setActiveTab('link')}
                            className="mt-4 px-4 py-2 rounded-xl text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white transition"
                        >
                            Switch to Paste Link
                        </button>
                    </div>
                ) : (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                            Video URL <span className="text-gray-400 font-normal">(Google Drive, YouTube, WeTransfer, etc.)</span>
                        </label>
                        <input
                            type="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://…"
                            className="w-full rounded-xl bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 px-3 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
                        />
                        <button
                            onClick={submitLink}
                            disabled={submitting}
                            className="mt-4 w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white transition"
                        >
                            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                            {submitting ? 'Delivering…' : 'Deliver via Link'}
                        </button>
                    </div>
                )}

                {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
            </div>
        </div>
    );
}

// ─── Empty state ─────────────────────────────────────────────────────────────
function EmptyState({ profileId }: { profileId: string | null }) {
    return (
        <div className="py-16 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-dark-800 flex items-center justify-center mb-4">
                <Inbox className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-600 dark:text-gray-300 font-medium">No bookings yet.</p>
            <p className="text-sm text-gray-400 mt-1">Share your profile to get started.</p>
            {profileId && (
                <a
                    href={`/creator/${profileId}`}
                    className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white transition"
                >
                    View My Profile
                </a>
            )}
        </div>
    );
}

// ─── Earnings Tab ────────────────────────────────────────────────────────────
export function EarningsTab({
    thisMonthEarnings, thisMonthBookings, onError,
}: {
    thisMonthEarnings: number;
    thisMonthBookings: number;
    onError: (m: string) => void;
}) {
    const [rows, setRows] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                // Pull delivered bookings (a generous page is fine for a plain table).
                const res = await getDashboardBookings({ status: 'delivered', page: 1, limit: 50 });
                if (!cancelled) setRows(res.bookings);
            } catch (err) {
                if (!cancelled) onError(err instanceof Error ? err.message : 'Failed to load earnings');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [onError]);

    return (
        <div>
            <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-100 dark:border-dark-700 shadow-sm p-5 mb-6">
                <p className="text-sm text-gray-500 dark:text-gray-400">This month</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                    ₹{formatINR(thisMonthEarnings)}
                    <span className="text-sm font-normal text-gray-500 dark:text-gray-400"> from {thisMonthBookings} booking{thisMonthBookings === 1 ? '' : 's'}</span>
                </p>
            </div>

            {loading ? (
                <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
            ) : rows.length === 0 ? (
                <p className="text-sm text-gray-400 py-8 text-center">No delivered bookings yet.</p>
            ) : (
                <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-100 dark:border-dark-700 shadow-sm overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-dark-700">
                                <th className="px-4 py-3 font-medium">Fan</th>
                                <th className="px-4 py-3 font-medium">Tier</th>
                                <th className="px-4 py-3 font-medium text-right">Amount</th>
                                <th className="px-4 py-3 font-medium text-right">Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr key={r.id} className="border-b border-gray-50 dark:border-dark-700/50 last:border-0">
                                    <td className="px-4 py-3 text-gray-900 dark:text-white">{r.fan_name || '—'}</td>
                                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{r.tier_name || '—'}</td>
                                    <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">₹{formatINR(r.tier_price)}</td>
                                    <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">{new Date(r.updated_at).toLocaleDateString('en-IN')}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// ─── Profile completion banner ───────────────────────────────────────────────
const DISMISS_KEY = 'clipixx_profile_banner_dismissed';

export function ProfileCompletionBanner({ completion }: { completion: number }) {
    const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISS_KEY) === '1');

    if (completion >= 100 || dismissed) return null;

    const dismiss = () => {
        // Dismiss for this session only — reappears on next login.
        sessionStorage.setItem(DISMISS_KEY, '1');
        setDismissed(true);
    };

    return (
        <div className="relative bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-500/10 dark:to-blue-500/10 border border-purple-100 dark:border-purple-500/20 rounded-2xl p-4 sm:p-5 mb-6">
            <button onClick={dismiss} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm" aria-label="Dismiss">✕</button>
            <p className="font-semibold text-gray-900 dark:text-white">Your profile is {completion}% complete</p>
            <div className="mt-2 h-2 w-full max-w-md bg-white/60 dark:bg-dark-700 rounded-full overflow-hidden">
                <div className="h-full bg-purple-600 rounded-full transition-all" style={{ width: `${completion}%` }} />
            </div>
            <a
                href="/creator/onboarding"
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white transition"
            >
                Complete Profile
            </a>
        </div>
    );
}

// ─── Settings Tab ────────────────────────────────────────────────────────────
const settingsInputCls = 'w-full rounded-xl bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 px-3 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500';
const settingsLabelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5';

/** Small toggle switch matching the onboarding availability switch. */
function ToggleSwitch({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={on}
            disabled={disabled}
            onClick={onClick}
            className={`relative w-12 h-6 rounded-full transition-colors disabled:opacity-50 ${on ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-dark-600'}`}
        >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${on ? 'translate-x-6' : ''}`} />
        </button>
    );
}

/** Brief "Saved ✓" pill that fades after a moment. */
function SavedTick({ show }: { show: boolean }) {
    if (!show) return null;
    return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <Check className="w-3.5 h-3.5" /> Saved
        </span>
    );
}

export function SettingsTab({ onError, onToast }: { onError: (m: string) => void; onToast: (m: string) => void }) {
    const [settings, setSettings] = useState<CreatorSettings | null>(null);
    const [loading, setLoading] = useState(true);

    // Per-control "Saved ✓" flags.
    const [savedFlag, setSavedFlag] = useState<Record<string, boolean>>({});
    const [savingAvail, setSavingAvail] = useState(false);

    // Profile section (button-saved).
    const [bio, setBio] = useState('');
    const [category, setCategory] = useState('');
    const [languages, setLanguages] = useState<string[]>([]);
    const [savingProfile, setSavingProfile] = useState(false);

    const [tierBusy, setTierBusy] = useState<string | null>(null);

    // Media upload progress (0–100) keyed by 'avatar' | 'cover'; gallery handled below.
    const [imgProgress, setImgProgress] = useState<Record<string, number | null>>({});
    const [galleryUploads, setGalleryUploads] = useState<Record<string, number>>({}); // tempId -> pct
    const [galleryBusy, setGalleryBusy] = useState<string | null>(null); // item id being deleted
    const avatarInputRef = useRef<HTMLInputElement>(null);
    const coverInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const s = await getCreatorSettings();
                if (cancelled) return;
                setSettings(s);
                setBio(s.bio ?? '');
                setCategory(s.category ?? '');
                setLanguages(s.languages ?? []);
            } catch (err) {
                if (!cancelled) onError(err instanceof Error ? err.message : 'Failed to load settings');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [onError]);

    // ── Image uploads (avatar / cover) ──
    const handleImageUpload = async (kind: 'avatar' | 'cover', file: File | undefined) => {
        if (!file || !settings) return;
        setImgProgress((p) => ({ ...p, [kind]: 0 }));
        try {
            const fn = kind === 'avatar' ? uploadAvatar : uploadCover;
            const { url } = await fn(file, (pct) => setImgProgress((p) => ({ ...p, [kind]: pct })));
            setSettings({
                ...settings,
                ...(kind === 'avatar' ? { profile_picture_url: url } : { cover_image_url: url }),
            });
            flashSaved(kind);
        } catch (err) {
            onError(err instanceof Error ? err.message : 'Upload failed');
        } finally {
            setImgProgress((p) => ({ ...p, [kind]: null }));
        }
    };

    // ── Gallery uploads (multi-select, up to 5 at once) ──
    const handleGalleryUpload = async (files: FileList | null) => {
        if (!files || !settings) return;
        const current = settings.gallery.length;
        const incoming = Array.from(files).slice(0, 5);
        if (current + incoming.length > 20) {
            onError(`Gallery limit is 20 items (you have ${current}).`);
            return;
        }
        for (const file of incoming) {
            const tempId = `${Date.now()}-${file.name}`;
            setGalleryUploads((u) => ({ ...u, [tempId]: 0 }));
            try {
                const item = await uploadGalleryItem(file, (pct) => setGalleryUploads((u) => ({ ...u, [tempId]: pct })));
                setSettings((s) => s && ({ ...s, gallery: [...s.gallery, item] }));
            } catch (err) {
                onError(err instanceof Error ? err.message : `Failed to upload ${file.name}`);
            } finally {
                setGalleryUploads((u) => { const n = { ...u }; delete n[tempId]; return n; });
            }
        }
    };

    const handleGalleryDelete = async (item: GalleryItem) => {
        if (!settings) return;
        setGalleryBusy(item.id);
        try {
            await deleteGalleryItem(item.id);
            setSettings((s) => s && ({ ...s, gallery: s.gallery.filter((g) => g.id !== item.id) }));
        } catch (err) {
            onError(err instanceof Error ? err.message : 'Failed to delete item');
        } finally {
            setGalleryBusy(null);
        }
    };

    const flashSaved = (key: string) => {
        setSavedFlag((f) => ({ ...f, [key]: true }));
        setTimeout(() => setSavedFlag((f) => ({ ...f, [key]: false })), 2000);
    };

    // ── Availability auto-saves ──
    const toggleAccepting = async () => {
        if (!settings) return;
        const next = !settings.accepting_bookings;
        setSettings({ ...settings, accepting_bookings: next });
        setSavingAvail(true);
        try {
            await updateCreatorSettings({ accepting_bookings: next });
            flashSaved('accepting');
        } catch (err) {
            setSettings({ ...settings, accepting_bookings: !next }); // rollback
            onError(err instanceof Error ? err.message : 'Failed to save');
        } finally {
            setSavingAvail(false);
        }
    };

    const changeTurnaround = async (days: number) => {
        if (!settings) return;
        const prev = settings.turnaround_days;
        setSettings({ ...settings, turnaround_days: days });
        try {
            await updateCreatorSettings({ turnaround_days: days });
            flashSaved('turnaround');
        } catch (err) {
            setSettings({ ...settings, turnaround_days: prev });
            onError(err instanceof Error ? err.message : 'Failed to save');
        }
    };

    // ── Profile (button save) ──
    const saveProfile = async () => {
        if (!category) { onError('Please choose a category'); return; }
        if (bio.length > 500) { onError('Bio must be 500 characters or fewer'); return; }
        setSavingProfile(true);
        try {
            const updated = await updateCreatorSettings({ bio, category, languages });
            setSettings(updated);
            onToast('Profile saved');
        } catch (err) {
            onError(err instanceof Error ? err.message : 'Failed to save profile');
        } finally {
            setSavingProfile(false);
        }
    };

    const toggleLanguage = (lang: string) =>
        setLanguages((l) => (l.includes(lang) ? l.filter((x) => x !== lang) : [...l, lang]));

    // ── Tier toggle ──
    const toggleTier = async (tier: SettingsPricingTier) => {
        if (!settings) return;
        setTierBusy(tier.id);
        const prevActive = tier.is_active;
        setSettings({
            ...settings,
            pricing_tiers: settings.pricing_tiers.map((t) => (t.id === tier.id ? { ...t, is_active: !prevActive } : t)),
        });
        try {
            const res = await toggleTierActive(tier.id);
            setSettings((s) => s && ({
                ...s,
                pricing_tiers: s.pricing_tiers.map((t) => (t.id === res.id ? { ...t, is_active: res.is_active } : t)),
            }));
            flashSaved(`tier-${tier.id}`);
        } catch (err) {
            setSettings((s) => s && ({
                ...s,
                pricing_tiers: s.pricing_tiers.map((t) => (t.id === tier.id ? { ...t, is_active: prevActive } : t)),
            }));
            onError(err instanceof Error ? err.message : 'Failed to toggle tier');
        } finally {
            setTierBusy(null);
        }
    };

    if (loading || !settings) {
        return <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
    }

    return (
        <div className="space-y-8">
            {/* ── Section 0: Profile Images ── */}
            <section>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Profile Images</h3>
                <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-100 dark:border-dark-700 shadow-sm p-5 space-y-6">
                    {/* Cover */}
                    <div>
                        <p className={`${settingsLabelCls} flex items-center gap-2`}>Cover image <SavedTick show={!!savedFlag.cover} /></p>
                        <div
                            className="relative w-full rounded-xl overflow-hidden bg-gray-100 dark:bg-dark-700"
                            style={{ aspectRatio: '16 / 5' }}
                        >
                            {settings.cover_image_url
                                ? <img src={settings.cover_image_url} alt="Cover" className="w-full h-full object-cover" />
                                : <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">No cover yet</div>}
                            {imgProgress.cover != null && (
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-sm">
                                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> {imgProgress.cover}%
                                </div>
                            )}
                        </div>
                        <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                            onChange={(e) => { handleImageUpload('cover', e.target.files?.[0]); e.target.value = ''; }} />
                        <button
                            onClick={() => coverInputRef.current?.click()}
                            disabled={imgProgress.cover != null}
                            className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 dark:border-dark-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-dark-700 disabled:opacity-50 transition"
                        >
                            <ImagePlus className="w-4 h-4" /> Change Cover
                        </button>
                    </div>

                    {/* Avatar */}
                    <div className="border-t border-gray-100 dark:border-dark-700 pt-5">
                        <p className={`${settingsLabelCls} flex items-center gap-2`}>Profile picture <SavedTick show={!!savedFlag.avatar} /></p>
                        <div className="flex items-center gap-4">
                            <div className="relative w-20 h-20 rounded-full overflow-hidden bg-gray-100 dark:bg-dark-700 flex items-center justify-center shrink-0">
                                {settings.profile_picture_url
                                    ? <img src={settings.profile_picture_url} alt="Avatar" className="w-full h-full object-cover" />
                                    : <span className="text-xl font-bold text-gray-400">{(category || 'C').slice(0, 1).toUpperCase()}</span>}
                                {imgProgress.avatar != null && (
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-xs">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    </div>
                                )}
                            </div>
                            <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                                onChange={(e) => { handleImageUpload('avatar', e.target.files?.[0]); e.target.value = ''; }} />
                            <button
                                onClick={() => avatarInputRef.current?.click()}
                                disabled={imgProgress.avatar != null}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 dark:border-dark-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-dark-700 disabled:opacity-50 transition"
                            >
                                <Camera className="w-4 h-4" /> Change Photo
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Gallery ── */}
            <section>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Gallery</h3>
                    <span className="text-xs text-gray-400">{settings.gallery.length} / 20 items</span>
                </div>
                <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-100 dark:border-dark-700 shadow-sm p-5">
                    {(settings.gallery.length > 0 || Object.keys(galleryUploads).length > 0) && (
                        <div className="grid grid-cols-3 gap-3 mb-4">
                            {settings.gallery.map((item) => (
                                <div key={item.id} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-dark-700 group">
                                    {item.media_type === 'video'
                                        ? <video src={item.media_url} className="w-full h-full object-cover" />
                                        : <img src={item.media_url} alt={item.caption || ''} className="w-full h-full object-cover" />}
                                    {item.media_type === 'video' && (
                                        <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px] flex items-center gap-1"><Film className="w-3 h-3" /> Video</span>
                                    )}
                                    <button
                                        onClick={() => handleGalleryDelete(item)}
                                        disabled={galleryBusy === item.id}
                                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-600 transition disabled:opacity-50"
                                        aria-label="Delete item"
                                    >
                                        {galleryBusy === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                    </button>
                                </div>
                            ))}
                            {/* In-flight uploads */}
                            {Object.entries(galleryUploads).map(([id, pct]) => (
                                <div key={id} className="relative aspect-square rounded-xl bg-gray-100 dark:bg-dark-700 flex items-center justify-center text-gray-500 text-xs">
                                    <Loader2 className="w-4 h-4 animate-spin mr-1" /> {pct}%
                                </div>
                            ))}
                        </div>
                    )}
                    <input ref={galleryInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime" className="hidden"
                        onChange={(e) => { handleGalleryUpload(e.target.files); e.target.value = ''; }} />
                    <button
                        onClick={() => galleryInputRef.current?.click()}
                        disabled={settings.gallery.length >= 20}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-dashed border-gray-300 dark:border-dark-600 text-gray-600 dark:text-gray-300 hover:border-primary-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                        <ImagePlus className="w-4 h-4" /> Add Photo/Video {settings.gallery.length >= 20 && '(full)'}
                    </button>
                    <p className="mt-2 text-xs text-gray-400">Up to 5 at once · images ≤10MB, videos ≤100MB</p>
                </div>
            </section>

            {/* ── Section 1: Availability ── */}
            <section>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Availability</h3>
                <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-100 dark:border-dark-700 shadow-sm p-5 space-y-5">
                    <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                                Accepting Bookings <SavedTick show={!!savedFlag.accepting} />
                            </p>
                            <p className={`text-xs mt-0.5 ${settings.accepting_bookings ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'}`}>
                                {settings.accepting_bookings
                                    ? "You're accepting bookings"
                                    : "You're not accepting bookings — fans can't book you"}
                            </p>
                        </div>
                        <ToggleSwitch on={settings.accepting_bookings} onClick={toggleAccepting} disabled={savingAvail} />
                    </div>

                    <div className="border-t border-gray-100 dark:border-dark-700 pt-5">
                        <label className={`${settingsLabelCls} flex items-center gap-2`}>
                            Turnaround time <SavedTick show={!!savedFlag.turnaround} />
                        </label>
                        <select
                            value={settings.turnaround_days}
                            onChange={(e) => changeTurnaround(Number(e.target.value))}
                            className={`${settingsInputCls} max-w-xs`}
                        >
                            {TURNAROUND_OPTIONS.map((d) => (
                                <option key={d} value={d}>{d} {d === 1 ? 'day' : 'days'}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </section>

            {/* ── Section 2: Profile ── */}
            <section>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Profile</h3>
                <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-100 dark:border-dark-700 shadow-sm p-5 space-y-5">
                    <div>
                        <label className={settingsLabelCls}>Bio</label>
                        <textarea
                            value={bio}
                            onChange={(e) => setBio(e.target.value.slice(0, 500))}
                            rows={4}
                            placeholder="A short intro for your fans…"
                            className={settingsInputCls}
                        />
                        <p className={`mt-1 text-xs text-right ${bio.length > 500 ? 'text-red-500' : 'text-gray-400'}`}>{bio.length}/500</p>
                    </div>
                    <div>
                        <label className={settingsLabelCls}>Category</label>
                        <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${settingsInputCls} max-w-xs`}>
                            <option value="">Select a category…</option>
                            {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={settingsLabelCls}>Languages</label>
                        <div className="flex flex-wrap gap-2">
                            {LANGUAGE_OPTIONS.map((lang) => {
                                const on = languages.includes(lang);
                                return (
                                    <button
                                        key={lang}
                                        type="button"
                                        onClick={() => toggleLanguage(lang)}
                                        className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                                            on
                                                ? 'bg-primary-600 border-primary-600 text-white'
                                                : 'bg-white dark:bg-dark-700 border-gray-300 dark:border-dark-600 text-gray-600 dark:text-gray-300 hover:border-primary-400'
                                        }`}
                                    >
                                        {lang}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <button
                        onClick={saveProfile}
                        disabled={savingProfile}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white transition"
                    >
                        {savingProfile && <Loader2 className="w-4 h-4 animate-spin" />}
                        {savingProfile ? 'Saving…' : 'Save Profile'}
                    </button>
                </div>
            </section>

            {/* ── Section 3: Pricing Tiers ── */}
            <section>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Pricing Tiers</h3>
                {settings.pricing_tiers.length === 0 ? (
                    <p className="text-sm text-gray-400 mb-4">No pricing tiers yet.</p>
                ) : (
                    <div className="space-y-4">
                        {settings.pricing_tiers.map((tier) => (
                            <div
                                key={tier.id}
                                className={`rounded-2xl border p-4 transition ${
                                    tier.is_active
                                        ? 'bg-white dark:bg-dark-800 border-gray-100 dark:border-dark-700'
                                        : 'bg-gray-50 dark:bg-dark-800/40 border-gray-100 dark:border-dark-700 opacity-60'
                                }`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="font-bold text-gray-900 dark:text-white">{tier.tier_name}</p>
                                        {tier.description && <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{tier.description}</p>}
                                        <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-300">
                                            <span className="font-bold">₹{formatINR(tier.price)}</span>
                                            <span className="text-gray-400"> · delivered in {tier.delivery_days} {tier.delivery_days === 1 ? 'day' : 'days'}</span>
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                                        <ToggleSwitch on={tier.is_active} onClick={() => toggleTier(tier)} disabled={tierBusy === tier.id} />
                                        <SavedTick show={!!savedFlag[`tier-${tier.id}`]} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                <a
                    href="/creator/onboarding"
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 dark:border-dark-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-dark-700 transition"
                >
                    <Pencil className="w-4 h-4" /> Edit Pricing
                </a>
            </section>
        </div>
    );
}
