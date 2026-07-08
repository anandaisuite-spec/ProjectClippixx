import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Video, Briefcase, Loader2, CheckCircle2, X } from 'lucide-react';
import type { Creator } from '@/data/creators';
import { useAuth } from '@/providers/AuthProvider';
import { useModals } from '@/providers/ModalProvider';
import { createOrder, type Order, type OrderType } from '@/services/api-extensions';
import {
    ORDER_TYPE_LABELS, PERSONAL_ORDER_TYPES, BUSINESS_ORDER_TYPES,
} from '@/constants/orderTypes';

type BookingModalProps = {
    creator: Creator;
    mode: 'personal' | 'business';
    onClose: () => void;
};

const inputCls =
    'w-full rounded-xl bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 px-3 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500';

export default function BookingModal({ creator, mode, onClose }: BookingModalProps) {
    const { user } = useAuth();
    const { openLogin } = useModals();
    const navigate = useNavigate();

    const types = mode === 'personal' ? PERSONAL_ORDER_TYPES : BUSINESS_ORDER_TYPES;
    const [selectedType, setSelectedType] = useState<OrderType>(() => {
        // The "For Business" page may stash an intent (e.g. 'product_launch')
        // when a use-case card is clicked; pre-select it if it's valid for this mode.
        const intent = sessionStorage.getItem('booking_intent');
        sessionStorage.removeItem('booking_intent');
        if (intent && (types as readonly string[]).includes(intent)) {
            return intent as OrderType;
        }
        return types[0] as OrderType;
    });
    const [form, setForm] = useState({
        recipient_name: '',
        occasion: '',
        company_name: '',
        event_name: '',
        event_date: '',
        instructions: '',
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [confirmed, setConfirmed] = useState<Order | null>(null);

    // Require auth — bounce to the existing login modal, close this one.
    useEffect(() => {
        if (!user) {
            openLogin();
            onClose();
        }
    }, [user, openLogin, onClose]);

    if (!user) return null;

    const update = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

    const handleSubmit = async () => {
        if (!form.instructions.trim()) {
            setError('Please add instructions for the creator.');
            return;
        }
        setSubmitting(true);
        setError(null);
        try {
            const order = await createOrder({
                star_id: creator.id,
                order_type: selectedType,
                ...(mode === 'personal'
                    ? { recipient_name: form.recipient_name || undefined, occasion: form.occasion || undefined }
                    : {
                          company_name: form.company_name || undefined,
                          event_name: form.event_name || undefined,
                          event_date: form.event_date || undefined,
                      }),
                instructions: form.instructions.trim(),
            });
            setConfirmed(order);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create booking. Please try again.');
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
                className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-dark-800 rounded-2xl border border-gray-100 dark:border-dark-700 shadow-xl p-6"
            >
                <button
                    onClick={() => !submitting && onClose()}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-white"
                    aria-label="Close"
                >
                    <X className="w-5 h-5" />
                </button>

                {confirmed ? (
                    /* ── Confirmation panel ──────────────────────────── */
                    <div className="text-center py-4">
                        <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center mb-4">
                            <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">Booking request sent!</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {creator.name} will review your request shortly.
                        </p>
                        <div className="mt-4 inline-block text-left text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-dark-700 rounded-xl px-4 py-3">
                            <p>Order ID: <span className="font-mono text-xs">{confirmed.id}</span></p>
                            <p className="mt-1">Price: <span className="font-semibold">₹{creator.price.toLocaleString('en-IN')}</span></p>
                        </div>
                        <div className="flex items-center justify-center gap-2 mt-6">
                            <button
                                onClick={() => { onClose(); navigate('/my-orders'); }}
                                className="px-4 py-2.5 rounded-xl text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white transition"
                            >
                                View in My Orders
                            </button>
                            <button
                                onClick={onClose}
                                className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 transition"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                ) : (
                    /* ── Form ────────────────────────────────────────── */
                    <>
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-11 h-11 rounded-xl bg-primary-100 dark:bg-primary-500/15 flex items-center justify-center">
                                {mode === 'personal'
                                    ? <Video className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                                    : <Briefcase className="w-5 h-5 text-primary-600 dark:text-primary-400" />}
                            </div>
                            <div className="min-w-0">
                                <h3 className="font-semibold text-gray-900 dark:text-white">
                                    Book a {mode === 'personal' ? 'Personal' : 'Business'} Video
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">with {creator.name}</p>
                            </div>
                        </div>

                        {/* Order type chips */}
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-2">Occasion type</label>
                        <div className="flex flex-wrap gap-2 mb-4">
                            {types.map((t) => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setSelectedType(t as OrderType)}
                                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                                        selectedType === t
                                            ? 'bg-primary-600 text-white'
                                            : 'bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600'
                                    }`}
                                >
                                    {ORDER_TYPE_LABELS[t]}
                                </button>
                            ))}
                        </div>

                        {/* Conditional fields */}
                        <div className="space-y-3">
                            {mode === 'personal' ? (
                                <>
                                    <Field label="Recipient name">
                                        <input className={inputCls} value={form.recipient_name} onChange={(e) => update('recipient_name', e.target.value)} placeholder="Who is this for?" />
                                    </Field>
                                    <Field label="Occasion">
                                        <input className={inputCls} value={form.occasion} onChange={(e) => update('occasion', e.target.value)} placeholder="e.g. Birthday, Anniversary" />
                                    </Field>
                                </>
                            ) : (
                                <>
                                    <Field label="Company name">
                                        <input className={inputCls} value={form.company_name} onChange={(e) => update('company_name', e.target.value)} placeholder="Your company" />
                                    </Field>
                                    <Field label="Event name">
                                        <input className={inputCls} value={form.event_name} onChange={(e) => update('event_name', e.target.value)} placeholder="e.g. Product Launch 2026" />
                                    </Field>
                                    <Field label="Event date">
                                        <input type="date" className={inputCls} value={form.event_date} onChange={(e) => update('event_date', e.target.value)} />
                                    </Field>
                                </>
                            )}
                            <Field label="Instructions">
                                <textarea
                                    className={`${inputCls} resize-none`}
                                    rows={3}
                                    maxLength={2000}
                                    value={form.instructions}
                                    onChange={(e) => update('instructions', e.target.value)}
                                    placeholder="Tell the creator what to say…"
                                />
                            </Field>
                        </div>

                        {/* Price + note */}
                        <div className="mt-4 flex items-baseline justify-between">
                            <span className="text-2xl font-bold text-gray-900 dark:text-white">₹{creator.price.toLocaleString('en-IN')}</span>
                            <span className="text-xs text-gray-400">Charged after the creator accepts</span>
                        </div>

                        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

                        <button
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="mt-4 w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white transition"
                        >
                            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                            {submitting ? 'Sending…' : 'Send Booking Request'}
                        </button>
                    </>
                )}
            </motion.div>
        </motion.div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5">{label}</label>
            {children}
        </div>
    );
}
