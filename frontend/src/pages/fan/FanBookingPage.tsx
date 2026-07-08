import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, Download, ExternalLink, Clock, PartyPopper, AlertCircle, Check } from 'lucide-react';
import {
    getBookingForFan, getBookingVideoUrl, getMyBookingReview, submitBookingReview,
    type FanBooking, type BookingStatus, type BookingReview,
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
    pending: 'Pending', accepted: 'Accepted', in_progress: 'In Progress',
    delivered: 'Delivered', cancelled: 'Cancelled',
};

const PROGRESS_MESSAGE: Record<BookingStatus, string> = {
    pending: 'Your request has been received and is waiting for the creator to accept.',
    accepted: 'The creator has accepted your request and will start soon.',
    in_progress: 'The creator is working on your video right now.',
    delivered: '',
    cancelled: 'This booking was cancelled.',
};

export default function FanBookingPage() {
    const { bookingId } = useParams<{ bookingId: string }>();
    const [booking, setBooking] = useState<FanBooking | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [fetchingUrl, setFetchingUrl] = useState(false);
    const [urlError, setUrlError] = useState<string | null>(null);

    // Review state.
    const [myReview, setMyReview] = useState<BookingReview | null>(null);
    const [rating, setRating] = useState(0);
    const [reviewText, setReviewText] = useState('');
    const [submittingReview, setSubmittingReview] = useState(false);
    const [reviewError, setReviewError] = useState<string | null>(null);

    const load = useCallback(() => {
        if (!bookingId) return;
        setLoading(true);
        setError(null);
        let cancelled = false;
        getBookingForFan(bookingId)
            .then((b) => { if (!cancelled) setBooking(b); })
            .catch((err: Error) => { if (!cancelled) setError(err.message); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [bookingId]);

    useEffect(() => { load(); }, [load]);

    // Load any existing review once we know the booking is delivered.
    useEffect(() => {
        if (!bookingId || booking?.status !== 'delivered') return;
        let cancelled = false;
        getMyBookingReview(bookingId)
            .then((r) => { if (!cancelled) setMyReview(r); })
            .catch(() => { /* non-critical */ });
        return () => { cancelled = true; };
    }, [bookingId, booking?.status]);

    const submitReview = async () => {
        if (!bookingId) return;
        if (rating < 1) { setReviewError('Please pick a star rating'); return; }
        setSubmittingReview(true);
        setReviewError(null);
        try {
            const created = await submitBookingReview(bookingId, rating, reviewText.trim() || undefined);
            setMyReview(created);
        } catch (err) {
            setReviewError(err instanceof Error ? err.message : 'Failed to submit review');
        } finally {
            setSubmittingReview(false);
        }
    };

    const openVideo = async () => {
        if (!bookingId) return;
        setFetchingUrl(true);
        setUrlError(null);
        try {
            const { url } = await getBookingVideoUrl(bookingId);
            window.open(url, '_blank', 'noopener,noreferrer');
        } catch (err) {
            setUrlError(err instanceof Error ? err.message : 'Could not open the video');
        } finally {
            setFetchingUrl(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-dark-900 pt-24 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
            </div>
        );
    }

    if (error || !booking) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-dark-900 pt-24 px-4 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-14 h-14 mx-auto rounded-2xl bg-gray-100 dark:bg-dark-800 flex items-center justify-center mb-4">
                        <AlertCircle className="w-7 h-7 text-gray-400" />
                    </div>
                    <p className="text-gray-700 dark:text-gray-200 font-medium">{error || 'Booking not found'}</p>
                    {error && <button onClick={load} className="mt-3 text-sm text-primary-600 dark:text-primary-400 hover:underline">Try again</button>}
                </div>
            </div>
        );
    }

    const isDelivered = booking.status === 'delivered' && booking.has_video;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-dark-900 pt-24 pb-16 px-4 sm:px-6">
            <div className="max-w-lg mx-auto">
                <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-100 dark:border-dark-700 shadow-sm p-6 sm:p-8">
                    {/* Creator + tier + status */}
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-xs text-gray-500 dark:text-gray-400">Your booking with</p>
                            <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">{booking.creator_name || 'Creator'}</h1>
                            {booking.tier_name && (
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    {booking.tier_name}
                                    {booking.tier_price != null && <span> · ₹{Number(booking.tier_price).toLocaleString('en-IN')}</span>}
                                </p>
                            )}
                        </div>
                        <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[booking.status]}`}>
                            {STATUS_LABEL[booking.status]}
                        </span>
                    </div>

                    <div className="mt-6 border-t border-gray-100 dark:border-dark-700 pt-6">
                        {isDelivered ? (
                            <div className="text-center">
                                <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500 flex items-center justify-center mb-4">
                                    <PartyPopper className="w-8 h-8 text-white" />
                                </div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Your video is ready!</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Enjoy your personalized video.</p>

                                <button
                                    onClick={openVideo}
                                    disabled={fetchingUrl}
                                    className="mt-6 w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm font-semibold bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white transition"
                                >
                                    {fetchingUrl
                                        ? <Loader2 className="w-5 h-5 animate-spin" />
                                        : booking.delivery_method === 'link'
                                            ? <ExternalLink className="w-5 h-5" />
                                            : <Download className="w-5 h-5" />}
                                    {booking.delivery_method === 'link' ? 'Open Video' : 'Download Video'}
                                </button>
                                {urlError && <p className="mt-3 text-sm text-red-500">{urlError}</p>}
                            </div>
                        ) : (
                            <div className="text-center">
                                <div className="w-14 h-14 mx-auto rounded-2xl bg-gray-100 dark:bg-dark-700 flex items-center justify-center mb-4">
                                    <Clock className="w-7 h-7 text-gray-400" />
                                </div>
                                <p className="text-gray-700 dark:text-gray-200 font-medium">{PROGRESS_MESSAGE[booking.status]}</p>
                                {booking.status !== 'cancelled' && (
                                    <p className="text-sm text-gray-400 mt-2">We'll email you when it's ready.</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Review section — only after delivery */}
                {booking.status === 'delivered' && (
                    <div className="mt-6 bg-white dark:bg-dark-800 rounded-2xl border border-gray-100 dark:border-dark-700 shadow-sm p-6">
                        {myReview ? (
                            <div>
                                <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-3">
                                    <Check className="w-4 h-4" /> Review submitted
                                </p>
                                <StarRating value={myReview.rating} size="md" />
                                {myReview.review_text && (
                                    <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">{myReview.review_text}</p>
                                )}
                            </div>
                        ) : (
                            <div>
                                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Rate your experience</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Let others know how it went.</p>
                                <StarRating value={rating} onChange={setRating} size="lg" />
                                <textarea
                                    value={reviewText}
                                    onChange={(e) => setReviewText(e.target.value.slice(0, 1000))}
                                    rows={3}
                                    placeholder="Tell others about your experience"
                                    className="mt-4 w-full rounded-xl bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 px-3 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                                />
                                {reviewError && <p className="mt-2 text-sm text-red-500">{reviewError}</p>}
                                <button
                                    onClick={submitReview}
                                    disabled={submittingReview}
                                    className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white transition"
                                >
                                    {submittingReview && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {submittingReview ? 'Submitting…' : 'Submit Review'}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
