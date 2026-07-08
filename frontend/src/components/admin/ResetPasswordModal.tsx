import { useState } from 'react';
import { X, Eye, EyeOff, KeyRound, Check } from 'lucide-react';
import { adminResetPassword } from "@/services/api";

type Props = {
    userId: string;
    label: string; // who we're resetting, e.g. "Alex Sterling" or the email/username
    onClose: () => void;
};

/**
 * Admin-mediated password reset. For username-based creator accounts (no real
 * inbox) this is the only recovery path — Firebase's email reset can't reach them.
 */
export default function ResetPasswordModal({ userId, label, onClose }: Props) {
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [done, setDone] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);
        try {
            await adminResetPassword(userId, password);
            setDone(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to reset password');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl w-full max-w-md relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-900 dark:hover:text-white">
                    <X className="w-5 h-5" />
                </button>
                <div className="p-6 border-b border-gray-100 dark:border-dark-700 flex items-center gap-3">
                    <KeyRound className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    <h3 className="text-xl font-bold">Reset Password</h3>
                </div>

                {done ? (
                    <div className="p-6 space-y-4">
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                            <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <p className="text-sm text-emerald-800 dark:text-emerald-300">
                                Password updated. Give <span className="font-semibold">{label}</span> the new password.
                            </p>
                        </div>
                        <button onClick={onClose} className="w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium transition-colors">Done</button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Set a new password for <span className="font-semibold text-gray-700 dark:text-gray-200">{label}</span>.
                        </p>
                        {error && (
                            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-sm text-red-600 dark:text-red-400">
                                {error}
                            </div>
                        )}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Password</label>
                            <div className="relative">
                                <input
                                    required
                                    minLength={8}
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 dark:border-dark-600 p-2 pr-10 text-sm dark:bg-dark-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40"
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
                        <div className="flex justify-end gap-3 pt-2">
                            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition dark:text-gray-300 dark:hover:bg-dark-700">Cancel</button>
                            <button type="submit" disabled={submitting} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition">
                                {submitting ? 'Resetting...' : 'Reset Password'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
