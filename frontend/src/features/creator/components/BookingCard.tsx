import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Video, Briefcase } from 'lucide-react';
import type { Creator } from '@/data/creators';
import BookingModal from './BookingModal';

type BookingCardProps = {
    creator: Creator;
};

/** Sticky booking panel — price, delivery, personal/business CTAs. */
export default function BookingCard({ creator }: BookingCardProps) {
    const navigate = useNavigate();
    const [bookingMode, setBookingMode] = useState<'personal' | 'business' | null>(null);

    return (
        <>
            <div className="rounded-3xl border border-white/10 bg-dark-900 p-6 shadow-xl">
                <div className="flex items-baseline justify-between mb-6">
                    <span className="text-3xl font-bold text-white">₹{creator.price.toLocaleString('en-IN')}</span>
                    <span className="text-sm text-white/50">personal video</span>
                </div>

                <button
                    type="button"
                    onClick={() => navigate(`/book/${creator.id}`)}
                    className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-full bg-primary-600 hover:bg-primary-700 text-white font-semibold transition-colors"
                >
                    <Video className="w-5 h-5" />
                    Book a Personal Video
                </button>

                <button
                    type="button"
                    onClick={() => setBookingMode('business')}
                    className="mt-3 w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-full border border-white/15 text-white font-semibold hover:bg-white/5 transition-colors"
                >
                    <Briefcase className="w-5 h-5" />
                    Book a Business Video
                </button>

                <p className="mt-4 text-center text-xs text-white/40">100% satisfaction guarantee</p>
            </div>

            <AnimatePresence>
                {bookingMode && (
                    <BookingModal
                        creator={creator}
                        mode={bookingMode}
                        onClose={() => setBookingMode(null)}
                    />
                )}
            </AnimatePresence>
        </>
    );
}
