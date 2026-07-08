import { useState, useEffect, useCallback } from 'react';
import { Search } from 'lucide-react';
import { getStars, type Star } from '@/services/api-extensions';
import CreatorGrid from '@/features/creator/components/CreatorGrid';

// Real seeded categories (the backend only accepts these for new stars).
const CATEGORIES = ['All', 'Actor', 'Athlete', 'Creator', 'Musician'];

/**
 * Creator listing page (/creators) — backed by the real /api/stars endpoint.
 * Search + category query the backend; cards route to /creator/:id.
 */
export default function CreatorsPage() {
    const [creators, setCreators] = useState<Star[]>([]);
    const [query, setQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [category, setCategory] = useState('All');
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Debounce the search box so we don't hit the API on every keystroke.
    useEffect(() => {
        const t = setTimeout(() => setDebouncedQuery(query), 300);
        return () => clearTimeout(t);
    }, [query]);

    const load = useCallback(() => {
        setLoading(true);
        setError(null);
        let cancelled = false;

        getStars({
            limit: 50,
            sort: 'rating',
            order: 'desc',
            search: debouncedQuery || undefined,
            category: category === 'All' ? undefined : category,
        })
            .then((res) => {
                if (cancelled) return;
                setCreators(res.data);
                setTotal(res.pagination.total);
            })
            .catch((err: Error) => { if (!cancelled) setError(err.message); })
            .finally(() => { if (!cancelled) setLoading(false); });

        return () => { cancelled = true; };
    }, [debouncedQuery, category]);

    useEffect(() => { load(); }, [load]);

    return (
        <div className="min-h-screen bg-dark-950 pt-24 pb-16 px-4 sm:px-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl sm:text-4xl font-bold text-white">Browse Creators</h1>
                    <p className="text-white/50 mt-1">Book a personalized video from your favourite stars.</p>
                </div>

                {/* Search + category filters */}
                <div className="flex flex-col gap-4 mb-8">
                    <div className="relative max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                        <input
                            type="text"
                            placeholder="Search by name…"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-dark-900 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-primary-500 transition-colors"
                        />
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {CATEGORIES.map((cat) => (
                            <button
                                key={cat}
                                onClick={() => setCategory(cat)}
                                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                                    category === cat
                                        ? 'bg-white text-gray-900'
                                        : 'bg-dark-900 border border-white/10 text-white/70 hover:bg-white/5'
                                }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                {error ? (
                    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center justify-between">
                        <span>{error}</span>
                        <button onClick={load} className="underline hover:no-underline">Retry</button>
                    </div>
                ) : loading ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 sm:gap-6">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="rounded-2xl overflow-hidden bg-dark-900 border border-white/10 animate-pulse">
                                <div className="aspect-[3/4] bg-white/5" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <>
                        <p className="text-sm text-white/40 mb-6">
                            {total} {total === 1 ? 'creator' : 'creators'}
                        </p>
                        <CreatorGrid creators={creators} />
                    </>
                )}
            </div>
        </div>
    );
}
