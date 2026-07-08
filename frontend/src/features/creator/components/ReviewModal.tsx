import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, X, Star } from 'lucide-react';
import { submitReview, type Order } from '@/services/api-extensions';
import StarRating from './StarRating';

type ReviewModalProps = {
    order: Order;
    onClose: () => void;
    onSubmitted: () => void;
};

export default function ReviewModal({ order, onClose, onSubmitted }: ReviewModalProps) {
    const [rating, setRating] = useState(0);
    const [text, setText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async () => {
        if (rating < 1) { setError('Please select a rating.'); return; }
        setSubmitting(true);
        setError(null);
        try {
            await submitReview(order.id, rating, text.trim() || undefined);
            onSubmitted();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to submit review');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center p-4"
        >
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !submitting && onClose()} />

            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-md bg-white dark:bg-dark-800 rounded-2xl border border-gray-100 dark:border-dark-700 shadow-xl p-6"
            >
                <button
                    onClick={() => !submitting && onClose()}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-white"
                    aria-label="Close"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-3 mb-5">
                    {order.star_image ? (
                        <img src={order.star_image} alt={order.star_name || 'Creator'} className="w-11 h-11 rounded-xl object-cover" />
                    ) : (
                        <div className="w-11 h-11 rounded-xl bg-primary-100 dark:bg-primary-500/15 flex items-center justify-center">
                            <Star className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                        </div>
                    )}
                    <div className="min-w-0">
                        <h3 className="font-semibold text-gray-900 dark:text-white">Leave a Review</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{order.star_name || 'Creator'}</p>
                    </div>
                </div>

                <div className="mb-4">
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-2">Your rating</label>
                    <StarRating value={rating} onChange={setRating} size="lg" />
                </div>

                <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5">Review (optional)</label>
                    <textarea
                        rows={4}
                        maxLength={2000}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="How was your experience?"
                        className="w-full rounded-xl bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 px-3 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                    />
                    <p className="text-xs text-gray-400 mt-1 text-right">{text.length}/2000</p>
                </div>

                {error && <p className="text-sm text-red-500">{error}</p>}

                <div className="flex items-center justify-end gap-2 mt-4">
                    <button
                        onClick={() => onClose()}
                        disabled={submitting}
                        className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 transition"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white transition"
                    >
                        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                        {submitting ? 'Submitting…' : 'Submit Review'}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}
