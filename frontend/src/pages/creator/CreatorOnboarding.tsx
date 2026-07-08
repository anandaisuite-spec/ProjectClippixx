import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Check, Loader2, Plus, Trash2, IndianRupee, Sparkles, X,
    User, Tag, CalendarClock, PartyPopper,
} from 'lucide-react';
import { useAuth } from '@/providers/AuthProvider';
import {
    getOnboardingStatus, saveOnboardingProfile, saveOnboardingPricing,
    saveOnboardingAvailability, completeOnboarding, checkUsername, USERNAME_RE,
    type PricingTierInput,
} from '@/services/api';

const DASHBOARD_ROUTE = '/creator-dashboard';
const STEP_STORAGE_KEY = 'clipixx_onboarding_step';

const CATEGORIES = ['Actor', 'Musician', 'Comedian', 'Athlete', 'Influencer', 'YouTuber', 'Podcaster', 'Other'];
const LANGUAGES = ['English', 'Hindi', 'Tamil', 'Telugu', 'Kannada', 'Bengali', 'Marathi', 'Other'];
const TURNAROUND_OPTIONS = [1, 3, 7, 14, 30];
const MAX_TIERS = 5;

const STEPS = [
    { label: 'Profile', icon: User },
    { label: 'Pricing', icon: Tag },
    { label: 'Availability', icon: CalendarClock },
    { label: 'Done', icon: PartyPopper },
];

type Tier = { tier_name: string; description: string; price: string; delivery_days: string };

const emptyTier = (): Tier => ({ tier_name: '', description: '', price: '', delivery_days: '7' });

// ─── Lightweight inline toast ────────────────────────────────────────────────
type Toast = { id: number; message: string };

