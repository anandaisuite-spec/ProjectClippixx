import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { browseCreators } from "@/services/api";
import type { PublicProfile } from "@/services/api";
import { Search } from 'lucide-react';
import AvatarPlaceholder from "@/components/ui/AvatarPlaceholder";

export default function Browse() {
    const navigate = useNavigate();
    const [creators, setCreators] = useState<PublicProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [sort, setSort] = useState<'created_at' | 'first_name'>('created_at');

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);

        browseCreators({ page, limit: 20, search: debouncedSearch || undefined, sort })
            .then((res) => {
                if (cancelled) return;
                setCreators(res.data);
                setTotalPages(res.pagination.totalPages);
                setTotal(res.pagination.total);
            })
            .catch((err: Error) => {
                if (!cancelled) setError(err.message);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, [page, debouncedSearch, sort]);

    const handleViewProfile = (userId: string) => {
        navigate(`/profile/${userId}`);
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-dark-900 p-8 pt-24">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-3xl font-bold mb-1">Browse Creators</h1>
                <p className="text-gray-500 dark:text-gray-400 mb-8">
                    {!loading && `${total} creator${total !== 1 ? 's' : ''} on the platform`}
                </p>

                {/* Search + Sort */}
                <div className="flex flex-col sm:flex-row gap-4 mb-8">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by name..."
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-800 focus:outline-none focus:ring-2 focus:ring-purple-500/40 text-sm"
                        />
                    </div>
                    <select
                        value={sort}
                        onChange={(e) => { setSort(e.target.value as typeof sort); setPage(1); }}
                        className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                    >
                        <option value="created_at">Newest First</option>
                        <option value="first_name">Name A–Z</option>
                    </select>
                </div>

                {error && (
                    <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 rounded-xl mb-6 text-sm">
                        {error}
                    </div>
                )}

                {loading && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="bg-white dark:bg-dark-800 rounded-2xl p-6 border border-gray-100 dark:border-dark-700 animate-pulse">
                                <div className="w-16 h-16 bg-gray-200 dark:bg-dark-700 rounded-full mx-auto mb-4" />
                                <div className="h-4 bg-gray-200 dark:bg-dark-700 rounded w-3/4 mx-auto mb-2" />
                                <div className="h-3 bg-gray-200 dark:bg-dark-700 rounded w-1/2 mx-auto" />
                            </div>
                        ))}
                    </div>
                )}

                {!loading && !error && (
                    <>
                        {creators.length === 0 ? (
                            <div className="text-center text-gray-400 py-20">
                                No creators found{debouncedSearch ? ` for "${debouncedSearch}"` : ''}.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {creators.map((creator) => (
                                    <button
                                        key={creator.id}
                                        onClick={() => handleViewProfile(creator.id)}
                                        className="bg-white dark:bg-dark-800 rounded-2xl p-6 border border-gray-100 dark:border-dark-700 hover:shadow-lg hover:border-purple-200 dark:hover:border-purple-800/50 transition-all text-left w-full"
                                    >
                                        <AvatarPlaceholder
                                            name={`${creator.first_name} ${creator.last_name}`}
                                            src={creator.avatar_url}
                                            size={64}
                                            className="mx-auto mb-4"
                                        />
                                        <h3 className="text-center font-semibold mb-1">
                                            {creator.first_name} {creator.last_name}
                                        </h3>
                                        {creator.bio && (
                                            <p className="text-sm text-gray-500 dark:text-gray-400 text-center line-clamp-2">
                                                {creator.bio}
                                            </p>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}

                        {totalPages > 1 && (
                            <div className="flex justify-center items-center gap-3 mt-10">
                                <button
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="px-4 py-2 rounded-lg border border-gray-200 dark:border-dark-600 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-dark-700 transition text-sm"
                                >
                                    Previous
                                </button>
                                <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
                                <button
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="px-4 py-2 rounded-lg border border-gray-200 dark:border-dark-600 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-dark-700 transition text-sm"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
