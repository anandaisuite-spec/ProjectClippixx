import { useState, useEffect, useCallback } from 'react';
import {
    ClipboardList, Check, X, ExternalLink, Loader2, RefreshCw,
} from 'lucide-react';
import {
    adminListApplications,
    adminUpdateApplicationStatus,
    type CreatorApplication,
} from "@/services/api";

type StatusFilter = CreatorApplication['status'] | 'all';

const STATUS_FILTERS: { label: string; value: StatusFilter }[] = [
    { label: 'All',       value: 'all' },
    { label: 'Pending',   value: 'pending' },
    { label: 'Reviewing', value: 'reviewing' },
    { label: 'Approved',  value: 'approved' },
    { label: 'Rejected',  value: 'rejected' },
];

const STATUS_BADGE: Record<CreatorApplication['status'], string> = {
    pending:   'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
    reviewing: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300',
    approved:  'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
    rejected:  'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300',
};

const PAGE_SIZE = 50;

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

type Props = {
    /** Called after a successful approve/reject so the parent can refetch stats. */
    onStatusChange?: () => void;
};

/**
 * Shared admin tool: review creator applications. Used by both the Admin and
 * Super Admin dashboards. Always fetches fresh data on mount / filter change
 * (no stale cache across navigations). Approve/Reject just flip status — issuing
 * the actual login is a separate step via the Create Creator flow.
 */
export default function PendingApplicationsPanel({ onStatusChange }: Props) {
    const [apps, setApps] = useState<CreatorApplication[]>([]);
    const [filter, setFilter] = useState<StatusFilter>('pending');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [actingId, setActingId] = useState<string | null>(null);

    // Fetch a page. page 1 replaces the list; later pages append ("Load more").
    const fetchPage = useCallback(async (targetPage: number, replace: boolean) => {
        if (replace) setLoading(true);
        setError(null);
        try {
            const res = await adminListApplications({
                status: filter === 'all' ? undefined : filter,
                page: targetPage,
                limit: PAGE_SIZE,
            });
            setApps((prev) => (replace ? res.data : [...prev, ...res.data]));
            setTotalPages(res.pagination.totalPages);
            setPage(targetPage);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load applications');
        } finally {
            setLoading(false);
        }
    }, [filter]);

    // Fresh fetch on mount and whenever the filter changes.
    useEffect(() => { fetchPage(1, true); }, [fetchPage]);

    const handleStatus = async (id: string, status: CreatorApplication['status']) => {
        setActingId(id);
        setError(null);
        try {
            await adminUpdateApplicationStatus(id, status);
            // Refresh the current filtered view from page 1 so the item moves/leaves correctly.
            await fetchPage(1, true);
            onStatusChange?.();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update application');
        } finally {
            setActingId(null);
        }
    };

    return (
        <div className="space-y-4">
            {/* Header + filter pills */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    <h2 className="font-semibold text-lg">Creator Applications</h2>
                </div>
                <button
                    onClick={() => fetchPage(1, true)}
                    className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                    title="Refresh"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </button>
            </div>

            <div className="flex flex-wrap gap-2">
                {STATUS_FILTERS.map((f) => (
                    <button
                        key={f.value}
                        onClick={() => setFilter(f.value)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                            filter === f.value
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10'
                        }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {error && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-sm text-red-600 dark:text-red-400">
                    {error}
                </div>
            )}

            {/* List */}
            {loading ? (
                <div className="py-12 flex items-center justify-center text-gray-500">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading applications...
                </div>
            ) : apps.length === 0 ? (
                <p className="py-12 text-center text-gray-400">No applications{filter !== 'all' ? ` with status "${filter}"` : ''}.</p>
            ) : (
                <div className="space-y-3">
                    {apps.map((a) => (
                        <div key={a.id} className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="font-semibold text-gray-900 dark:text-white">{a.full_name}</h3>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[a.status]}`}>{a.status}</span>
                                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300">{a.category}</span>
                                    </div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{a.email}</p>
                                </div>
                                <span className="text-xs text-gray-400 shrink-0">{formatDate(a.created_at)}</span>
                            </div>

                            <dl className="mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                                <div>
                                    <dt className="text-xs text-gray-400">Followers</dt>
                                    <dd className="text-gray-700 dark:text-gray-200">{a.followers_count || '—'}</dd>
                                </div>
                                <div className="min-w-0">
                                    <dt className="text-xs text-gray-400">Social links</dt>
                                    <dd className="text-gray-700 dark:text-gray-200 break-words">
                                        {/^https?:\/\//i.test(a.social_links) ? (
                                            <a href={a.social_links} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-purple-600 dark:text-purple-400 hover:underline">
                                                {a.social_links} <ExternalLink className="w-3 h-3 shrink-0" />
                                            </a>
                                        ) : a.social_links}
                                    </dd>
                                </div>
                                <div className="sm:col-span-2">
                                    <dt className="text-xs text-gray-400">Bio</dt>
                                    <dd className="text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{a.bio}</dd>
                                </div>
                                <div className="sm:col-span-2">
                                    <dt className="text-xs text-gray-400">Why they want to join</dt>
                                    <dd className="text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{a.why_join}</dd>
                                </div>
                            </dl>

                            {/* Actions — only meaningful while not already decided */}
                            {(a.status === 'pending' || a.status === 'reviewing') && (
                                <div className="mt-4 flex items-center gap-2">
                                    <button
                                        onClick={() => handleStatus(a.id, 'approved')}
                                        disabled={actingId === a.id}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
                                    >
                                        {actingId === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Approve
                                    </button>
                                    <button
                                        onClick={() => handleStatus(a.id, 'rejected')}
                                        disabled={actingId === a.id}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 disabled:opacity-50 text-sm font-medium transition-colors"
                                    >
                                        <X className="w-4 h-4" /> Reject
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Load more (server-side pagination) */}
            {!loading && page < totalPages && (
                <div className="text-center pt-2">
                    <button
                        onClick={() => fetchPage(page + 1, false)}
                        className="px-4 py-2 rounded-lg border border-gray-200 dark:border-white/10 text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                    >
                        Load more
                    </button>
                </div>
            )}
        </div>
    );
}
