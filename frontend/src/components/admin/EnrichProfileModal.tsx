import { useState } from 'react';
import { Sparkles, X, Loader2, Check, ExternalLink } from 'lucide-react';
import {
    adminEnrichCreator,
    adminConfirmEnrichment,
    type EnrichmentResult,
} from '@/services/api';

type Props = {
    starId: string;
    initialName: string;
    onClose: () => void;
    /** Called after a successful confirm/save so the parent can refresh. */
    onSaved?: () => void;
};

const VERDICT_STYLE: Record<string, { label: string; cls: string }> = {
    auto_verified: { label: 'Auto-verified', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30' },
    review_queue: { label: 'Review queue', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 border-amber-300 dark:border-amber-500/30' },
    not_verified: { label: 'Not verified', cls: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400 border-red-300 dark:border-red-500/30' },
};

/**
 * Admin "Enrich Profile" modal — pulls bio/photo/known-works from open APIs,
 * generates an AI (or template) bio, computes a verification score, and lets
 * the admin confirm & save or discard. Nothing is saved until "Confirm & Save".
 */
export default function EnrichProfileModal({ starId, initialName, onClose, onSaved }: Props) {
    const [name, setName] = useState(initialName);
    const [tmdbUrl, setTmdbUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<EnrichmentResult | null>(null);

    const runEnrich = async () => {
        if (!name.trim()) { setError('Enter a name to search.'); return; }
        setError(null);
        setLoading(true);
        setResult(null);
        try {
            const res = await adminEnrichCreator(starId, name.trim(), tmdbUrl.trim() || undefined);
            setResult(res);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Enrichment failed');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = async () => {
        if (!result) return;
        setSaving(true);
        setError(null);
        try {
            await adminConfirmEnrichment(starId, result.preview, result.verification_score);
            onSaved?.();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save');
            setSaving(false);
        }
    };

    const verdict = result ? VERDICT_STYLE[result.verification_score.verdict] : null;

    return (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !saving && !loading && onClose()} />
            <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-dark-800 shadow-xl p-6">
                <button
                    onClick={() => !saving && !loading && onClose()}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    aria-label="Close"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="w-5 h-5 text-purple-500" />
                    <h3 className="font-semibold text-gray-900 dark:text-white">Enrich Profile</h3>
                </div>

                {/* Inputs */}
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5">Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full rounded-xl bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 px-3 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5">TMDB URL (optional)</label>
                        <input
                            type="url"
                            value={tmdbUrl}
                            onChange={(e) => setTmdbUrl(e.target.value)}
                            placeholder="https://www.themoviedb.org/person/12345-name"
                            className="w-full rounded-xl bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 px-3 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                        />
                    </div>
                    <button
                        onClick={runEnrich}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white transition"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        {loading ? 'Fetching & generating…' : 'Run enrichment'}
                    </button>
                </div>

                {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

                {/* Preview */}
                {result && (
                    <div className="mt-5 border-t border-gray-100 dark:border-dark-700 pt-5 space-y-4">
                        <p className="text-xs text-gray-500 dark:text-gray-400">{result.message}</p>

                        <div className="flex gap-4">
                            {result.preview.photo_url ? (
                                <img src={result.preview.photo_url} alt={result.preview.name} className="w-20 h-20 rounded-xl object-cover shrink-0" />
                            ) : (
                                <div className="w-20 h-20 rounded-xl bg-gray-100 dark:bg-dark-700 shrink-0 flex items-center justify-center text-gray-400 text-xs">No photo</div>
                            )}
                            <div className="min-w-0">
                                <p className="font-semibold text-gray-900 dark:text-white">{result.preview.name}</p>
                                {result.preview.occupation && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{result.preview.occupation}</p>
                                )}
                                {verdict && (
                                    <span className={`mt-1.5 inline-block px-2.5 py-0.5 rounded-full text-xs font-medium border ${verdict.cls}`}>
                                        {verdict.label} (score: {result.verification_score.score})
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* AI bio */}
                        <div>
                            <p className="text-xs font-medium text-gray-400 mb-1">
                                Bio <span className="opacity-70">({result.bio_source === 'groq' ? 'AI-generated' : 'template'})</span>
                            </p>
                            <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-dark-700 rounded-xl p-3">{result.preview.bio}</p>
                        </div>

                        {/* Known for */}
                        {result.preview.known_for.length > 0 && (
                            <div>
                                <p className="text-xs font-medium text-gray-400 mb-1">Known for</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {result.preview.known_for.map((w) => (
                                        <span key={w} className="px-2 py-0.5 rounded-lg text-xs bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300">{w}</span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Score breakdown */}
                        <div>
                            <p className="text-xs font-medium text-gray-400 mb-1">Verification score breakdown</p>
                            <div className="space-y-1">
                                {result.verification_score.breakdown.length === 0 ? (
                                    <p className="text-xs text-gray-400">No trust signals present yet.</p>
                                ) : result.verification_score.breakdown.map((b) => (
                                    <div key={b.signal} className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
                                        <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-500" /> {b.signal}</span>
                                        <span className="font-medium">+{b.score}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Sources */}
                        {result.sources.length > 0 && (
                            <p className="text-xs text-gray-400 flex items-center gap-1">
                                <ExternalLink className="w-3 h-3" /> Sources: {result.sources.join(', ')}
                            </p>
                        )}

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                                onClick={onClose}
                                disabled={saving}
                                className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 transition"
                            >
                                Discard
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={saving}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white transition"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                {saving ? 'Saving…' : 'Confirm & Save'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
