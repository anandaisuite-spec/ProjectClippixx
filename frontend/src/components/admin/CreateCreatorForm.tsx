import { useState } from 'react';
import { Eye, EyeOff, Copy, Check, UserPlus, Video } from 'lucide-react';
import { adminCreateCreator, type AdminCreateCreatorData } from "@/services/api";

type Category = AdminCreateCreatorData['category'];
const CATEGORIES: Category[] = ['Actor', 'Athlete', 'Creator', 'Musician'];

const EMPTY_FORM = {
    first_name: '',
    last_name: '',
    username: '',
    password: '',
    star_name: '',
    category: 'Creator' as Category,
    price: 100,
    image_url: '',
};

type Props = {
    /** Called after a successful creation, e.g. to refresh a list. */
    onCreated?: () => void;
};

/**
 * Shared admin tool: create a creator account from a username + password (no
 * real email collected). Used by both the Admin and Super Admin dashboards.
 * On success it shows the username + password for hand-off with copy buttons.
 */
export default function CreateCreatorForm({ onCreated }: Props) {
    const [form, setForm] = useState(EMPTY_FORM);
    const [showPassword, setShowPassword] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [usernameError, setUsernameError] = useState('');
    const [created, setCreated] = useState<{ username: string; password: string } | null>(null);
    const [copied, setCopied] = useState<'username' | 'password' | null>(null);

    const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
        setForm((f) => ({ ...f, [key]: value }));
    };

    const copy = async (field: 'username' | 'password', value: string) => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(field);
            setTimeout(() => setCopied(null), 1500);
        } catch {
            /* clipboard may be unavailable; ignore */
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setUsernameError('');
        setSubmitting(true);
        try {
            const payload: AdminCreateCreatorData = {
                ...form,
                username: form.username.trim().toLowerCase(),
                price: Number(form.price),
                image_url: form.image_url.trim() || undefined,
            };
            await adminCreateCreator(payload);
            setCreated({ username: payload.username, password: form.password });
            onCreated?.();
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to create creator';
            // 409 from the backend comes through as the "username taken" message.
            if (/username is already taken/i.test(msg)) {
                setUsernameError(msg);
            } else {
                setError(msg);
            }
        } finally {
            setSubmitting(false);
        }
    };

    const resetForNext = () => {
        setForm(EMPTY_FORM);
        setCreated(null);
        setError('');
        setUsernameError('');
        setShowPassword(false);
    };

    // ── Success / hand-off panel ──────────────────────────────────────────
    if (created) {
        return (
            <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                    <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div>
                        <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Account created</p>
                        <p className="text-xs text-emerald-600 dark:text-emerald-400">Give the creator this username and password — that's all they need to log in.</p>
                    </div>
                </div>

                {(['username', 'password'] as const).map((field) => {
                    const value = created[field];
                    return (
                        <div key={field}>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 capitalize">{field}</label>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 px-3 py-2 rounded-lg bg-gray-100 dark:bg-dark-700 text-sm font-mono text-gray-900 dark:text-white break-all">
                                    {value}
                                </code>
                                <button
                                    type="button"
                                    onClick={() => copy(field, value)}
                                    className="shrink-0 p-2 rounded-lg border border-gray-200 dark:border-dark-600 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                                    title={`Copy ${field}`}
                                >
                                    {copied === field
                                        ? <Check className="w-4 h-4 text-emerald-500" />
                                        : <Copy className="w-4 h-4 text-gray-500" />}
                                </button>
                            </div>
                        </div>
                    );
                })}

                <button
                    type="button"
                    onClick={resetForNext}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium transition-colors"
                >
                    <UserPlus className="w-4 h-4" /> Create another creator
                </button>
            </div>
        );
    }

    // ── Form ──────────────────────────────────────────────────────────────
    const inputClass = 'w-full rounded-lg border border-gray-300 dark:border-dark-600 p-2 text-sm dark:bg-dark-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40';

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-sm text-red-600 dark:text-red-400">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First Name</label>
                    <input required type="text" value={form.first_name} onChange={(e) => update('first_name', e.target.value)} className={inputClass} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Name</label>
                    <input required type="text" value={form.last_name} onChange={(e) => update('last_name', e.target.value)} className={inputClass} />
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
                <input
                    required
                    type="text"
                    value={form.username}
                    onChange={(e) => { update('username', e.target.value.toLowerCase()); setUsernameError(''); }}
                    placeholder="e.g. alex_sterling"
                    className={`${inputClass} ${usernameError ? 'border-red-400 dark:border-red-500/60' : ''}`}
                />
                {usernameError
                    ? <p className="text-xs text-red-500 mt-1">{usernameError}</p>
                    : <p className="text-xs text-gray-500 mt-1">3-30 chars: lowercase letters, numbers, dot, dash or underscore.</p>}
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
                <div className="relative">
                    <input
                        required
                        minLength={8}
                        type={showPassword ? 'text' : 'password'}
                        value={form.password}
                        onChange={(e) => update('password', e.target.value)}
                        className={`${inputClass} pr-10`}
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-200"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Must be at least 8 characters.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Star Name</label>
                    <input required type="text" value={form.star_name} onChange={(e) => update('star_name', e.target.value)} placeholder="Public display name" className={inputClass} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                    <select value={form.category} onChange={(e) => update('category', e.target.value as Category)} className={inputClass}>
                        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Price (₹)</label>
                    <input required type="number" min="1" value={form.price} onChange={(e) => update('price', Number(e.target.value))} className={inputClass} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Image URL <span className="text-gray-400 font-normal">(optional)</span></label>
                    <input type="url" value={form.image_url} onChange={(e) => update('image_url', e.target.value)} placeholder="https://..." className={inputClass} />
                </div>
            </div>

            <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
            >
                <Video className="w-4 h-4" />
                {submitting ? 'Creating...' : 'Create Creator Account'}
            </button>
        </form>
    );
}
