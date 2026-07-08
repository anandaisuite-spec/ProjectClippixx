import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Shield, User, Mail, Phone, Edit3, Save, X, Copy, Check, Fingerprint,
    Trophy, Crown, Star, Award, ArrowRight, HelpCircle, Heart, Loader2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Profile } from '@/services/api';
import type {
    ProfileRoleConfig, NavKey, ActivityKey, AccountFieldKey,
} from './profileConfig';

// ─────────────────────────────────────────────────────────────────────────────
// Fixed-dark profile shell (matches the CreatorDashboard app-shell style).
// All styling uses UNPREFIXED dark utilities (bg-[#0d0f1a], text-white/60, …)
// so it renders identically in both app themes.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Prop contracts (data resolved by the page, rendered here) ───────────────

export type ResolvedStat = { label: string; icon: LucideIcon; value: React.ReactNode };
export type ResolvedActivity = {
    key: ActivityKey; icon: LucideIcon; title: string; cta: string;
    count: number; subtitle: string; onClick: () => void;
};
export type ResolvedAccountField = { key: AccountFieldKey; label: string; value: React.ReactNode; copyable?: boolean };
export type BadgeItem = { icon: LucideIcon; color: string; title: string; subtitle: string; meta: string };
export type QuickStat = { label: string; value: string };
export type ResolvedQuickLink = { label: string; icon: LucideIcon; onClick: () => void };

type EditForm = { first_name: string; last_name: string; phone: string; bio: string };

type ProfileLayoutProps = {
    profile: Profile;
    email: string;
    config: ProfileRoleConfig;
    roleLabel: string;              // e.g. "Admin", "Super Admin", "User"
    accountTypeLabel: string;       // the real account type badge: "Fan" | "Creator"
    stats: ResolvedStat[];
    activity: ResolvedActivity[];
    accountFields: ResolvedAccountField[];
    badges: BadgeItem[];
    activityLoading: boolean;
    /** Profile completion % (creators only) — renders a progress bar when set. */
    completion?: number | null;
    /** Right-column quick stats (creators: earnings / pending orders). */
    quickStats?: QuickStat[] | null;
    /** Right-column shortcuts (admin / super_admin). */
    quickLinks?: ResolvedQuickLink[] | null;
    // Edit state (owned by the page)
    isEditing: boolean;
    form: EditForm;
    saving: boolean;
    onEdit: () => void;
    onCancel: () => void;
    onSave: () => void;
    onFormChange: (patch: Partial<EditForm>) => void;
    onNav: (key: NavKey) => void;
    onContactSupport: () => void;
};

const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

const CARD = 'rounded-2xl bg-white/[0.03] border border-purple-500/15 backdrop-blur-md';

