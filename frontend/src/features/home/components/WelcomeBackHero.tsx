import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Video } from 'lucide-react';
import { useAuth } from '@/providers/AuthProvider';
import { getMyProfile } from '@/services/api';
import type { Profile } from '@/services/api';
import { getMyOrders, getStars } from '@/services/api-extensions';
import type { Order, Star as StarType } from '@/services/api-extensions';
import { STATUS_LABELS, STATUS_COLORS } from '@/constants/orderTypes';
import { capitalizeFirst } from '@/utils/text';

const TERMINAL_STATUSES = new Set(['completed', 'cancelled', 'rejected', 'refunded']);

export default function WelcomeBackHero() {
    const { user } = useAuth();

    const [profile, setProfile] = useState<Profile | null>(null);
    const [activeOrder, setActiveOrder] = useState<Order | null>(null);
    const [deliveredOrders, setDeliveredOrders] = useState<Order[]>([]);
    const [recommended, setRecommended] = useState<StarType[]>([]);

    useEffect(() => {
        if (!user) return;
        getMyProfile().then(setProfile).catch(() => null);
        getMyOrders({ limit: 20 }).then((res) => {
            const all = res.data ?? [];
            setActiveOrder(all.find((o) => !TERMINAL_STATUSES.has(o.status)) ?? null);
            setDeliveredOrders(all.filter((o) => o.status === 'delivered' || o.status === 'completed').slice(0, 3));
        }).catch(() => null);
        getStars({ sort: 'rating', order: 'desc', limit: 4 }).then((res) => {
            setRecommended(res.data ?? []);
        }).catch(() => null);
    }, [user]);

    const firstName = capitalizeFirst(profile?.first_name || user?.displayName?.split(' ')[0] || 'there');

    return (
        <section className="relative flex flex-col pt-40 pb-16 overflow-hidden">

            {/* ── Pill — absolutely placed top-right, lowered to sit near the ✨ / heading level ── */}
            {activeOrder && (
                <div className="absolute top-52 right-7 lg:right-12 z-20">
                    <Link
                        to="/my-orders"
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity border ${STATUS_COLORS[activeOrder.status]}`}
                    >
                        <span className="w-2 h-2 rounded-full bg-current opacity-80 shrink-0" />
                        <span className="font-bold">{activeOrder.star_name ?? 'Creator'} request:</span>
                        <span>{STATUS_LABELS[activeOrder.status]}</span>
                    </Link>
                </div>
            )}

            <div className="w-full max-w-6xl mx-auto px-6">

                {/* ── Greeting ── */}
                <div className="mb-8">
                    <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold text-gray-900 dark:text-white leading-tight whitespace-nowrap">
                        Welcome back, <span className="gradient-italic">{firstName}</span>
                    </h1>
                    <p className="mt-3 text-base text-gray-700 dark:text-dark-300">
                        Manage your bookings and explore your curated star matrix.
                    </p>
                </div>

                {/* ── Row 2: Cards ── */}
                {/* Left card ~2/3 width, right card ~1/3 — both same height */}
                <div className="flex gap-5 items-stretch">

                    {/* ── Curated Matrix For You (large left card) ── */}
                    <div className="glass-card rounded-3xl p-8 flex flex-col" style={{ flex: '2 1 0' }}>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg">✦</span>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                                Curated Matrix For You
                            </h2>
                        </div>
                        <p className="text-sm glass-card-muted mb-6">
                            Based on top-rated creators on the platform:
                        </p>

                        {recommended.length === 0 ? (
                            <div className="flex gap-3 flex-wrap">
                                {[1, 2, 3, 4].map((i) => (
                                    <div key={i} className="h-9 w-28 rounded-full bg-white/40 dark:bg-white/10 animate-pulse" />
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-3">
                                {recommended.map((s) => (
                                    <Link
                                        key={s.id}
                                        to={`/creator/${s.id}`}
                                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold
                                            bg-white/50 dark:bg-white/10
                                            border border-white/60 dark:border-white/20
                                            text-gray-800 dark:text-gray-100
                                            hover:bg-white/70 dark:hover:bg-white/20
                                            transition-colors"
                                    >
                                        <span className="text-purple-500 dark:text-purple-400 font-bold">+</span>
                                        {s.name}
                                    </Link>
                                ))}
                            </div>
                        )}

                        <div className="flex-1" />
                        <Link
                            to="/creators"
                            className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
                        >
                            Browse all <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                    </div>

                    {/* ── Delivered Clips (smaller right card) ── */}
                    <div className="glass-card rounded-3xl p-8 flex flex-col" style={{ flex: '1 1 0' }}>
                        <div className="flex items-center gap-2 mb-5">
                            <span className="text-lg">⚡</span>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                                Delivered Clips
                            </h2>
                        </div>

                        <div className="flex-1">
                            {deliveredOrders.length === 0 ? (
                                <div className="flex flex-col items-start gap-3">
                                    <div className="w-12 h-12 rounded-xl bg-gray-800 dark:bg-gray-700 flex items-center justify-center">
                                        <Video className="w-5 h-5 text-white" />
                                    </div>
                                    <p className="text-sm glass-card-muted">No clips delivered yet.</p>
                                    <p className="text-xs glass-card-muted opacity-70">Book a creator to get your first clip!</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {deliveredOrders.map((o) => (
                                        <Link
                                            key={o.id}
                                            to="/my-orders"
                                            className="flex items-center gap-3 group"
                                        >
                                            <div className="w-12 h-12 rounded-xl bg-gray-800 dark:bg-gray-700 flex items-center justify-center shrink-0 overflow-hidden">
                                                {o.star_image ? (
                                                    <img src={o.star_image} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <Video className="w-5 h-5 text-white" />
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                                                    {o.star_name ?? 'Creator'} Clip
                                                </p>
                                                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                                                    <span>✓</span> Ready to share
                                                </p>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>

                        <Link
                            to="/my-orders"
                            className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
                        >
                            View all <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                    </div>

                </div>
            </div>
        </section>
    );
}
