import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, ChevronDown, Play, Loader2, Star as StarIcon } from 'lucide-react';
import {
    getMyOrders, getMyReviews, updateOrderStatus,
    type Order, type OrderStatus, type Review,
} from '@/services/api-extensions';
import { ORDER_TYPE_LABELS, STATUS_LABELS, STATUS_COLORS } from '@/constants/orderTypes';
import StarRating from '@/features/creator/components/StarRating';
import ReviewModal from '@/features/creator/components/ReviewModal';

const STATUS_FILTERS: { label: string; value: OrderStatus | 'all' }[] = [
    { label: 'All', value: 'all' },
    { label: 'Pending', value: 'pending' },
    { label: 'Accepted', value: 'accepted' },
    { label: 'In Progress', value: 'in_progress' },
    { label: 'Delivered', value: 'delivered' },
    { label: 'Completed', value: 'completed' },
    { label: 'Cancelled', value: 'cancelled' },
];

function formatDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function MyOrdersPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [reviews, setReviews] = useState<Review[]>([]);
    const [filter, setFilter] = useState<OrderStatus | 'all'>('all');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [reviewFor, setReviewFor] = useState<Order | null>(null);

    const load = useCallback(() => {
        setLoading(true);
        setError(null);
        let cancelled = false;

        Promise.all([
            getMyOrders({ status: filter === 'all' ? undefined : filter, limit: 50 }),
            getMyReviews().catch(() => [] as Review[]), // fetch once; non-critical
        ])
            .then(([ordersRes, reviewsRes]) => {
                if (cancelled) return;
                setOrders(ordersRes.data ?? []);
                setReviews(reviewsRes ?? []);
            })
            .catch((err: Error) => { if (!cancelled) setError(err.message); })
            .finally(() => { if (!cancelled) setLoading(false); });

        return () => { cancelled = true; };
    }, [filter]);

    useEffect(() => { load(); }, [load]);

    // Cross-reference: which orders already have a review (built once per load).
    const reviewByOrderId = new Map(reviews.map((r) => [r.order_id, r]));

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-dark-900 pt-24 pb-16 px-4 sm:px-6">
            <div className="max-w-3xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">My Orders</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Track and manage your video bookings.</p>
                </div>

                {/* Filter pills */}
                <div className="flex flex-wrap gap-2 mb-6">
                    {STATUS_FILTERS.map((f) => (
                        <button
                            key={f.value}
                            onClick={() => setFilter(f.value)}
                            className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
                                filter === f.value
                                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                                    : 'bg-gray-100 dark:bg-dark-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-dark-700'
                            }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 rounded-xl flex items-center justify-between gap-4">
                        <span className="text-sm">{error}</span>
                        <button onClick={load} className="text-sm underline hover:no-underline shrink-0">Retry</button>
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
                        <div className="w-14 h-14 mx-auto rounded-2xl bg-gray-100 dark:bg-dark-800 flex items-center justify-center mb-4">
                            <Package className="w-7 h-7 text-gray-400" />
                        </div>
                        <p className="text-gray-500 dark:text-gray-400 mb-4">You haven't booked any videos yet.</p>
                        <Link to="/creators" className="inline-block px-5 py-2.5 rounded-full bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition">
                            Browse creators
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {orders.map((order) => (
                            <OrderCard
                                key={order.id}
                                order={order}
                                expanded={expandedId === order.id}
                                onToggle={() => setExpandedId(expandedId === order.id ? null : order.id)}
                                existingReview={reviewByOrderId.get(order.id)}
                                onChanged={load}
                                onReview={() => setReviewFor(order)}
                            />
                        ))}
                    </div>
                )}
            </div>

            <AnimatePresence>
                {reviewFor && (
                    <ReviewModal
                        order={reviewFor}
                        onClose={() => setReviewFor(null)}
                        onSubmitted={() => { setReviewFor(null); load(); }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

function StatusBadge({ status }: { status: OrderStatus }) {
    return (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[status]}`}>
            {STATUS_LABELS[status]}
        </span>
    );
}

function OrderCard({ order, expanded, onToggle, existingReview, onChanged, onReview }: {
    order: Order;
    expanded: boolean;
    onToggle: () => void;
    existingReview?: Review;
    onChanged: () => void;
    onReview: () => void;
}) {
    const [busy, setBusy] = useState(false);
    const [showCancel, setShowCancel] = useState(false);
    const [cancelReason, setCancelReason] = useState('');

    const act = async (status: OrderStatus, reason?: string) => {
        setBusy(true);
        try {
            await updateOrderStatus(order.id, status, reason);
            onChanged();
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-100 dark:border-dark-700 shadow-sm overflow-hidden">
            <button onClick={onToggle} className="w-full text-left p-4 flex items-center gap-4">
                {order.star_image ? (
                    <img src={order.star_image} alt={order.star_name || 'Creator'} className="w-12 h-12 rounded-xl object-cover shrink-0" />
                ) : (
                    <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-dark-700 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 dark:text-white truncate">{order.star_name || 'Creator'}</span>
                        <StatusBadge status={order.status} />
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {ORDER_TYPE_LABELS[order.order_type] || order.order_type}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDate(order.created_at)}</p>
                </div>
                <span className="font-bold text-gray-900 dark:text-white shrink-0">₹{order.price.toLocaleString('en-IN')}</span>
                <ChevronDown className={`w-5 h-5 text-gray-400 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence initial={false}>
                {expanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="px-4 pb-4 pt-1 border-t border-gray-100 dark:border-dark-700 space-y-4">
                            {order.occasion && <Detail label="Occasion" value={order.occasion} />}
                            {order.company_name && <Detail label="Company" value={order.company_name} />}
                            {order.event_name && <Detail label="Event" value={order.event_name} />}
                            {order.instructions && <Detail label="Instructions" value={order.instructions} />}

                            {order.video_url && (
                                <a href={order.video_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline">
                                    <Play className="w-4 h-4" /> Watch your video
                                </a>
                            )}

                            {/* Status-driven actions */}
                            {order.status === 'delivered' && (
                                <button onClick={() => act('completed')} disabled={busy} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white transition">
                                    {busy && <Loader2 className="w-4 h-4 animate-spin" />} Mark as Completed
                                </button>
                            )}

                            {order.status === 'completed' && (
                                existingReview ? (
                                    <div className="rounded-xl bg-gray-50 dark:bg-dark-700 p-3">
                                        <p className="text-xs text-gray-400 mb-1.5">Your review</p>
                                        <StarRating value={existingReview.rating} size="sm" />
                                        {existingReview.review_text && <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">{existingReview.review_text}</p>}
                                    </div>
                                ) : (
                                    <button onClick={onReview} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white transition">
                                        <StarIcon className="w-4 h-4" /> Leave a Review
                                    </button>
                                )
                            )}

                            {(order.status === 'pending' || order.status === 'accepted') && (
                                showCancel ? (
                                    <div className="rounded-xl bg-gray-50 dark:bg-dark-700 p-3 space-y-2">
                                        <input
                                            value={cancelReason}
                                            onChange={(e) => setCancelReason(e.target.value)}
                                            placeholder="Reason (optional)"
                                            className="w-full rounded-lg bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-red-500"
                                        />
                                        <div className="flex gap-2">
                                            <button onClick={() => act('cancelled', cancelReason || undefined)} disabled={busy} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white transition">
                                                {busy && <Loader2 className="w-4 h-4 animate-spin" />} Confirm Cancel
                                            </button>
                                            <button onClick={() => setShowCancel(false)} className="px-3 py-1.5 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-800 transition">Keep Order</button>
                                        </div>
                                    </div>
                                ) : (
                                    <button onClick={() => setShowCancel(true)} className="px-4 py-2 rounded-xl text-sm font-medium border border-red-300 dark:border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition">
                                        Cancel Order
                                    </button>
                                )
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function Detail({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-xs font-medium text-gray-400 mb-0.5">{label}</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">{value}</p>
        </div>
    );
}
