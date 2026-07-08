import { useNavigate } from 'react-router-dom';
import { Clock } from 'lucide-react';
import type { Creator } from '@/data/creators';

type PricingTiersProps = {
    creator: Creator;
};

/**
 * Booking panel driven by the creator's pricing tiers.
 *
 *   Case 1 — accepting_bookings && tiers exist → list of bookable tier cards.
 *   Case 2 — accepting_bookings === false      → single muted "not accepting" card.
 *   Case 3 — no tiers                          → render nothing.
 *
 * Book Now wires navigation to the (not-yet-built) booking flow:
 *   /book/:creatorId?tier={tierId}
 */
export default function PricingTiers({ creator }: PricingTiersProps) {
    const navigate = useNavigate();
    const tiers = creator.pricing_tiers ?? [];

    // Case 2 — explicitly not accepting bookings.
    if (creator.accepting_bookings === false) {
        return (
            <div className="rounded-3xl border border-white/10 bg-dark-900 p-6 shadow-xl">
                <p className="text-center text-sm text-white/50">
                    {creator.name} isn't accepting bookings right now.
                </p>
            </div>
        );
    }

    // Case 3 — no tiers configured: render nothing.
    if (tiers.length === 0) {
        return null;
    }

    // Case 1 — bookable tiers.
    return (
        <div className="rounded-3xl border border-white/10 bg-dark-900 p-6 shadow-xl">
            <h2 className="text-lg font-bold text-white mb-5">Book {creator.name}</h2>

            <div className="space-y-4">
                {tiers.map((tier) => (
                    <div
                        key={tier.id}
                        className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-base font-bold text-white">{tier.tier_name}</p>
                                {tier.description && (
                                    <p className="mt-0.5 text-sm text-white/50">{tier.description}</p>
                                )}
                            </div>
                            <span className="shrink-0 text-xl font-bold text-white">
                                ₹{tier.price.toLocaleString('en-IN')}
                            </span>
                        </div>

                        <p className="mt-2 flex items-center gap-1.5 text-xs text-white/40">
                            <Clock className="w-3.5 h-3.5" />
                            Delivered in {tier.delivery_days} {tier.delivery_days === 1 ? 'day' : 'days'}
                        </p>

                        <button
                            type="button"
                            onClick={() => navigate(`/book/${creator.id}?tier=${tier.id}`)}
                            className="mt-4 w-full px-5 py-3 rounded-full bg-primary-600 hover:bg-primary-700 text-white font-semibold transition-colors"
                        >
                            Book Now
                        </button>
                    </div>
                ))}
            </div>

            <p className="mt-4 text-center text-xs text-white/40">100% satisfaction guarantee</p>
        </div>
    );
}