export default function CreatorOnboarding() {
    const navigate = useNavigate();
    const { user } = useAuth();

    const [booting, setBooting] = useState(true);
    const [step, setStep] = useState(0);
    const [saving, setSaving] = useState(false);
    const [direction, setDirection] = useState(1); // 1 = forward, -1 = back
    const [toasts, setToasts] = useState<Toast[]>([]);

    // Step data
    const [username, setUsername] = useState('');
    // Username availability: idle | invalid | checking | available | taken
    const [usernameState, setUsernameState] = useState<'idle' | 'invalid' | 'checking' | 'available' | 'taken'>('idle');
    const [bio, setBio] = useState('');
    const [category, setCategory] = useState('');
    const [languages, setLanguages] = useState<string[]>([]);
    const [tiers, setTiers] = useState<Tier[]>([emptyTier()]);
    const [turnaround, setTurnaround] = useState(7);
    const [acceptingBookings, setAcceptingBookings] = useState(true);

    const toastIdRef = useRef(0);
    const pushToast = useCallback((message: string) => {
        const id = ++toastIdRef.current;
        setToasts((t) => [...t, { id, message }]);
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
    }, []);

    // ─── Debounced username availability check (500ms) ───────────────────────
    useEffect(() => {
        if (!username) { setUsernameState('idle'); return; }
        if (!USERNAME_RE.test(username)) { setUsernameState('invalid'); return; }
        setUsernameState('checking');
        let cancelled = false;
        const t = setTimeout(async () => {
            try {
                const { available } = await checkUsername(username);
                if (!cancelled) setUsernameState(available ? 'available' : 'taken');
            } catch {
                if (!cancelled) setUsernameState('idle');
            }
        }, 500);
        return () => { cancelled = true; clearTimeout(t); };
    }, [username]);

    // ─── Boot: check status; redirect if already complete; restore step ──────
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const status = await getOnboardingStatus();
                if (cancelled) return;
                if (status.onboarding_completed) {
                    navigate(DASHBOARD_ROUTE, { replace: true });
                    return;
                }
                // Prefer the server's derived step, but fall back to a locally
                // stored step if it's further along (page refresh mid-step).
                const stored = Number(localStorage.getItem(STEP_STORAGE_KEY));
                const resume = Math.max(status.current_step || 0, Number.isFinite(stored) ? stored : 0);
                setStep(Math.min(resume, STEPS.length - 1));
            } catch (err) {
                // Not a creator / no profile → bounce to dashboard.
                const msg = err instanceof Error ? err.message : 'Could not load onboarding';
                pushToast(msg);
                navigate(DASHBOARD_ROUTE, { replace: true });
            } finally {
                if (!cancelled) setBooting(false);
            }
        })();
        return () => { cancelled = true; };
    }, [navigate, pushToast]);

    // Persist the current step so a refresh restores position.
    useEffect(() => {
        if (!booting) localStorage.setItem(STEP_STORAGE_KEY, String(step));
    }, [step, booting]);

    const goTo = (next: number) => {
        setDirection(next > step ? 1 : -1);
        setStep(next);
    };

    // ─── Skip: do NOT mark complete; just leave ──────────────────────────────
    const handleSkip = () => {
        localStorage.removeItem(STEP_STORAGE_KEY);
        navigate(DASHBOARD_ROUTE, { replace: true });
    };

    // ─── Step handlers ───────────────────────────────────────────────────────
    const handleProfileNext = async () => {
        if (!USERNAME_RE.test(username)) { pushToast('Choose a valid username (3–50 lowercase letters, numbers, _)'); return; }
        if (usernameState === 'taken') { pushToast('That username is taken'); return; }
        if (usernameState === 'checking') { pushToast('Still checking that username…'); return; }
        if (!category) { pushToast('Please choose a category'); return; }
        if (bio.length > 500) { pushToast('Bio must be 500 characters or fewer'); return; }
        setSaving(true);
        try {
            await saveOnboardingProfile({ username, bio, category, languages });
            goTo(1);
        } catch (err) {
            pushToast(err instanceof Error ? err.message : 'Failed to save profile');
        } finally {
            setSaving(false);
        }
    };

    const handlePricingNext = async () => {
        const cleaned: PricingTierInput[] = [];
        for (const t of tiers) {
            if (!t.tier_name.trim()) { pushToast('Every tier needs a name'); return; }
            const price = Number(t.price);
            const days = Number(t.delivery_days);
            if (!(price >= 100)) { pushToast(`"${t.tier_name}" price must be at least ₹100`); return; }
            if (!(days >= 1 && days <= 30)) { pushToast(`"${t.tier_name}" delivery must be 1–30 days`); return; }
            if (t.description.length > 200) { pushToast('Description max 200 characters'); return; }
            cleaned.push({
                tier_name: t.tier_name.trim(),
                description: t.description.trim() || undefined,
                price,
                delivery_days: days,
            });
        }
        if (cleaned.length === 0) { pushToast('Add at least one pricing tier'); return; }
        setSaving(true);
        try {
            await saveOnboardingPricing(cleaned);
            goTo(2);
        } catch (err) {
            pushToast(err instanceof Error ? err.message : 'Failed to save pricing');
        } finally {
            setSaving(false);
        }
    };

    const handleAvailabilityNext = async () => {
        setSaving(true);
        try {
            await saveOnboardingAvailability(turnaround, acceptingBookings);
            goTo(3);
        } catch (err) {
            pushToast(err instanceof Error ? err.message : 'Failed to save availability');
        } finally {
            setSaving(false);
        }
    };

    const handleFinish = async () => {
        setSaving(true);
        try {
            await completeOnboarding();
            localStorage.removeItem(STEP_STORAGE_KEY);
            navigate(DASHBOARD_ROUTE, { replace: true });
        } catch (err) {
            pushToast(err instanceof Error ? err.message : 'Failed to complete onboarding');
            setSaving(false);
        }
    };

    // ─── Tier helpers ────────────────────────────────────────────────────────
    const addTier = () => setTiers((t) => (t.length < MAX_TIERS ? [...t, emptyTier()] : t));
    const removeTier = (i: number) => setTiers((t) => t.filter((_, idx) => idx !== i));
    const updateTier = (i: number, field: keyof Tier, value: string) =>
        setTiers((t) => t.map((tier, idx) => (idx === i ? { ...tier, [field]: value } : tier)));

    const toggleLanguage = (lang: string) =>
        setLanguages((l) => (l.includes(lang) ? l.filter((x) => x !== lang) : [...l, lang]));

    const creatorName = user?.displayName?.split(' ')[0] || 'there';

    if (booting) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-900">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-dark-900 flex flex-col">
            {/* Toasts */}
            <div className="fixed top-4 right-4 z-[200] space-y-2">
                <AnimatePresence>
                    {toasts.map((t) => (
                        <motion.div
                            key={t.id}
                            initial={{ opacity: 0, x: 40 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 40 }}
                            className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-600 text-white text-sm shadow-lg max-w-xs"
                        >
                            <X className="w-4 h-4 shrink-0" /> {t.message}
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Header + skip */}
            <header className="w-full max-w-3xl mx-auto px-4 sm:px-6 pt-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-500" />
                    <span className="font-semibold text-gray-900 dark:text-white">Creator Setup</span>
                </div>
                {step < 3 && (
                    <button
                        onClick={handleSkip}
                        className="text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition"
                    >
                        Skip for now
                    </button>
                )}
            </header>

            {/* Step indicator */}
            <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-6">
                <div className="flex items-center">
                    {STEPS.map((s, i) => {
                        const Icon = s.icon;
                        const done = i < step;
                        const active = i === step;
                        return (
                            <div key={s.label} className="flex items-center flex-1 last:flex-none">
                                <div className="flex flex-col items-center">
                                    <div
                                        className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-colors ${
                                            done
                                                ? 'bg-emerald-500 border-emerald-500 text-white'
                                                : active
                                                ? 'bg-purple-600 border-purple-600 text-white'
                                                : 'bg-white dark:bg-dark-800 border-gray-300 dark:border-dark-600 text-gray-400'
                                        }`}
                                    >
                                        {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                                    </div>
                                    <span className={`mt-1.5 text-xs font-medium hidden sm:block ${
                                        active ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400'
                                    }`}>
                                        {s.label}
                                    </span>
                                </div>
                                {i < STEPS.length - 1 && (
                                    <div className={`flex-1 h-0.5 mx-2 ${i < step ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-dark-700'}`} />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Step content */}
            <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 pb-10 overflow-hidden">
                <AnimatePresence mode="wait" custom={direction}>
                    <motion.div
                        key={step}
                        custom={direction}
                        initial={{ opacity: 0, x: direction * 60 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: direction * -60 }}
                        transition={{ duration: 0.25, ease: 'easeInOut' }}
                        className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-white/10 p-5 sm:p-7"
                    >
                        {step === 0 && (
                            <ProfileStep
                                username={username} setUsername={setUsername} usernameState={usernameState}
                                bio={bio} setBio={setBio}
                                category={category} setCategory={setCategory}
                                languages={languages} toggleLanguage={toggleLanguage}
                                saving={saving} onNext={handleProfileNext}
                            />
                        )}
                        {step === 1 && (
                            <PricingStep
                                tiers={tiers} addTier={addTier} removeTier={removeTier} updateTier={updateTier}
                                saving={saving} onNext={handlePricingNext} onBack={() => goTo(0)}
                            />
                        )}
                        {step === 2 && (
                            <AvailabilityStep
                                turnaround={turnaround} setTurnaround={setTurnaround}
                                acceptingBookings={acceptingBookings} setAcceptingBookings={setAcceptingBookings}
                                saving={saving} onNext={handleAvailabilityNext} onBack={() => goTo(1)}
                            />
                        )}
                        {step === 3 && (
                            <DoneStep name={creatorName} saving={saving} onFinish={handleFinish} />
                        )}
                    </motion.div>
                </AnimatePresence>
            </main>
        </div>
    );
}

// ─── Shared bits ─────────────────────────────────────────────────────────────
function NextButton({ saving, onClick, label = 'Next' }: { saving: boolean; onClick: () => void; label?: string }) {
    return (
        <button
            onClick={onClick}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white transition"
        >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {label}
        </button>
    );
}

function BackButton({ onClick }: { onClick: () => void }) {
    return (
        <button onClick={onClick} className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 transition">
            Back
        </button>
    );
}

const inputCls = 'w-full rounded-xl bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 px-3 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500';
const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5';

type UsernameState = 'idle' | 'invalid' | 'checking' | 'available' | 'taken';

// ─── Step 1: Profile ─────────────────────────────────────────────────────────
function ProfileStep(props: {
    username: string; setUsername: (v: string) => void; usernameState: UsernameState;
    bio: string; setBio: (v: string) => void;
    category: string; setCategory: (v: string) => void;
    languages: string[]; toggleLanguage: (l: string) => void;
    saving: boolean; onNext: () => void;
}) {
    const { username, setUsername, usernameState, bio, setBio, category, setCategory, languages, toggleLanguage, saving, onNext } = props;
    return (
        <div className="space-y-5">
            <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Tell fans about yourself</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">This appears on your public profile.</p>
            </div>

            <div>
                <label className={labelCls}>Bio</label>
                <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value.slice(0, 500))}
                    rows={4}
                    placeholder="A short intro — what you do, what fans can book you for…"
                    className={inputCls}
                />
                <p className={`mt-1 text-xs text-right ${bio.length > 500 ? 'text-red-500' : 'text-gray-400'}`}>
                    {bio.length}/500
                </p>
            </div>

            <div>
                <label className={labelCls}>Username</label>
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">@</span>
                    <input
                        type="text"
                        value={username}
                        // Force lowercase, strip anything outside the allowed charset as they type.
                        onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 50))}
                        placeholder="yourname"
                        className={`${inputCls} pl-7 pr-24`}
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium flex items-center gap-1">
                        {usernameState === 'checking' && <span className="text-gray-400 flex items-center gap-1"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking…</span>}
                        {usernameState === 'available' && <span className="text-emerald-600 dark:text-emerald-400">✓ Available</span>}
                        {usernameState === 'taken' && <span className="text-red-500">✗ Taken</span>}
                        {usernameState === 'invalid' && username.length > 0 && <span className="text-red-500">Invalid</span>}
                    </span>
                </div>
                <p className="mt-1 text-xs text-gray-400">3–50 characters · lowercase letters, numbers, underscores. This is your @handle.</p>
            </div>

            <div>
                <label className={labelCls}>Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
                    <option value="">Select a category…</option>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
            </div>

            <div>
                <label className={labelCls}>Languages</label>
                <div className="flex flex-wrap gap-2">
                    {LANGUAGES.map((lang) => {
                        const on = languages.includes(lang);
                        return (
                            <button
                                key={lang}
                                type="button"
                                onClick={() => toggleLanguage(lang)}
                                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                                    on
                                        ? 'bg-purple-600 border-purple-600 text-white'
                                        : 'bg-white dark:bg-dark-700 border-gray-300 dark:border-dark-600 text-gray-600 dark:text-gray-300 hover:border-purple-400'
                                }`}
                            >
                                {lang}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="flex justify-end pt-2">
                <NextButton saving={saving} onClick={onNext} />
            </div>
        </div>
    );
}

// ─── Step 2: Pricing ─────────────────────────────────────────────────────────
function PricingStep(props: {
    tiers: Tier[];
    addTier: () => void; removeTier: (i: number) => void;
    updateTier: (i: number, field: keyof Tier, value: string) => void;
    saving: boolean; onNext: () => void; onBack: () => void;
}) {
    const { tiers, addTier, removeTier, updateTier, saving, onNext, onBack } = props;
    return (
        <div className="space-y-5">
            <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Set your pricing</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Add up to {MAX_TIERS} booking tiers. At least one is required.</p>
            </div>

            <div className="space-y-4">
                {tiers.map((tier, i) => (
                    <div key={i} className="rounded-xl border border-gray-200 dark:border-dark-600 p-4 space-y-3 relative">
                        {tiers.length > 1 && (
                            <button
                                onClick={() => removeTier(i)}
                                className="absolute top-3 right-3 text-gray-400 hover:text-red-500 transition"
                                aria-label="Remove tier"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                        <div>
                            <label className={labelCls}>Tier name</label>
                            <input
                                type="text" value={tier.tier_name}
                                onChange={(e) => updateTier(i, 'tier_name', e.target.value)}
                                placeholder="e.g. Shoutout, Personalized Message, Live Call"
                                className={inputCls} maxLength={100}
                            />
                        </div>
                        <div>
                            <label className={labelCls}>Description <span className="text-gray-400 font-normal">(optional)</span></label>
                            <textarea
                                value={tier.description}
                                onChange={(e) => updateTier(i, 'description', e.target.value.slice(0, 200))}
                                rows={2} placeholder="What does this tier include?"
                                className={inputCls}
                            />
                            <p className="mt-1 text-xs text-right text-gray-400">{tier.description.length}/200</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={labelCls}>Price (₹)</label>
                                <div className="relative">
                                    <IndianRupee className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="number" min={100} value={tier.price}
                                        onChange={(e) => updateTier(i, 'price', e.target.value)}
                                        placeholder="100"
                                        className={`${inputCls} pl-9`}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className={labelCls}>Delivery (days)</label>
                                <input
                                    type="number" min={1} max={30} value={tier.delivery_days}
                                    onChange={(e) => updateTier(i, 'delivery_days', e.target.value)}
                                    className={inputCls}
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <button
                onClick={addTier}
                disabled={tiers.length >= MAX_TIERS}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-dashed border-gray-300 dark:border-dark-600 text-gray-600 dark:text-gray-300 hover:border-purple-400 disabled:opacity-50 disabled:cursor-not-allowed transition w-full justify-center"
            >
                <Plus className="w-4 h-4" /> Add tier {tiers.length >= MAX_TIERS && '(max reached)'}
            </button>

            <div className="flex justify-between pt-2">
                <BackButton onClick={onBack} />
                <NextButton saving={saving} onClick={onNext} />
            </div>
        </div>
    );
}

// ─── Step 3: Availability ────────────────────────────────────────────────────
function AvailabilityStep(props: {
    turnaround: number; setTurnaround: (v: number) => void;
    acceptingBookings: boolean; setAcceptingBookings: (v: boolean) => void;
    saving: boolean; onNext: () => void; onBack: () => void;
}) {
    const { turnaround, setTurnaround, acceptingBookings, setAcceptingBookings, saving, onNext, onBack } = props;
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Availability</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Set expectations for your fans.</p>
            </div>

            <div>
                <label className={labelCls}>Typical turnaround time</label>
                <select
                    value={turnaround}
                    onChange={(e) => setTurnaround(Number(e.target.value))}
                    className={inputCls}
                >
                    {TURNAROUND_OPTIONS.map((d) => (
                        <option key={d} value={d}>{d} {d === 1 ? 'day' : 'days'}</option>
                    ))}
                </select>
            </div>

            <div>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">Accepting bookings</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Turn off to pause new requests.</p>
                    </div>
                    <button
                        type="button"
                        role="switch"
                        aria-checked={acceptingBookings}
                        onClick={() => setAcceptingBookings(!acceptingBookings)}
                        className={`relative w-12 h-6 rounded-full transition-colors ${acceptingBookings ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-dark-600'}`}
                    >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${acceptingBookings ? 'translate-x-6' : ''}`} />
                    </button>
                </div>
                {!acceptingBookings && (
                    <p className="mt-3 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 rounded-xl px-3 py-2">
                        Fans won't be able to book you until you turn this on.
                    </p>
                )}
            </div>

            <div className="flex justify-between pt-2">
                <BackButton onClick={onBack} />
                <NextButton saving={saving} onClick={onNext} />
            </div>
        </div>
    );
}

// ─── Step 4: Done ────────────────────────────────────────────────────────────
function DoneStep({ name, saving, onFinish }: { name: string; saving: boolean; onFinish: () => void }) {
    return (
        <div className="flex flex-col items-center text-center py-6 space-y-5">
            <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 14 }}
                className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center"
            >
                <Check className="w-10 h-10 text-white" />
            </motion.div>
            <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">You're all set, {name}!</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Your profile is live.</p>
            </div>
            <button
                onClick={onFinish}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white transition"
            >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Go to Dashboard
            </button>
        </div>
    );
}
