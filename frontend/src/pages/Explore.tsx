import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    Search, SlidersHorizontal, LayoutGrid, List as ListIcon, Star, Clock,
    BadgeCheck, X, Loader2,
} from 'lucide-react';
import {
    getExplore, getExploreFilters,
    type ExploreCreator, type ExploreFilters, type ExploreSort,
} from '@/services/api';

const CATEGORIES = ['All', 'Actor', 'Musician', 'Comedian', 'Athlete', 'Influencer', 'YouTuber', 'Podcaster', 'Other'];
// Fixed language filter options (independent of which languages exist in the data).
const LANGUAGES = ['English', 'Hindi', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Marathi', 'Bengali', 'Punjabi', 'Gujarati', 'Other'];
const RATING_OPTIONS: { label: string; value: number | null }[] = [
    { label: 'Any', value: null }, { label: '3★+', value: 3 }, { label: '4★+', value: 4 }, { label: '4.5★+', value: 4.5 },
];
const DELIVERY_OPTIONS: { label: string; value: number | null }[] = [
    { label: 'Any', value: null }, { label: '1 day', value: 1 }, { label: '3 days', value: 3 }, { label: '7 days', value: 7 }, { label: '14 days', value: 14 },
];
const SORT_OPTIONS: { label: string; value: ExploreSort }[] = [
    { label: 'Most Popular', value: 'popular' },
    { label: 'Highest Rated', value: 'rating' },
    { label: 'Price: Low to High', value: 'price_low' },
    { label: 'Price: High to Low', value: 'price_high' },
    { label: 'Newest', value: 'newest' },
];
const VIEW_KEY = 'clipixx_explore_view';
const fmt = (n: number) => Number(n).toLocaleString('en-IN');

export default function Explore() {
    const [searchParams, setSearchParams] = useSearchParams();

    // ── URL-derived state ──
    const [search, setSearch] = useState(searchParams.get('q') ?? '');
    const [category, setCategory] = useState(searchParams.get('category') ?? 'All');
    const [minPrice, setMinPrice] = useState<number | null>(searchParams.get('min_price') ? Number(searchParams.get('min_price')) : null);
    const [maxPrice, setMaxPrice] = useState<number | null>(searchParams.get('max_price') ? Number(searchParams.get('max_price')) : null);
    const [rating, setRating] = useState<number | null>(searchParams.get('rating') ? Number(searchParams.get('rating')) : null);
    const [language, setLanguage] = useState<string | null>(searchParams.get('language') ?? null);
    const [delivery, setDelivery] = useState<number | null>(searchParams.get('delivery') ? Number(searchParams.get('delivery')) : null);
    const [sort, setSort] = useState<ExploreSort>((searchParams.get('sort') as ExploreSort) ?? 'popular');

    const [view, setView] = useState<'grid' | 'list'>(() => (localStorage.getItem(VIEW_KEY) as 'grid' | 'list') || 'grid');
    const [sheetOpen, setSheetOpen] = useState(false);

    // ── Data ──
    const [filters, setFilters] = useState<ExploreFilters | null>(null);
    const [creators, setCreators] = useState<ExploreCreator[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    useEffect(() => { getExploreFilters().then(setFilters).catch(() => setFilters(null)); }, []);
    useEffect(() => { localStorage.setItem(VIEW_KEY, view); }, [view]);

    // Initialise the price ceiling once filters arrive (if no URL max set).
    useEffect(() => {
        if (filters && maxPrice === null && !searchParams.get('max_price')) {
            setMaxPrice(filters.price_range.max);
        }
    }, [filters, maxPrice, searchParams]);

    // Sync state → URL (shareable, back-button friendly).
    const syncUrl = useCallback(() => {
        const p = new URLSearchParams();
        if (search) p.set('q', search);
        if (category !== 'All') p.set('category', category);
        if (minPrice) p.set('min_price', String(minPrice));
        if (maxPrice !== null && filters && maxPrice < filters.price_range.max) p.set('max_price', String(maxPrice));
        if (rating) p.set('rating', String(rating));
        if (language) p.set('language', language);
        if (delivery) p.set('delivery', String(delivery));
        if (sort !== 'popular') p.set('sort', sort);
        setSearchParams(p, { replace: true });
    }, [search, category, minPrice, maxPrice, rating, language, delivery, sort, filters, setSearchParams]);

    // Debounced fetch (400ms) whenever any filter changes.
    const debTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const fetchResults = useCallback((targetPage: number, replace: boolean) => {
        if (replace) setLoading(true); else setLoadingMore(true);
        getExplore({
            q: search || undefined,
            category: category !== 'All' ? category : undefined,
            min_price: minPrice || undefined,
            max_price: (maxPrice !== null && filters && maxPrice < filters.price_range.max) ? maxPrice : undefined,
            rating: rating || undefined,
            language: language || undefined,
            // delivery isn't a backend filter param; applied client-side below.
            sort,
            page: targetPage,
            limit: 12,
        })
            .then((res) => {
                const filtered = delivery
                    ? res.creators.filter((c) => c.min_delivery_days <= delivery)
                    : res.creators;
                setCreators((prev) => (replace ? filtered : [...prev, ...filtered]));
                setTotal(res.total);
                setPage(res.page);
                setTotalPages(res.total_pages);
            })
            .catch(() => { if (replace) setCreators([]); })
            .finally(() => { setLoading(false); setLoadingMore(false); });
    }, [search, category, minPrice, maxPrice, rating, language, delivery, sort, filters]);

    useEffect(() => {
        syncUrl();
        if (debTimer.current) clearTimeout(debTimer.current);
        debTimer.current = setTimeout(() => fetchResults(1, true), 400);
        return () => { if (debTimer.current) clearTimeout(debTimer.current); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search, category, minPrice, maxPrice, rating, language, delivery, sort]);

    const clearAll = () => {
        setSearch(''); setCategory('All'); setMinPrice(null);
        setMaxPrice(filters ? filters.price_range.max : null);
        setRating(null); setLanguage(null); setDelivery(null); setSort('popular');
    };

    const activeFilterCount = [
        category !== 'All', !!minPrice, (maxPrice !== null && filters && maxPrice < filters.price_range.max),
        !!rating, !!language, !!delivery,
    ].filter(Boolean).length;

    const FiltersPanel = (
        <div className="space-y-6">
            {/* Category */}
            <div>
                <h3 className="text-sm font-semibold text-white mb-2">Category</h3>
                <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map((c) => (
                        <button key={c} onClick={() => setCategory(c)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                                category === c ? 'bg-primary-600 border-primary-600 text-white' : 'border-white/10 text-white/60 hover:border-white/30'}`}>
                            {c}
                        </button>
                    ))}
                </div>
            </div>

            {/* Price range */}
            {filters && (
                <div>
                    <h3 className="text-sm font-semibold text-white mb-2">Price Range</h3>
                    <div className="flex items-center justify-between text-xs text-white/50 mb-1">
                        <span>₹{fmt(minPrice ?? 0)}</span>
                        <span>₹{fmt(maxPrice ?? filters.price_range.max)}</span>
                    </div>
                    {/* Desktop/tablet: dual single-handle sliders sharing one track.
                        h-11 (44px) gives each slider a proper touch hit area. */}
                    <div className="hidden md:block space-y-1">
                        <input type="range" min={filters.price_range.min} max={filters.price_range.max} step={100}
                            value={minPrice ?? filters.price_range.min}
                            onChange={(e) => setMinPrice(Math.min(Number(e.target.value), (maxPrice ?? filters.price_range.max)))}
                            aria-label="Minimum price"
                            className="w-full h-11 accent-primary-500" />
                        <input type="range" min={filters.price_range.min} max={filters.price_range.max} step={100}
                            value={maxPrice ?? filters.price_range.max}
                            onChange={(e) => setMaxPrice(Math.max(Number(e.target.value), (minPrice ?? filters.price_range.min)))}
                            aria-label="Maximum price"
                            className="w-full h-11 accent-primary-500" />
                    </div>
                    {/* Mobile: min/max number inputs — overlapping slider thumbs are
                        too fiddly on touch at narrow widths. */}
                    <div className="md:hidden grid grid-cols-2 gap-2">
                        <input
                            type="number" inputMode="numeric"
                            min={filters.price_range.min} max={filters.price_range.max}
                            value={minPrice ?? filters.price_range.min}
                            onChange={(e) => setMinPrice(Math.min(Number(e.target.value) || 0, (maxPrice ?? filters.price_range.max)))}
                            placeholder="Min" aria-label="Minimum price"
                            className="w-full min-h-[44px] rounded-xl bg-dark-900 border border-white/10 px-3 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-primary-500"
                        />
                        <input
                            type="number" inputMode="numeric"
                            min={filters.price_range.min} max={filters.price_range.max}
                            value={maxPrice ?? filters.price_range.max}
                            onChange={(e) => setMaxPrice(Math.max(Number(e.target.value) || 0, (minPrice ?? filters.price_range.min)))}
                            placeholder="Max" aria-label="Maximum price"
                            className="w-full min-h-[44px] rounded-xl bg-dark-900 border border-white/10 px-3 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-primary-500"
                        />
                    </div>
                </div>
            )}

            {/* Rating */}
            <div>
                <h3 className="text-sm font-semibold text-white mb-2">Minimum Rating</h3>
                <div className="flex flex-wrap gap-2">
                    {RATING_OPTIONS.map((r) => (
                        <button key={r.label} onClick={() => setRating(r.value)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                                rating === r.value ? 'bg-primary-600 border-primary-600 text-white' : 'border-white/10 text-white/60 hover:border-white/30'}`}>
                            {r.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Language */}
            <div>
                <h3 className="text-sm font-semibold text-white mb-2">Language</h3>
                <div className="space-y-1.5 max-h-44 overflow-y-auto">
                    {LANGUAGES.map((lang) => (
                        <label key={lang} className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
                            <input type="checkbox" checked={language === lang}
                                onChange={() => setLanguage(language === lang ? null : lang)}
                                className="accent-primary-500 w-4 h-4" />
                            {lang}
                        </label>
                    ))}
                </div>
            </div>

            {/* Delivery */}
            <div>
                <h3 className="text-sm font-semibold text-white mb-2">Delivery Time</h3>
                <div className="flex flex-wrap gap-2">
                    {DELIVERY_OPTIONS.map((d) => (
                        <button key={d.label} onClick={() => setDelivery(d.value)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                                delivery === d.value ? 'bg-primary-600 border-primary-600 text-white' : 'border-white/10 text-white/60 hover:border-white/30'}`}>
                            {d.label}
                        </button>
                    ))}
                </div>
            </div>

            <button onClick={clearAll} className="w-full px-4 py-2 rounded-xl text-sm font-medium border border-white/10 text-white/70 hover:bg-white/5 transition">
                Clear All Filters
            </button>
        </div>
    );

    return (
        <div className="min-h-screen bg-dark-950 pt-24 pb-16 px-4 sm:px-6">
            <div className="max-w-6xl mx-auto">
                <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Explore Creators</h1>
                <p className="text-sm text-white/50 mb-6">Find the perfect creator for your moment.</p>

                <div className="lg:grid lg:grid-cols-[260px_1fr] lg:gap-8">
                    {/* Sidebar (desktop) */}
                    <aside className="hidden lg:block">
                        <div className="sticky top-24 rounded-2xl border border-white/10 bg-dark-900 p-5">
                            {FiltersPanel}
                        </div>
                    </aside>

                    {/* Content */}
                    <div>
                        {/* Search */}
                        <div className="relative mb-4">
                            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search creators by name..."
                                className="w-full rounded-xl bg-dark-900 border border-white/10 pl-10 pr-3 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-primary-500"
                            />
                        </div>

                        {/* Controls row */}
                        <div className="flex items-center justify-between gap-3 mb-5">
                            <div className="flex items-center gap-2">
                                <button onClick={() => setSheetOpen(true)}
                                    className="lg:hidden flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 text-sm text-white/80">
                                    <SlidersHorizontal className="w-4 h-4" /> Filters
                                    {activeFilterCount > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary-600 text-white">{activeFilterCount}</span>}
                                </button>
                                <span className="text-sm text-white/50">{loading ? 'Searching…' : `${total} creator${total === 1 ? '' : 's'} found`}</span>
                            </div>

                            <div className="flex items-center gap-2">
                                <select value={sort} onChange={(e) => setSort(e.target.value as ExploreSort)}
                                    className="rounded-xl bg-dark-900 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-primary-500">
                                    {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                                <div className="hidden sm:flex items-center rounded-xl border border-white/10 overflow-hidden">
                                    <button onClick={() => setView('grid')} className={`p-2 ${view === 'grid' ? 'bg-primary-600 text-white' : 'text-white/50'}`} aria-label="Grid view"><LayoutGrid className="w-4 h-4" /></button>
                                    <button onClick={() => setView('list')} className={`p-2 ${view === 'list' ? 'bg-primary-600 text-white' : 'text-white/50'}`} aria-label="List view"><ListIcon className="w-4 h-4" /></button>
                                </div>
                            </div>
                        </div>

                        {/* Results */}
                        {loading ? (
                            <div className={view === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5' : 'space-y-4'}>
                                {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} view={view} />)}
                            </div>
                        ) : creators.length === 0 ? (
                            <div className="py-20 text-center">
                                <p className="text-white/70 font-medium">No creators found matching your filters.</p>
                                <button onClick={clearAll} className="mt-4 px-5 py-2.5 rounded-xl text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white transition">Clear filters</button>
                            </div>
                        ) : (
                            <>
                                <div className={view === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5' : 'space-y-4'}>
                                    {creators.map((c) => view === 'grid' ? <GridCard key={c.id} c={c} /> : <ListRow key={c.id} c={c} />)}
                                </div>

                                <div className="mt-8 text-center space-y-3">
                                    <p className="text-xs text-white/40">Showing {creators.length} of {total} creators</p>
                                    {page < totalPages && (
                                        <button onClick={() => fetchResults(page + 1, false)} disabled={loadingMore}
                                            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium border border-white/15 text-white hover:bg-white/5 transition disabled:opacity-50">
                                            {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}{loadingMore ? 'Loading…' : 'Load more'}
                                        </button>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Mobile filters bottom sheet */}
            {sheetOpen && (
                <div className="fixed inset-0 z-[140] lg:hidden">
                    <div className="absolute inset-0 bg-black/60" onClick={() => setSheetOpen(false)} />
                    <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-dark-900 border-t border-white/10 p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-semibold text-white">Filters</h2>
                            <button onClick={() => setSheetOpen(false)} className="text-white/50 hover:text-white"><X className="w-5 h-5" /></button>
                        </div>
                        {FiltersPanel}
                        <button onClick={() => setSheetOpen(false)} className="mt-5 w-full px-4 py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold transition">
                            Show {total} results
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Cards ────────────────────────────────────────────────────────────────────
function Avatar({ url, name, ring }: { url: string | null; name: string | null; ring?: boolean }) {
    return url
        ? <img src={url} alt={name || ''} className={`w-full h-full rounded-full object-cover ${ring ? 'ring-4 ring-dark-900' : ''}`} />
        : <div className={`w-full h-full rounded-full bg-primary-600/30 text-primary-300 font-bold flex items-center justify-center text-lg ${ring ? 'ring-4 ring-dark-900' : ''}`}>{(name || 'C').slice(0, 1).toUpperCase()}</div>;
}

function Languages({ langs }: { langs: string[] }) {
    if (!langs || langs.length === 0) return null;
    const shown = langs.slice(0, 2);
    const extra = langs.length - shown.length;
    return (
        <div className="flex flex-wrap gap-1">
            {shown.map((l) => <span key={l} className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 text-white/50">{l}</span>)}
            {extra > 0 && <span className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 text-white/50">+{extra} more</span>}
        </div>
    );
}

function GridCard({ c }: { c: ExploreCreator }) {
    const navigate = useNavigate();
    return (
        <div onClick={() => navigate(`/creator/${c.id}`)}
            className="rounded-2xl border border-white/10 bg-dark-900 overflow-hidden cursor-pointer hover:border-white/25 transition group">
            {/* Cover */}
            <div className="relative w-full bg-gradient-to-br from-primary-900/40 to-dark-800" style={{ aspectRatio: '16 / 5' }}>
                {c.cover_image_url && <img src={c.cover_image_url} alt="" className="w-full h-full object-cover" />}
                <div className="absolute -bottom-7 left-4 w-14 h-14"><Avatar url={c.profile_picture_url} name={c.display_name} ring /></div>
            </div>
            <div className="pt-9 px-4 pb-4">
                <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-white truncate">{c.display_name}</h3>
                    {c.verified && <BadgeCheck className="w-4 h-4 text-primary-400 shrink-0" />}
                </div>
                {c.username && <p className="text-xs text-white/40">@{c.username}</p>}
                <div className="flex items-center gap-2 mt-2">
                    {c.category && <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/5 text-white/60">{c.category}</span>}
                    {c.review_count > 0 && (
                        <span className="flex items-center gap-1 text-xs text-white/70">
                            <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" /> {c.avg_rating.toFixed(1)} · {c.review_count} reviews
                        </span>
                    )}
                </div>
                <div className="mt-3 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold text-white">From ₹{fmt(c.starting_price)}</p>
                        <p className="text-[11px] text-white/40 flex items-center gap-1"><Clock className="w-3 h-3" /> Delivers in {c.min_delivery_days} {c.min_delivery_days === 1 ? 'day' : 'days'}</p>
                    </div>
                </div>
                <div className="mt-3"><Languages langs={c.languages} /></div>
                <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/book/${c.id}`); }}
                    className="mt-4 w-full px-4 py-2.5 rounded-full bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors"
                >
                    Book Now
                </button>
            </div>
        </div>
    );
}

function ListRow({ c }: { c: ExploreCreator }) {
    const navigate = useNavigate();
    return (
        <div onClick={() => navigate(`/creator/${c.id}`)}
            className="rounded-2xl border border-white/10 bg-dark-900 p-4 cursor-pointer hover:border-white/25 transition flex gap-4">
            <div className="w-20 h-20 shrink-0"><Avatar url={c.profile_picture_url} name={c.display_name} /></div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-white truncate">{c.display_name}</h3>
                    {c.verified && <BadgeCheck className="w-4 h-4 text-primary-400 shrink-0" />}
                </div>
                {c.username && <p className="text-xs text-white/40">@{c.username}</p>}
                <div className="flex items-center gap-2 mt-1">
                    {c.category && <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/5 text-white/60">{c.category}</span>}
                    {c.review_count > 0 && (
                        <span className="flex items-center gap-1 text-xs text-white/70"><Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" /> {c.avg_rating.toFixed(1)} · {c.review_count}</span>
                    )}
                </div>
                {c.bio && <p className="mt-1.5 text-sm text-white/50 line-clamp-2">{c.bio}</p>}
                <div className="mt-1.5"><Languages langs={c.languages} /></div>
            </div>
            <div className="shrink-0 text-right flex flex-col items-end justify-between">
                <div>
                    <p className="text-sm font-bold text-white">From ₹{fmt(c.starting_price)}</p>
                    <p className="text-[11px] text-white/40 flex items-center gap-1 justify-end"><Clock className="w-3 h-3" /> {c.min_delivery_days}d</p>
                </div>
                <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/book/${c.id}`); }}
                    className="px-4 py-2 rounded-full bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors"
                >
                    Book Now
                </button>
            </div>
        </div>
    );
}

function SkeletonCard({ view }: { view: 'grid' | 'list' }) {
    if (view === 'list') {
        return (
            <div className="rounded-2xl border border-white/10 bg-dark-900 p-4 flex gap-4 animate-pulse">
                <div className="w-20 h-20 rounded-full bg-white/5 shrink-0" />
                <div className="flex-1 space-y-2"><div className="h-4 w-1/3 bg-white/5 rounded" /><div className="h-3 w-1/4 bg-white/5 rounded" /><div className="h-3 w-3/4 bg-white/5 rounded" /></div>
                <div className="w-20 space-y-2"><div className="h-4 bg-white/5 rounded" /><div className="h-8 bg-white/5 rounded-full" /></div>
            </div>
        );
    }
    return (
        <div className="rounded-2xl border border-white/10 bg-dark-900 overflow-hidden animate-pulse">
            <div className="w-full bg-white/5" style={{ aspectRatio: '16 / 5' }} />
            <div className="pt-9 px-4 pb-4 space-y-2">
                <div className="h-4 w-1/2 bg-white/5 rounded" />
                <div className="h-3 w-1/3 bg-white/5 rounded" />
                <div className="h-8 w-full bg-white/5 rounded-full mt-4" />
            </div>
        </div>
    );
}
