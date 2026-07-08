import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyProfile, updateProfile, uploadProfileAvatar } from "@/services/api";
import type { Profile } from "@/services/api";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { updateMyProfileCache } from "@/hooks/useMyProfile";
import { invalidateRoleClientCache } from "@/hooks/useRole";
import {
    ArrowLeft, User, Shield, Link2, SlidersHorizontal, Lock, AlertTriangle,
    Loader2, ExternalLink, Calendar, ChevronRight, KeyRound, Smartphone,
    MonitorSmartphone, Globe, Clock, Eye, Activity, MessageSquare, Check, Sun, Moon,
    Camera,
} from 'lucide-react';

const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

const SECTIONS = [
    { id: 'profile',    label: 'Profile Information', icon: User },
    { id: 'security',   label: 'Security',            icon: Shield },
    { id: 'connected',  label: 'Connected Accounts',  icon: Link2 },
    { id: 'preferences',label: 'Preferences',         icon: SlidersHorizontal },
    { id: 'privacy',    label: 'Privacy',             icon: Lock },
    { id: 'danger',     label: 'Danger Zone',         icon: AlertTriangle },
] as const;

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function AccountSettings() {
    const { user } = useAuth();
    const { isDark, setTheme } = useTheme();
    const navigate = useNavigate();

    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [activeSection, setActiveSection] = useState<typeof SECTIONS[number]['id']>('profile');

    const [form, setForm] = useState({
        full_name: '',
        bio: '',
        location: '',
        username: '',
        website: '',
        avatar_url: '',
    });

    const loadProfile = useCallback(() => {
        setLoading(true);
        setError(null);
        let cancelled = false;

        getMyProfile()
            .then((p) => {
                if (cancelled) return;
                setProfile(p);
                setForm({
                    full_name: `${p.first_name} ${p.last_name}`.trim(),
                    bio: p.bio || '',
                    location: '',
                    username: (p.email?.split('@')[0]) || '',
                    website: '',
                    avatar_url: p.avatar_url || '',
                });
            })
            .catch((err: Error) => { if (!cancelled) setError(err.message); })
            .finally(() => { if (!cancelled) setLoading(false); });

        return () => { cancelled = true; };
    }, []);

    useEffect(() => { loadProfile(); }, [loadProfile]);

    // ── Avatar upload (Cloudflare R2 via POST /profiles/me/avatar) ────────────
    const [avatarUploading, setAvatarUploading] = useState(false);
    const [toast, setToast] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const showToast = (m: string) => {
        setToast(m);
        setTimeout(() => setToast(null), 3500);
    };

    const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = ''; // allow re-selecting the same file later
        if (!file) return;
        if (!AVATAR_TYPES.includes(file.type)) {
            showToast('Only JPG, PNG or WEBP images are allowed.');
            return;
        }
        if (file.size > AVATAR_MAX_BYTES) {
            showToast('Image must be under 5MB.');
            return;
        }
        setAvatarUploading(true);
        try {
            const { url } = await uploadProfileAvatar(file);
            // Local state — this page updates instantly.
            setForm((f) => ({ ...f, avatar_url: url }));
            setProfile((p) => (p ? { ...p, avatar_url: url } : p));
            // Global state — navbar/sidebar/profile subscribers update instantly,
            // and the role/profile cache refetches fresh next time it's read.
            updateMyProfileCache({ avatar_url: url });
            if (user) invalidateRoleClientCache(user.uid);
        } catch (err) {
            showToast(err instanceof Error ? err.message : 'Upload failed. Please try again.');
        } finally {
            setAvatarUploading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setSaveSuccess(false);
        setError(null);
        try {
            const [first_name, ...rest] = form.full_name.trim().split(' ');
            const last_name = rest.join(' ');
            const updated = await updateProfile({
                first_name: first_name || undefined,
                last_name: last_name || first_name || undefined,
                bio: form.bio || undefined,
                avatar_url: form.avatar_url || undefined,
            });
            setProfile(updated);
            updateMyProfileCache(updated); // keep navbar/sidebar name+avatar in sync
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to save changes');
        } finally {
            setSaving(false);
        }
    };

    // Which third-party providers are linked on the Firebase account
    const linkedProviders = new Set((user?.providerData ?? []).map((p) => p.providerId));
    const isConnected = (id: string) => linkedProviders.has(id);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (error && !profile) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8">
                <p className="text-red-500">{error}</p>
                <button onClick={loadProfile} className="text-purple-600 dark:text-purple-400 hover:underline text-sm">Try Again</button>
            </div>
        );
    }

    if (!profile) return null;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-dark-950 pt-24 pb-16 px-4 sm:px-6">
            {/* Transient error toast (avatar upload) */}
            {toast && (
                <div className="fixed top-20 right-4 z-[150] px-4 py-3 rounded-xl bg-red-600 text-white text-sm shadow-lg">
                    {toast}
                </div>
            )}

            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-start gap-3 mb-8">
                    <button
                        onClick={() => navigate(-1)}
                        className="mt-1 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                        aria-label="Back"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Account Settings</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Manage your account preferences and settings</p>
                    </div>
                </div>

                {/* Status messages */}
                {saveSuccess && (
                    <div className="mb-6 p-3 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 text-green-700 dark:text-green-400 rounded-xl text-sm">
                        Changes saved successfully!
                    </div>
                )}
                {error && (
                    <div className="mb-6 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 rounded-xl text-sm">
                        {error}
                    </div>
                )}

                <div className="grid lg:grid-cols-[220px_1fr] gap-6">
                    {/* Sidebar nav */}
                    <nav className="space-y-1">
                        {SECTIONS.map((s) => {
                            const active = activeSection === s.id;
                            return (
                                <button
                                    key={s.id}
                                    onClick={() => {
                                        setActiveSection(s.id);
                                        document.getElementById(`section-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                    }}
                                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                                        active
                                            ? 'bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30'
                                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'
                                    } ${s.id === 'danger' ? 'text-red-600 dark:text-red-400' : ''}`}
                                >
                                    <s.icon className="w-4 h-4" />
                                    {s.label}
                                </button>
                            );
                        })}
                    </nav>

                    {/* Content */}
                    <div className="space-y-6">

                        {/* ── Profile Information ─────────────────────────── */}
                        <Section id="section-profile" title="Profile Information" subtitle="Update your personal preferences and how others see you."
                            action={
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                                >
                                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {saving ? 'Saving...' : 'Save Changes'}
                                </button>
                            }
                        >
                            <div className="grid sm:grid-cols-[auto_1fr_1fr] gap-6">
                                {/* Profile picture — uploaded image, or initials fallback */}
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Profile Picture</p>
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={avatarUploading}
                                        aria-label="Change profile picture"
                                        className="relative group w-24 h-24 rounded-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:focus:ring-offset-dark-950"
                                    >
                                        {form.avatar_url ? (
                                            <img src={form.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-4xl font-bold text-white">
                                                {(form.full_name[0] || 'U').toUpperCase()}
                                            </div>
                                        )}
                                        {/* Hover overlay / uploading spinner */}
                                        <div className={`absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity duration-200 ${
                                            avatarUploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                                        }`}>
                                            {avatarUploading
                                                ? <Loader2 className="w-6 h-6 text-white animate-spin" />
                                                : <Camera className="w-6 h-6 text-white" />}
                                        </div>
                                    </button>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        className="hidden"
                                        onChange={handleAvatarFile}
                                    />
                                </div>

                                {/* Left fields */}
                                <div className="space-y-4">
                                    <Input label="Full Name" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
                                    <TextArea label="Bio" value={form.bio} onChange={(v) => setForm({ ...form, bio: v })} />
                                    <Input label="Location" value={form.location} onChange={(v) => setForm({ ...form, location: v })} placeholder="e.g. India" />
                                </div>

                                {/* Right fields */}
                                <div className="space-y-4">
                                    <Input label="Username" value={form.username} onChange={(v) => setForm({ ...form, username: v })} />
                                    <div>
                                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5">Profile URL</label>
                                        <a
                                            href={`/profile/${profile.id}`}
                                            className="inline-flex items-center gap-1 text-sm text-purple-600 dark:text-purple-400 hover:underline"
                                        >
                                            clippixx.com/{form.username || 'you'}
                                            <ExternalLink className="w-3.5 h-3.5" />
                                        </a>
                                    </div>
                                    <Input label="Website" value={form.website} onChange={(v) => setForm({ ...form, website: v })} placeholder="https://" />
                                    <div>
                                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5">Joined</label>
                                        <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                            <Calendar className="w-4 h-4 text-gray-400" />
                                            {formatDate(profile.created_at)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <p className="mt-4 text-xs text-gray-400">
                                Note: Full Name, Bio and Photo are saved to your profile. Username, Location and Website are display-only for now.
                            </p>
                        </Section>

                        {/* ── Security ────────────────────────────────────── */}
                        <Section id="section-security" title="Security" subtitle="Keep your account secure.">
                            <div className="space-y-2">
                                <Row icon={<KeyRound className="w-4 h-4" />} title="Password" value="••••••••••" actionLabel="Change" />
                                <Row icon={<Smartphone className="w-4 h-4" />} title="Two-Factor Authentication" value="Not enabled" actionLabel="Enable" />
                                <Row icon={<MonitorSmartphone className="w-4 h-4" />} title="Active Sessions" value="1 active session" actionLabel="Manage" />
                            </div>
                        </Section>

                        {/* ── Connected Accounts ──────────────────────────── */}
                        <Section id="section-connected" title="Connected Accounts" subtitle="Manage your connected third-party accounts.">
                            <div className="grid sm:grid-cols-3 gap-3">
                                <ProviderCard name="Google"  connected={isConnected('google.com')} />
                                <ProviderCard name="Facebook" connected={isConnected('facebook.com')} />
                                <ProviderCard name="Microsoft" connected={isConnected('microsoft.com')} />
                            </div>
                        </Section>

                        {/* ── Preferences + Privacy (two cards) ───────────── */}
                        <div className="grid md:grid-cols-2 gap-6">
                            <Section id="section-preferences" title="Preferences" subtitle="Customize your experience.">
                                <div className="space-y-1">
                                    <button
                                        onClick={() => setTheme(isDark ? 'light' : 'dark')}
                                        className="w-full flex items-center justify-between py-3 group"
                                    >
                                        <span className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
                                            {isDark ? <Moon className="w-4 h-4 text-gray-400" /> : <Sun className="w-4 h-4 text-gray-400" />}
                                            Theme
                                        </span>
                                        <span className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 group-hover:text-purple-500">
                                            {isDark ? 'Dark' : 'Light'} <ChevronRight className="w-4 h-4" />
                                        </span>
                                    </button>
                                    <SelectRow icon={<Globe className="w-4 h-4 text-gray-400" />} label="Language" value="English" />
                                    <SelectRow icon={<Clock className="w-4 h-4 text-gray-400" />} label="Timezone" value="Asia/Kolkata (GMT+5:30)" />
                                </div>
                            </Section>

                            <Section id="section-privacy" title="Privacy" subtitle="Manage your privacy settings.">
                                <div className="space-y-1">
                                    <SelectRow icon={<Eye className="w-4 h-4 text-gray-400" />} label="Profile Visibility" value="Public" />
                                    <SelectRow icon={<Activity className="w-4 h-4 text-gray-400" />} label="Show Activity" value="Everyone" />
                                    <SelectRow icon={<MessageSquare className="w-4 h-4 text-gray-400" />} label="Allow Messages" value="From anyone" />
                                </div>
                            </Section>
                        </div>

                        {/* ── Danger Zone ─────────────────────────────────── */}
                        <div id="section-danger" className="rounded-3xl border border-red-200 dark:border-red-500/30 bg-red-50/50 dark:bg-red-500/5 p-6">
                            <div className="flex items-center justify-between gap-4 flex-wrap">
                                <div>
                                    <h2 className="text-base font-semibold text-red-600 dark:text-red-400">Danger Zone</h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Permanently delete your account and all data.</p>
                                </div>
                                <button
                                    onClick={() => alert('Account deletion is not available yet. Please contact support.')}
                                    className="px-4 py-2 rounded-lg border border-red-300 dark:border-red-500/50 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/10 text-sm font-medium transition-colors"
                                >
                                    Delete Account
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Reusable pieces ─────────────────────────────────────────────────────────

function Section({
    id, title, subtitle, action, children,
}: {
    id: string; title: string; subtitle: string; action?: React.ReactNode; children: React.ReactNode;
}) {
    return (
        <div id={id} className="rounded-3xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d1230] p-6 scroll-mt-28">
            <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
                </div>
                {action}
            </div>
            {children}
        </div>
    );
}

function Input({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
    return (
        <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5">{label}</label>
            <input
                type="text"
                value={value}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value)}
                className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
            />
        </div>
    );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    return (
        <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5">{label}</label>
            <textarea
                value={value}
                rows={3}
                maxLength={2000}
                onChange={(e) => onChange(e.target.value)}
                className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            />
        </div>
    );
}

function Row({ icon, title, value, actionLabel }: { icon: React.ReactNode; title: string; value: string; actionLabel: string }) {
    return (
        <div className="flex items-center gap-3 py-3 border-b border-gray-100 dark:border-white/5 last:border-0">
            <div className="w-9 h-9 shrink-0 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-500 dark:text-gray-400">
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{title}</p>
            </div>
            <span className="text-sm text-gray-400 hidden sm:block">{value}</span>
            <button
                onClick={() => alert(`${actionLabel}: coming soon.`)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-500/30 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition"
            >
                {actionLabel}
                <ChevronRight className="w-4 h-4" />
            </button>
        </div>
    );
}

function ProviderCard({ name, connected }: { name: string; connected: boolean }) {
    return (
        <button
            onClick={() => alert(`${name}: account linking coming soon.`)}
            className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-4 hover:border-purple-300 dark:hover:border-purple-500/40 transition text-left"
        >
            <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-white dark:bg-white/10 flex items-center justify-center text-sm font-bold text-gray-700 dark:text-gray-200">
                    {name[0]}
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{name}</p>
                    <p className={`text-xs flex items-center gap-1 ${connected ? 'text-emerald-500 dark:text-emerald-400' : 'text-gray-400'}`}>
                        {connected && <Check className="w-3 h-3" />}
                        {connected ? 'Connected' : 'Not connected'}
                    </p>
                </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
        </button>
    );
}

function SelectRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <button
            onClick={() => alert(`${label}: coming soon.`)}
            className="w-full flex items-center justify-between py-3 group"
        >
            <span className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">{icon}{label}</span>
            <span className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 group-hover:text-purple-500">
                {value} <ChevronRight className="w-4 h-4" />
            </span>
        </button>
    );
}
