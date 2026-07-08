import { useState, useEffect, useCallback } from 'react';
import {
    BadgeCheck, Check, X, ExternalLink, Loader2, RefreshCw,
    Instagram, Youtube, Twitter, FileText, Users, KeyRound, Info,
} from 'lucide-react';
import {
    adminListPendingVerifications,
    adminApproveVerification,
    adminRejectVerification,
    type PendingVerification,
} from "@/services/api";

const ID_TYPE_LABELS: Record<string, string> = {
    aadhaar: 'Aadhaar', pan: 'PAN', passport: 'Passport',
    driving_license: 'Driving License', voter_id: 'Voter ID', other: 'Other',
};
const PLATFORM_LABELS: Record<string, string> = {
    instagram: 'Instagram', youtube: 'YouTube', tiktok: 'TikTok', twitter: 'Twitter / X',
};
const METHOD_LABELS: Record<string, string> = {
    bio: 'Added to bio', story: 'Posted in story', email: 'Email reply',
};

function formatFollowers(n: number | null): string {
    if (n == null) return '—';
    return n.toLocaleString('en-IN');
}

type Props = {
    /** Called after a successful approve/reject so the parent can refetch stats. */
    onStatusChange?: () => void;
};

type SocialLink = {
    href: string;
    label: string;
    Icon: typeof Instagram;
};

function socialLinks(v: PendingVerification): SocialLink[] {
    const links: SocialLink[] = [];
    if (v.instagram_url) links.push({ href: v.instagram_url, label: 'Instagram', Icon: Instagram });
    if (v.youtube_url)   links.push({ href: v.youtube_url,   label: 'YouTube',   Icon: Youtube });
    if (v.twitter_url)   links.push({ href: v.twitter_url,   label: 'Twitter',   Icon: Twitter });
    return links;
}

/**
 * Shared admin tool: review *existing creators* who have submitted social links
 * + identity proof to earn the verified badge. Distinct from
 * PendingApplicationsPanel, which handles people applying to *become* a creator.
 * Used by both the Admin and Super Admin dashboards.
 */
