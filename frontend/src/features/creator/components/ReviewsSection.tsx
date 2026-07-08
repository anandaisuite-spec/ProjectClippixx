import { useState, useEffect, useCallback } from 'react';
import { Star, Loader2 } from 'lucide-react';
import { getStarReviews, type Review, type RatingBreakdown } from '@/services/api-extensions';
import ReviewCard from './ReviewCard';

type ReviewsSectionProps = {
    starId: string;
};

const PAGE_SIZE = 6;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function ReviewsSection({ starId }: ReviewsSectionProps) {
    const [reviews, setReviews] = useState<Review[]>([]);
    const [breakdown, setBreakdown] = useState<RatingBreakdown[]>([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback((pageToLoad: number) => {
        const first = pageToLoad === 1;

        // The marketplace still uses mock string ids that aren't real star UUIDs.
        // Skip the request in that case and just show the empty state — no error.
        if (!UUID_RE.test(starId)) {
            setReviews([]);
            setBreakdown([]);
            setTotal(0);
            setTotalPages(1);
            setLoading(false);
            return;
        }

        if (first) setLoading(true); else setLoadingMore(true);
        setError(null);

        getStarReviews(starId, pageToLoad, PAGE_SIZE)
            .then((res) => {
                setReviews((prev) => (first ? res.data : [...prev, ...res.data]));
                setTotalPages(res.pagination.totalPages);
                setTotal(res.pagination.total);
                setPage(res.pagination.page);
                if (res.breakdown) setBreakdown(res.breakdown);
            })
            .catch((err: Error) => setError(err.message))
            .finally(() => { setLoading(false); setLoadingMore(false); });
    }, [starId]);

    useEffect(() => { load(1); }, [load]);

    // Build a 5→1 count map from the breakdown rows.
    const counts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    for (const b of breakdown) counts[b.rating] = Number(b.count);
    const maxCount = Math.max(1, ...Object.values(counts));

    return (
        <section>
            <h2 className="text-lg font-bold text-white mb-4">
                Reviews {total > 0 && <span className="text-white/40 font-normal">({total})</span>}
            </h2>

            {loading ? (
                <div className="py-10 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
                </div>
            ) : error ? (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center justify-between">
                    <span>{error}</span>
                    <button onClick={() => load(1)} className="underline hover:no-underline">Retry</button>
                </div>
            ) : reviews.length === 0 ? (
                <p className="text-white/50 text-sm py-6">No reviews yet. Be the first to book and review!</p>
            ) : (
                <>
                    {/* Rating breakdown histogram */}
                    {breakdown.length > 0 && (
                        <div className="rounded-2xl border border-white/10 bg-dark-900 p-5 mb-6 space-y-2">
                            {[5, 4, 3, 2, 1].map((stars) => (
                                <div key={stars} className="flex items-center gap-3">
                                    <span className="flex items-center gap-1 text-xs text-white/60 w-10 shrink-0">
                                        {stars} <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                                    </span>
                                    <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                                        <div
                                            className="h-full bg-yellow-400 rounded-full transition-all"
                                            style={{ width: `${(counts[stars] / maxCount) * 100}%` }}
                                        />
                                    </div>
                                    <span className="text-xs text-white/40 w-8 text-right shrink-0">{counts[stars]}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Review list */}
                    <div className="grid sm:grid-cols-2 gap-4">
                        {reviews.map((review) => (
                            <ReviewCard key={review.id} review={review} />
                        ))}
                    </div>

                    {/* Load more */}
                    {page < totalPages && (
                        <div className="text-center mt-6">
                            <button
                                onClick={() => load(page + 1)}
                                disabled={loadingMore}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/15 text-white text-sm font-medium hover:bg-white/5 disabled:opacity-50 transition"
                            >
                                {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                                {loadingMore ? 'Loading…' : 'Load more'}
                            </button>
                        </div>
                    )}
                </>
            )}
        </section>
    );
}
