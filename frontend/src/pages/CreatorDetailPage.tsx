import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Star, ArrowLeft, UserX, Loader2 } from 'lucide-react';
import VerifiedBadge from '@/components/ui/VerifiedBadge';
import { getCreatorById, type Creator } from '@/data/creators';
import CreatorGallery from '@/features/creator/components/CreatorGallery';
import BookingCard from '@/features/creator/components/BookingCard';
import PricingTiers from '@/features/creator/components/PricingTiers';
import ReviewsSection from '@/features/creator/components/ReviewsSection';
import ProfileGallery from '@/features/creator/components/ProfileGallery';
import BookingReviewsSection from '@/features/creator/components/BookingReviewsSection';
import StarRating from '@/features/creator/components/StarRating';

export default function CreatorDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [creator, setCreator] = useState<Creator | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(() => {
        if (!id) return;
        setLoading(true);
        setError(null);
        let cancelled = false;

        getCreatorById(id)
            .then((c) => { if (!cancelled) setCreator(c); })
            .catch((err: Error) => { if (!cancelled) setError(err.message); })
            .finally(() => { if (!cancelled) setLoading(false); });

        return () => { cancelled = true; };
    }, [id]);

    useEffect(() => { load(); }, [load]);

    // ── Loading ──────────────────────────────────────────────
    if (loading) {
        return (
            <div className="min-h-screen bg-dark-950 pt-24 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
            </div>
        );
    }

    // ── Error (network/server) ───────────────────────────────
    if (error) {
        return (
            <div className="min-h-screen bg-dark-950 pt-24 pb-16 px-6 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-400">{error}</p>
                    <button onClick={load} className="mt-4 text-sm text-primary-400 hover:underline">Try again</button>
                </div>
            </div>
        );
    }

    // ── Not found ────────────────────────────────────────────
    if (!creator) {
        return (
            <div className="min-h-screen bg-dark-950 pt-24 pb-16 px-6 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-white/5 flex items-center justify-center mb-5">
                        <UserX className="w-8 h-8 text-white/40" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">Creator Not Found</h1>
                    <p className="text-white/50 mt-2">We couldn't find a creator at this link.</p>
                    <Link
                        to="/creators"
                        className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 rounded-full bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" /> Browse all creators
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-dark-950 pt-24 pb-16 px-4 sm:px-6">
            <div className="max-w-6xl mx-auto">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors mb-6"
                >
                    <ArrowLeft className="w-4 h-4" /> Back
                </button>

                {/* Cover image header — only when set */}
                {creator.cover_image_url && (
                    <div className="w-full rounded-3xl overflow-hidden mb-6" style={{ aspectRatio: '16 / 5' }}>
                        <img src={creator.cover_image_url} alt={`${creator.name} cover`} className="w-full h-full object-cover" />
                    </div>
                )}

                <div className="grid lg:grid-cols-[1fr_360px] gap-8">
                    {/* Left: gallery + name + about */}
                    <div className="space-y-8">
                        {/* Main image — prefer the uploaded profile picture, else the catalogue image. */}
                        <CreatorGallery images={[creator.profile_picture_url || creator.image_url]} name={creator.name} />

                        <div>
                            <span className="text-xs font-medium text-primary-300 uppercase tracking-wider">{creator.category}</span>
                            <h1 className="flex items-center gap-2 text-3xl sm:text-4xl font-bold text-white mt-1">
                                {creator.name}
                                {creator.is_verified && <VerifiedBadge showLabel={false} className="shrink-0 [&_svg]:w-6 [&_svg]:h-6" />}
                            </h1>
                            {creator.is_verified && <VerifiedBadge className="mt-2" />}
                            <div className="flex items-center gap-3 mt-3 text-sm">
                                {/* Booking-review rating when present, else the catalogue rating. */}
                                {(creator.review_count ?? 0) > 0 ? (
                                    <StarRating value={creator.avg_rating ?? 0} size="sm" showValue />
                                ) : (
                                    <span className="flex items-center gap-1.5 text-white">
                                        <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                                        <span className="font-semibold">{Number(creator.rating).toFixed(1)}</span>
                                    </span>
                                )}
                                <span className="text-white/40">·</span>
                                <span className="text-white/60">
                                    {((creator.review_count ?? 0) > 0 ? creator.review_count! : creator.reviews_count).toLocaleString()} reviews
                                </span>
                            </div>
                        </div>

                        {/* About — bio only renders when present */}
                        {creator.bio && (
                            <section>
                                <h2 className="text-lg font-bold text-white mb-3">About</h2>
                                <p className="text-white/70 leading-relaxed">{creator.bio}</p>
                            </section>
                        )}

                        {/* Gallery — only renders when the creator has items */}
                        <ProfileGallery items={creator.gallery ?? []} />

                        {/* Booking-based reviews (latest 5 + load more) */}
                        <BookingReviewsSection starId={creator.id} totalCount={creator.review_count ?? 0} />

                        {/* Legacy order-based reviews — kept intact */}
                        <ReviewsSection starId={creator.id} />
                    </div>

                    {/* Right: sticky booking. Prefer the creator's pricing tiers
                        (onboarding-driven); fall back to the legacy booking card
                        for creators who haven't set tiers and are still accepting. */}
                    <div className="lg:sticky lg:top-24 h-fit">
                        {(creator.pricing_tiers && creator.pricing_tiers.length > 0)
                            || creator.accepting_bookings === false ? (
                            <PricingTiers creator={creator} />
                        ) : (
                            <BookingCard creator={creator} />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