export default function CreatorVerificationPanel({ onStatusChange }: Props) {
    const [rows, setRows] = useState<PendingVerification[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actingId, setActingId] = useState<string | null>(null);
    // Which row currently has its reject-reason field open, and the typed reason.
    const [rejectingId, setRejectingId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');

    const fetchPending = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await adminListPendingVerifications();
            setRows(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load verification requests');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchPending(); }, [fetchPending]);

    const handleApprove = async (id: string) => {
        setActingId(id);
        setError(null);
        try {
            await adminApproveVerification(id);
            // Remove the row immediately rather than waiting for a refetch.
            setRows((prev) => prev.filter((r) => r.id !== id));
            onStatusChange?.();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to approve creator');
        } finally {
            setActingId(null);
        }
    };

    const handleReject = async (id: string) => {
        setActingId(id);
        setError(null);
        try {
            await adminRejectVerification(id, rejectReason.trim() || undefined);
            setRows((prev) => prev.filter((r) => r.id !== id));
            setRejectingId(null);
            setRejectReason('');
            onStatusChange?.();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to reject creator');
        } finally {
            setActingId(null);
        }
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <BadgeCheck className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    <h2 className="font-semibold text-lg">Verification Requests</h2>
                </div>
                <button
                    onClick={fetchPending}
                    className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                    title="Refresh"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </button>
            </div>

            {error && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-sm text-red-600 dark:text-red-400">
                    {error}
                    <button onClick={fetchPending} className="ml-2 underline hover:no-underline">Retry</button>
                </div>
            )}

            {/* List */}
            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 p-4 animate-pulse">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-lg bg-gray-200 dark:bg-white/10" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 w-40 rounded bg-gray-200 dark:bg-white/10" />
                                    <div className="h-3 w-56 rounded bg-gray-200 dark:bg-white/10" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : rows.length === 0 ? (
                <p className="py-12 text-center text-gray-400">No pending verification requests</p>
            ) : (
                <div className="space-y-3">
                    {rows.map((v) => {
                        const links = socialLinks(v);
                        const ownerName = [v.owner_first_name, v.owner_last_name].filter(Boolean).join(' ');
                        return (
                            <div key={v.id} className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 p-4">
                                <div className="flex flex-wrap items-start gap-3">
                                    {v.image_url ? (
                                        <img src={v.image_url} alt={v.name} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                                    ) : (
                                        <div className="w-12 h-12 rounded-lg bg-gray-200 dark:bg-white/10 shrink-0" />
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="font-semibold text-gray-900 dark:text-white">{v.name}</h3>
                                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300">{v.category}</span>
                                        </div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                                            {ownerName || 'Unknown owner'}
                                            {v.owner_email ? ` · ${v.owner_email}` : ''}
                                        </p>
                                    </div>
                                </div>

                                {/* Social + identity proof */}
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                    {links.map(({ href, label, Icon }) => (
                                        <a
                                            key={label}
                                            href={href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                                        >
                                            <Icon className="w-4 h-4" /> {label} <ExternalLink className="w-3 h-3 opacity-60" />
                                        </a>
                                    ))}
                                    {v.identity_proof_url && (
                                        <a
                                            href={v.identity_proof_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-500/25 transition-colors"
                                        >
                                            <FileText className="w-4 h-4" />
                                            {v.identity_proof_type ? `View ${ID_TYPE_LABELS[v.identity_proof_type] ?? 'ID'}` : 'View ID'}
                                            <ExternalLink className="w-3 h-3 opacity-60" />
                                        </a>
                                    )}
                                </div>

                                {/* Submission details */}
                                <div className="mt-3 grid sm:grid-cols-2 gap-3 text-sm">
                                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                                        <Users className="w-4 h-4 text-gray-400 shrink-0" />
                                        <span>
                                            {v.platform ? PLATFORM_LABELS[v.platform] ?? v.platform : 'Platform —'}
                                            {' · '}
                                            <span className="font-medium">{formatFollowers(v.follower_count)}</span> followers
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                                        <KeyRound className="w-4 h-4 text-gray-400 shrink-0" />
                                        <span>
                                            Code{' '}
                                            <span className="font-mono font-semibold text-purple-600 dark:text-purple-300">{v.ownership_code ?? '—'}</span>
                                            {v.ownership_method && <> · {METHOD_LABELS[v.ownership_method] ?? v.ownership_method}</>}
                                        </span>
                                    </div>
                                </div>

                                {/* Reviewer note */}
                                <div className="mt-3 flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-xs text-amber-700 dark:text-amber-300">
                                    <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                    <span>
                                        Verify: (1) the social profile is public and matches this creator, and
                                        (2) code <span className="font-mono font-semibold">{v.ownership_code ?? 'CLIPP-XXXXXX'}</span> appears in their{' '}
                                        {v.ownership_method ? (METHOD_LABELS[v.ownership_method] ?? 'bio/story/email') : 'bio / story / email reply'}.
                                    </span>
                                </div>

                                {/* Actions */}
                                <div className="mt-4 flex flex-wrap items-center gap-2">
                                    <button
                                        onClick={() => handleApprove(v.id)}
                                        disabled={actingId === v.id}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
                                    >
                                        {actingId === v.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Approve
                                    </button>
                                    <button
                                        onClick={() => {
                                            setRejectingId(rejectingId === v.id ? null : v.id);
                                            setRejectReason('');
                                        }}
                                        disabled={actingId === v.id}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 disabled:opacity-50 text-sm font-medium transition-colors"
                                    >
                                        <X className="w-4 h-4" /> Reject
                                    </button>
                                </div>

                                {/* Inline reject reason */}
                                {rejectingId === v.id && (
                                    <div className="mt-3 flex flex-col sm:flex-row gap-2">
                                        <input
                                            type="text"
                                            value={rejectReason}
                                            onChange={(e) => setRejectReason(e.target.value)}
                                            placeholder="Reason (optional)"
                                            maxLength={2000}
                                            className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                                        />
                                        <button
                                            onClick={() => handleReject(v.id)}
                                            disabled={actingId === v.id}
                                            className="flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
                                        >
                                            {actingId === v.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Confirm reject
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
