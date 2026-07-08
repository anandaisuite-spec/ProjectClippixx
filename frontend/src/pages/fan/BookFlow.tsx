import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
    Loader2, ArrowLeft, Check, CreditCard, PartyPopper, Gift, Clock, AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/providers/AuthProvider';
import { getStarById, type Star } from '@/services/api-extensions';
import { createBooking, type CreatedBooking } from '@/services/api';

const OCCASIONS = ['Birthday', 'Anniversary', 'Motivation', 'Other'];

type Tier = NonNullable<Star['pricing_tiers']>[number];

const inputCls = 'w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-primary-500 placeholder:text-white/30';
const labelCls = 'block text-sm font-medium text-white/80 mb-1.5';

export default function BookFlow() {
    const { creatorId } = useParams<{ creatorId: string }>();
    const [params] = useSearchParams();
    const tierId = params.get('tier');
    const navigate = useNavigate();
    const { user } = useAuth();

    const [creator, setCreator] = useState<Star | null>(null);
    const [tier, setTier] = useState<Tier | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [step, setStep] = useState(1); // 1 Request · 2 Review&Pay · 3 Confirm
    const [paying, setPaying] = useState(false);
    const [payError, setPayError] = useState<string | null>(null);
    const [confirmed, setConfirmed] = useState<CreatedBooking | null>(null);

    // Step 1 form
    const [fanName, setFanName] = useState(user?.displayName ?? '');
    const [videoFor, setVideoFor] = useState<'myself' | 'someone_else'>('myself');
    const [occasion, setOccasion] = useState('Birthday');
    const [instructions, setInstructions] = useState('');
    const [isGift, setIsGift] = useState(false);
    const [giftName, setGiftName] = useState('');
    const [giftEmail, setGiftEmail] = useState('');

    const load = useCallback(() => {
        if (!creatorId) return;
        setLoading(true);
        setLoadError(null);
        let cancelled = false;
        getStarById(creatorId)
            .then((c) => {
                if (cancelled) return;
                setCreator(c);
                const found = (c.pricing_tiers ?? []).find((t) => t.id === tierId) ?? null;
                setTier(found);
                if (!found) setLoadError('That booking option is no longer available.');
            })
            .catch((err: Error) => { if (!cancelled) setLoadError(err.message); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [creatorId, tierId]);

    useEffect(() => { load(); }, [load]);

    // Keep the name field in sync once auth resolves (without clobbering edits).
    useEffect(() => {
        if (user?.displayName && !fanName) setFanName(user.displayName);
    }, [user, fanName]);

    const goReview = () => {
        if (!fanName.trim()) { setPayError('Please enter your name'); return; }
        if (isGift && !giftName.trim()) { setPayError('Enter the gift recipient name'); return; }
        setPayError(null);
        setStep(2);
    };

    // Stubbed payment → on "success", create the booking.
    // Razorpay drops in here later: open checkout, then call createBooking in its
    // success handler instead of the simulated timeout.
    const payAndBook = async () => {
        if (!creator || !tier) return;
        setPaying(true);
        setPayError(null);
        try {
            // Simulate the payment round-trip.
            await new Promise((r) => setTimeout(r, 800));
            const booking = await createBooking({
                creator_id: creator.id,
                tier_id: tier.id,
                fan_name: fanName.trim(),
                video_for: videoFor,
                occasion,
                instructions: instructions.trim() || undefined,
                is_gift: isGift,
                gift_recipient_name: isGift ? giftName.trim() : undefined,
                gift_recipient_email: isGift && giftEmail.trim() ? giftEmail.trim() : undefined,
            });
            setConfirmed(booking);
            setStep(3);
        } catch (err) {
            setPayError(err instanceof Error ? err.message : 'Payment failed, please try again');
        } finally {
            setPaying(false);
        }
    };

    // ── Loading / error ──
    if (loading) {
        return (
            <div className="min-h-screen bg-dark-950 pt-24 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
            </div>
        );
    }
    if (loadError || !creator || !tier) {
        return (
            <div className="min-h-screen bg-dark-950 pt-24 px-4 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-14 h-14 mx-auto rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                        <AlertCircle className="w-7 h-7 text-white/40" />
                    </div>
                    <p className="text-white/80 font-medium">{loadError || 'Booking unavailable'}</p>
                    {creator && (
                        <Link to={`/creator/${creator.id}`} className="mt-4 inline-block text-sm text-primary-400 hover:underline">
                            Back to {creator.name}
                        </Link>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-dark-950 pt-24 pb-16 px-4 sm:px-6">
            <div className="max-w-xl mx-auto">
                {step < 3 && (
                    <button
                        onClick={() => (step === 1 ? navigate(`/creator/${creator.id}`) : setStep(1))}
                        className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors mb-6"
                    >
                        <ArrowLeft className="w-4 h-4" /> {step === 1 ? 'Back to profile' : 'Back'}
                    </button>
                )}

                {/* Step indicator */}
                <div className="flex items-center mb-8">
                    {['Request', 'Review & Pay', 'Done'].map((label, i) => {
                        const n = i + 1;
                        const done = step > n;
                        const active = step === n;
                        return (
                            <div key={label} className="flex items-center flex-1 last:flex-none">
                                <div className="flex flex-col items-center">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 ${
                                        done ? 'bg-emerald-500 border-emerald-500 text-white'
                                            : active ? 'bg-primary-600 border-primary-600 text-white'
                                                : 'border-white/20 text-white/40'}`}>
                                        {done ? <Check className="w-4 h-4" /> : n}
                                    </div>
                                    <span className={`mt-1 text-xs hidden sm:block ${active ? 'text-white' : 'text-white/40'}`}>{label}</span>
                                </div>
                                {i < 2 && <div className={`flex-1 h-0.5 mx-2 ${step > n ? 'bg-emerald-500' : 'bg-white/10'}`} />}
                            </div>
                        );
                    })}
                </div>

                {/* ── Step 1: Request ── */}
                {step === 1 && (
                    <div className="rounded-2xl border border-white/10 bg-dark-900 p-6 space-y-5">
                        <div>
                            <h1 className="text-xl font-bold text-white">Book {creator.name}</h1>
                            <p className="text-sm text-white/50 mt-1">{tier.tier_name} · ₹{Number(tier.price).toLocaleString('en-IN')}</p>
                        </div>

                        <div>
                            <label className={labelCls}>Your name</label>
                            <input value={fanName} onChange={(e) => setFanName(e.target.value)} className={inputCls} placeholder="Your name" />
                        </div>

                        <div>
                            <label className={labelCls}>Who is the video for?</label>
                            <div className="grid grid-cols-2 gap-2">
                                {([['myself', 'Yourself'], ['someone_else', 'Someone else']] as const).map(([val, lbl]) => (
                                    <button
                                        key={val}
                                        type="button"
                                        onClick={() => setVideoFor(val)}
                                        className={`px-4 py-2.5 rounded-xl text-sm font-medium border transition ${
                                            videoFor === val ? 'bg-primary-600 border-primary-600 text-white' : 'border-white/10 text-white/70 hover:border-white/30'}`}
                                    >
                                        {lbl}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className={labelCls}>Occasion</label>
                            <select value={occasion} onChange={(e) => setOccasion(e.target.value)} className={inputCls}>
                                {OCCASIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className={labelCls}>Instructions to creator</label>
                            <textarea
                                value={instructions}
                                onChange={(e) => setInstructions(e.target.value.slice(0, 500))}
                                rows={4}
                                placeholder="What should they say? Pronunciations, inside jokes, etc."
                                className={`${inputCls} resize-none`}
                            />
                            <p className="mt-1 text-xs text-right text-white/30">{instructions.length}/500</p>
                        </div>

                        {/* Gift toggle */}
                        <div>
                            <div className="flex items-center justify-between">
                                <span className="flex items-center gap-2 text-sm font-medium text-white/80"><Gift className="w-4 h-4" /> Is this a gift?</span>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={isGift}
                                    onClick={() => setIsGift((g) => !g)}
                                    className={`relative w-12 h-6 rounded-full transition-colors ${isGift ? 'bg-emerald-500' : 'bg-white/15'}`}
                                >
                                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${isGift ? 'translate-x-6' : ''}`} />
                                </button>
                            </div>
                            {isGift && (
                                <div className="mt-3 space-y-3">
                                    <input value={giftName} onChange={(e) => setGiftName(e.target.value)} className={inputCls} placeholder="Recipient name" />
                                    <input value={giftEmail} onChange={(e) => setGiftEmail(e.target.value)} type="email" className={inputCls} placeholder="Recipient email (optional)" />
                                </div>
                            )}
                        </div>

                        {payError && <p className="text-sm text-red-400">{payError}</p>}

                        <button
                            onClick={goReview}
                            className="w-full px-5 py-3 rounded-full bg-primary-600 hover:bg-primary-700 text-white font-semibold transition-colors"
                        >
                            Continue to Review
                        </button>
                    </div>
                )}

                {/* ── Step 2: Review & Pay ── */}
                {step === 2 && (
                    <div className="rounded-2xl border border-white/10 bg-dark-900 p-6 space-y-5">
                        <h1 className="text-xl font-bold text-white">Review & Pay</h1>

                        <div className="rounded-xl bg-white/5 p-4 space-y-2 text-sm">
                            <Row label="Creator" value={creator.name} />
                            <Row label="Package" value={tier.tier_name} />
                            <Row label="Delivery" value={`${tier.delivery_days} ${tier.delivery_days === 1 ? 'day' : 'days'}`} />
                            <div className="border-t border-white/10 my-2" />
                            <div className="flex items-center justify-between">
                                <span className="text-white/60">Total</span>
                                <span className="text-xl font-bold text-white">₹{Number(tier.price).toLocaleString('en-IN')}</span>
                            </div>
                        </div>

                        <p className="flex items-center gap-2 text-xs text-white/40">
                            <Clock className="w-3.5 h-3.5" /> You won't be charged until the creator accepts (simulated for now).
                        </p>

                        {payError && <p className="text-sm text-red-400">{payError}</p>}

                        <button
                            onClick={payAndBook}
                            disabled={paying}
                            className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-full bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-semibold transition-colors"
                        >
                            {paying ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
                            {paying ? 'Processing…' : `Pay ₹${Number(tier.price).toLocaleString('en-IN')}`}
                        </button>
                        <p className="text-center text-[11px] text-white/30">Payment is simulated — no real charge. Razorpay will be wired in later.</p>
                    </div>
                )}

                {/* ── Step 3: Confirmation ── */}
                {step === 3 && confirmed && (
                    <div className="rounded-2xl border border-white/10 bg-dark-900 p-8 text-center space-y-5">
                        <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500 flex items-center justify-center">
                            <PartyPopper className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">Booking confirmed!</h1>
                            <p className="text-white/60 mt-1">{creator.name} will get started on your video.</p>
                        </div>
                        <div className="rounded-xl bg-white/5 px-4 py-3 inline-block">
                            <p className="text-xs text-white/40">Booking ID</p>
                            <p className="text-sm font-mono text-white">{confirmed.id}</p>
                        </div>
                        <div>
                            <Link
                                to={`/fan/bookings/${confirmed.id}`}
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary-600 hover:bg-primary-700 text-white font-semibold transition-colors"
                            >
                                View My Booking
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-white/60">{label}</span>
            <span className="text-white font-medium">{value}</span>
        </div>
    );
}
