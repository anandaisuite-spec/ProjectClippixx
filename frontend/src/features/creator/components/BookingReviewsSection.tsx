import { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import StarRating from './StarRating';
import { getStarReviews, type PublicReview } from '@/services/api';

/**
 * Public booking-based reviews on the creator profile. Shows latest reviews
 * with a "Load more" button when there are more than the first page.
 * Renders nothing when the creator has no reviews.
 */
export default function BookingReviewsSection({ starId, totalCount }: { starId: string; totalCount: number }) {
    const [reviews, setReviews] = useState<PublicReview[]>([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    const fetchPage = useCallback(async (target: number, replace: boolean) => {
        if (replace) setLoading(true); else setLoadingMore(true);
        try {
            const res = await getStarReviews(starId, target, 5);
            setReviews((prev) => (replace ? res.data : [...prev, ...res.data]));
            setPage(res.pagination.page);
            setTotalPages(res.pagination.totalPages);
        } catch {
            // Non-critical section — fail quietly.
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [starId]);

    useEffect(() => { fetchPage(1, true); }, [fetchPage]);

    if (totalCount === 0) return null;

    return (
        <section>
            <h2 className="text-lg font-bold text-white mb-4">Reviews</h2>
            {loading ? (
                <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-white/40" /></div>
            ) : (
                <div className="space-y-4">
                    {reviews.map((r) => (
                        <div key={r.id} className="rounded-2xl border border-white/10 bg-dark-900 p-4">
                            <div className="flex items-center justify-between gap-3">
                                <p className="font-medium text-white">{r.fan_name || 'Anonymous'}</p>
                                <StarRating value={r.rating} size="sm" />
                            </div>
                            {r.review_text && <p className="mt-2 text-sm text-white/70 leading-relaxed">{r.review_text}</p>}
                            <p className="mt-2 text-xs text-white/40">{new Date(r.created_at).toLocaleDateString('en-IN')}</p>
                        </div>
                    ))}

                    {page < totalPages && (
                        <div className="flex justify-center pt-1">
                            <button
                                onClick={() => fetchPage(page + 1, false)}
                                disabled={loadingMore}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium border border-white/15 text-white hover:bg-white/5 transition disabled:opacity-50"
                            >
                                {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                                {loadingMore ? 'Loading…' : 'Load more'}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}