export default function ProfileLayout(props: ProfileLayoutProps) {
    const {
        profile, email, config, roleLabel, accountTypeLabel, stats, activity,
        accountFields, badges, activityLoading, completion, quickStats, quickLinks,
        isEditing, form, saving, onEdit, onCancel, onSave, onFormChange,
        onNav, onContactSupport,
    } = props;

    const [active, setActive] = useState<NavKey>('overview');
    const [copied, setCopied] = useState(false);

    const displayName = `${profile.first_name} ${profile.last_name}`.trim();
    const initial = (form.first_name?.[0] || profile.first_name?.[0] || 'U').toUpperCase();

    const handleNav = (key: NavKey) => { setActive(key); onNav(key); };
    const copyId = async () => {
        try { await navigator.clipboard.writeText(profile.id); setCopied(true); setTimeout(() => setCopied(false), 2000); }
        catch { /* clipboard unavailable */ }
    };

    return (
        <div className="min-h-screen bg-[#0d0f1a] text-white pt-20 pb-10">
            <div className="max-w-7xl mx-auto px-4">
                <div className="flex gap-5">

                    {/* ── Sidebar (220px, sticky) ─────────────────────────── */}
                    <aside className="hidden lg:block w-[220px] shrink-0">
                        <div className="sticky top-24 rounded-2xl bg-[#12142a] border border-white/5 p-4 flex flex-col min-h-[calc(100vh-8.5rem)]">
                            {/* Brand */}
                            <div className="flex items-center gap-2.5 px-1 pb-4 border-b border-white/5">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-950/40">
                                    <span className="text-base font-bold">C</span>
                                </div>
                                <span className="text-lg font-bold">Clippixx</span>
                            </div>

                            {/* Nav */}
                            <nav className="py-3 space-y-1 flex-1">
                                {config.nav.map((item) => {
                                    const Icon = item.icon;
                                    const isActive = active === item.key;
                                    return (
                                        <button
                                            key={item.key}
                                            onClick={() => handleNav(item.key)}
                                            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                                                isActive
                                                    ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-950/40'
                                                    : 'text-white/50 hover:text-white hover:bg-white/5'
                                            }`}
                                        >
                                            <Icon className="w-4 h-4 shrink-0" />
                                            {item.label}
                                        </button>
                                    );
                                })}
                            </nav>

                            {/* Need Help */}
                            <button
                                onClick={onContactSupport}
                                className="mt-3 rounded-xl border border-white/5 bg-white/[0.03] p-3.5 text-left hover:bg-white/5 transition-colors"
                            >
                                <p className="flex items-center justify-between text-sm font-semibold">
                                    Need Help? <HelpCircle className="w-4 h-4 text-violet-300" />
                                </p>
                                <p className="text-xs text-white/40 mt-0.5">Contact Support</p>
                            </button>
                        </div>
                    </aside>

                    {/* ── Main ────────────────────────────────────────────── */}
                    <main className="flex-1 min-w-0 space-y-5">

                        {/* Mobile nav pills */}
                        <div className="lg:hidden flex gap-2 overflow-x-auto pb-1">
                            {config.nav.map((item) => (
                                <button
                                    key={item.key}
                                    onClick={() => handleNav(item.key)}
                                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                                        active === item.key ? 'bg-violet-600 text-white' : 'bg-white/5 text-white/50'
                                    }`}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>

                        {/* ── Header card ─────────────────────────────────── */}
                        <div className={`${CARD} relative overflow-hidden`}>
                            {/* Gradient banner */}
                            <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-r from-violet-700/40 via-purple-600/25 to-indigo-700/40" />
                            <div className="relative p-5 sm:p-6">
                                <div className="flex flex-wrap items-start gap-4">
                                    {/* Avatar 80px — uploaded image, or initials fallback */}
                                    <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gradient-to-br from-violet-500 to-indigo-600 border border-white/20 shadow-xl shadow-violet-950/50 flex items-center justify-center shrink-0">
                                        {profile.avatar_url
                                            ? <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                                            : <span className="text-4xl font-bold">{initial}</span>}
                                    </div>

                                    <div className="flex-1 min-w-0 pt-1">
                                        <div className="flex flex-wrap items-center gap-2.5">
                                            <h1 className="text-2xl sm:text-3xl font-bold truncate">{displayName || 'User'}</h1>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 mt-2">
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/20">
                                                <Shield className="w-3 h-3" /> {roleLabel}
                                            </span>
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-violet-500/15 text-violet-300 border border-violet-500/20">
                                                <User className="w-3 h-3" /> {accountTypeLabel}
                                            </span>
                                        </div>
                                        <p className="mt-2.5 text-sm text-white/60 max-w-2xl">
                                            {profile.bio || <span className="italic text-white/35">No bio yet.</span>}
                                        </p>
                                    </div>

                                    <button
                                        onClick={onEdit}
                                        className="shrink-0 w-full sm:w-auto justify-center min-h-[44px] flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-violet-500/30 hover:bg-violet-600 hover:border-violet-500 text-sm font-medium transition-colors"
                                    >
                                        <Edit3 className="w-4 h-4" /> Edit Profile
                                    </button>
                                </div>

                                {/* Stat tiles */}
                                <div className="mt-6 grid grid-cols-2 xl:grid-cols-4 gap-3">
                                    {stats.map((s) => (
                                        <div key={s.label} className="rounded-xl bg-white/[0.04] border border-white/10 p-3.5 flex items-start gap-3">
                                            <span className="w-8 h-8 shrink-0 rounded-lg bg-violet-500/15 border border-violet-500/20 flex items-center justify-center">
                                                <s.icon className="w-4 h-4 text-violet-300" />
                                            </span>
                                            <div className="min-w-0">
                                                <p className="text-[11px] text-white/40">{s.label}</p>
                                                <p className="text-sm font-semibold truncate">{s.value}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Creator profile-completion bar */}
                                {completion != null && (
                                    <div className="mt-4">
                                        <div className="flex items-center justify-between text-xs mb-1.5">
                                            <span className="text-white/50">Profile completion</span>
                                            <span className="font-semibold text-violet-300">{completion}%</span>
                                        </div>
                                        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                                            <div
                                                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all"
                                                style={{ width: `${completion}%` }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── Main grid: 60 / 40 ──────────────────────────── */}
                        <div className="grid gap-5 lg:grid-cols-[3fr_2fr] items-start">

                            {/* LEFT (60%) */}
                            <div className="space-y-5 min-w-0">
                                <Card title="About Me" icon={User}>
                                    <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">
                                        {profile.bio || (
                                            <span className="italic text-white/35">No bio yet. Click "Edit Profile" to add one.</span>
                                        )}
                                    </p>
                                </Card>

                                <Card title="Contact Information" icon={Mail}>
                                    <div className="space-y-4">
                                        <ContactRow icon={Mail} label="Email" value={email || profile.email} />
                                        <ContactRow
                                            icon={Phone} label="Phone"
                                            value={profile.phone || <span className="text-white/35">Not set</span>}
                                        />
                                    </div>
                                </Card>

                                <Card title="Badges" icon={Trophy} iconColor="text-amber-300" iconBg="bg-amber-500/15 border-amber-500/20">
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        {badges.map((b) => (
                                            <div key={b.title} className="rounded-xl bg-white/[0.04] border border-white/10 p-3.5 flex flex-col items-center text-center gap-1">
                                                <b.icon className={`w-6 h-6 ${b.color}`} />
                                                <span className="text-sm font-semibold">{b.title}</span>
                                                <span className="text-[11px] text-white/40">{b.subtitle}</span>
                                                <span className="text-[10px] text-white/30">{b.meta}</span>
                                            </div>
                                        ))}
                                    </div>
                                </Card>

                                <Card title="Your Activity" icon={Star} iconColor="text-sky-300" iconBg="bg-sky-500/15 border-sky-500/20">
                                    {activityLoading ? (
                                        <div className="py-8 flex items-center justify-center">
                                            <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
                                        </div>
                                    ) : (
                                        <div className="space-y-2.5">
                                            {activity.map((a) => (
                                                <div key={a.key} className="flex items-center gap-3 rounded-xl bg-white/[0.04] border border-white/10 p-3.5">
                                                    <div className="w-10 h-10 shrink-0 rounded-lg bg-violet-500/15 border border-violet-500/20 flex items-center justify-center">
                                                        <a.icon className="w-5 h-5 text-violet-300" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-semibold">
                                                            {a.title}
                                                            {a.count > 0 && (
                                                                <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-violet-500/20 text-violet-300">{a.count}</span>
                                                            )}
                                                        </p>
                                                        <p className="text-xs text-white/40 italic truncate">{a.subtitle}</p>
                                                    </div>
                                                    <button
                                                        onClick={a.onClick}
                                                        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-semibold transition-colors"
                                                    >
                                                        {a.cta} <ArrowRight className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </Card>
                            </div>

                            {/* RIGHT (40%) */}
                            <div className="space-y-5 min-w-0">
                                <Card title="Account Details" icon={Shield}>
                                    <div className="space-y-4">
                                        {accountFields.map((f) => (
                                            <div key={f.key} className="flex items-center justify-between gap-3">
                                                <span className="flex items-center gap-2 text-sm text-white/45 shrink-0">
                                                    {f.key === 'id' ? <Fingerprint className="w-4 h-4" /> : <User className="w-4 h-4" />}
                                                    {f.label}
                                                </span>
                                                {f.copyable ? (
                                                    <button
                                                        onClick={copyId}
                                                        title="Copy"
                                                        className="flex items-center gap-1.5 text-xs font-mono text-white/70 hover:text-violet-300 transition-colors min-w-0"
                                                    >
                                                        <span className="truncate">{f.value}</span>
                                                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <Copy className="w-3.5 h-3.5 shrink-0" />}
                                                    </button>
                                                ) : (
                                                    <span className="text-sm font-medium truncate">{f.value}</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </Card>

                                {/* Creator quick stats */}
                                {quickStats && quickStats.length > 0 && (
                                    <Card title="Quick Stats" icon={Star} iconColor="text-emerald-300" iconBg="bg-emerald-500/15 border-emerald-500/20">
                                        <div className="grid grid-cols-2 gap-3">
                                            {quickStats.map((q) => (
                                                <div key={q.label} className="rounded-xl bg-white/[0.04] border border-white/10 p-3.5">
                                                    <p className="text-[11px] text-white/40">{q.label}</p>
                                                    <p className="text-lg font-bold truncate">{q.value}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </Card>
                                )}

                                {/* Admin quick links */}
                                {quickLinks && quickLinks.length > 0 && (
                                    <Card title="Shortcuts" icon={Shield} iconColor="text-blue-300" iconBg="bg-blue-500/15 border-blue-500/20">
                                        <div className="space-y-2">
                                            {quickLinks.map((l) => (
                                                <button
                                                    key={l.label}
                                                    onClick={l.onClick}
                                                    className="w-full flex items-center gap-3 rounded-xl bg-white/[0.04] border border-white/10 hover:border-violet-500/30 p-3 text-sm font-medium transition-colors"
                                                >
                                                    <l.icon className="w-4 h-4 text-violet-300" />
                                                    {l.label}
                                                    <ArrowRight className="w-3.5 h-3.5 text-white/25 ml-auto" />
                                                </button>
                                            ))}
                                        </div>
                                    </Card>
                                )}

                                {/* Motivational banner */}
                                <div className="rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-700/25 via-purple-800/15 to-indigo-900/25 p-6 text-center">
                                    <div className="w-14 h-14 mx-auto rounded-2xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center mb-3">
                                        <Crown className="w-7 h-7 text-violet-300" />
                                    </div>
                                    <p className="text-base font-bold">Your journey matters!</p>
                                    <p className="text-sm text-white/50 mt-1">Keep exploring, keep creating! ✨</p>
                                </div>
                            </div>
                        </div>

                        {/* ── Bottom tagline strip ────────────────────────── */}
                        <div className={`${CARD} p-4 flex items-center gap-3.5`}>
                            <div className="w-10 h-10 shrink-0 rounded-full bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
                                <Heart className="w-5 h-5 text-violet-300" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold">Every great creator started somewhere.</p>
                                <p className="text-xs text-white/45">Keep exploring, keep creating! ✨</p>
                            </div>
                        </div>
                    </main>
                </div>
            </div>

            {/* ── Edit Profile modal ──────────────────────────────────────── */}
            <AnimatePresence>
                {isEditing && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[130] flex items-center justify-center p-4"
                    >
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !saving && onCancel()} />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 16 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 16 }}
                            className="relative w-full max-w-lg rounded-2xl bg-[#12142a] border border-purple-500/20 shadow-2xl shadow-black/60 p-6"
                        >
                            <div className="flex items-center justify-between mb-5">
                                <h2 className="text-lg font-bold flex items-center gap-2">
                                    <Edit3 className="w-4 h-4 text-violet-300" /> Edit Profile
                                </h2>
                                <button
                                    onClick={() => !saving && onCancel()}
                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                                    aria-label="Close"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="grid sm:grid-cols-2 gap-3">
                                    <FieldInput label="First name" value={form.first_name} onChange={(v) => onFormChange({ first_name: v })} />
                                    <FieldInput label="Last name" value={form.last_name} onChange={(v) => onFormChange({ last_name: v })} />
                                </div>
                                <FieldInput label="Phone" type="tel" value={form.phone} onChange={(v) => onFormChange({ phone: v })} placeholder="Optional" />
                                <div>
                                    <label className="block text-xs text-white/45 mb-1.5">Bio</label>
                                    <textarea
                                        value={form.bio}
                                        onChange={(e) => onFormChange({ bio: e.target.value })}
                                        rows={4}
                                        maxLength={2000}
                                        placeholder="Tell us about yourself..."
                                        className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 resize-none placeholder:text-white/25"
                                    />
                                    <p className="text-[11px] text-white/30 mt-1 text-right">{form.bio.length}/2000</p>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 mt-6">
                                <button
                                    onClick={onCancel}
                                    disabled={saving}
                                    className="px-4 py-2 rounded-xl text-sm font-medium text-white/60 hover:bg-white/5 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={onSave}
                                    disabled={saving}
                                    className="flex items-center gap-2 px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-sm font-semibold transition-colors"
                                >
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    {saving ? 'Saving…' : 'Save'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── Building blocks ─────────────────────────────────────────────────────────

function Card({ title, icon: Icon, iconColor = 'text-violet-300', iconBg = 'bg-violet-500/15 border-violet-500/20', children }: {
    title: string; icon: LucideIcon; iconColor?: string; iconBg?: string;
    children: React.ReactNode;
}) {
    return (
        <div className={`${CARD} p-5`}>
            <h2 className="flex items-center gap-2.5 text-base font-semibold mb-4">
                <span className={`w-8 h-8 rounded-lg border flex items-center justify-center ${iconBg}`}>
                    <Icon className={`w-4 h-4 ${iconColor}`} />
                </span>
                {title}
            </h2>
            {children}
        </div>
    );
}

function ContactRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-center gap-3">
            <div className="w-9 h-9 shrink-0 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center text-violet-300">
                <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
                <p className="text-[11px] text-white/40">{label}</p>
                <div className="text-sm font-medium break-words">{value}</div>
            </div>
        </div>
    );
}

function FieldInput({ label, value, onChange, type = 'text', placeholder }: {
    label: string; value: string; onChange: (v: string) => void;
    type?: string; placeholder?: string;
}) {
    return (
        <div>
            <label className="block text-xs text-white/45 mb-1.5">{label}</label>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 placeholder:text-white/25"
            />
        </div>
    );
}

// Badge presets so the page can build role badge lists concisely.
export const BADGE_PRESETS = {
    earlyUser: (meta: string): BadgeItem => ({ icon: Crown, color: 'text-violet-300', title: 'Early User', subtitle: 'Joined early', meta }),
    active: (meta: string): BadgeItem => ({ icon: Star, color: 'text-amber-300', title: 'Active Member', subtitle: 'Very active', meta }),
    creator: (): BadgeItem => ({ icon: Award, color: 'text-emerald-300', title: 'Creator', subtitle: 'Verified type', meta: 'Account' }),
};

export { formatDate };
