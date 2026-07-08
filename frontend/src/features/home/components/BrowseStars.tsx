import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Play, Search, SlidersHorizontal, X, ChevronDown } from 'lucide-react';
import { fetchStars as fetchStarsApi, type Star as StarType } from "@/services/api";
import Button from '@/components/ui/Button';

const categories = ['All', 'Actor', 'Athlete', 'Creator', 'Musician'];
const priceRanges = [
  { label: 'All Prices', min: 0, max: Infinity },
  { label: 'Under ₹100', min: 0, max: 99 },
  { label: '₹100 - ₹200', min: 100, max: 200 },
  { label: '₹200 - ₹300', min: 200, max: 300 },
  { label: '₹300+', min: 300, max: Infinity },
];
const ratingOptions = [
  { label: 'All Ratings', value: 0 },
  { label: '4.5+ Stars', value: 4.5 },
  { label: '4.7+ Stars', value: 4.7 },
  { label: '4.9+ Stars', value: 4.9 },
];
const sortOptions = [
  { label: 'Most Popular', value: 'reviews_count' },
  { label: 'Highest Rated', value: 'rating' },
  { label: 'Price: Low to High', value: 'price_asc' },
  { label: 'Price: High to Low', value: 'price_desc' },
  { label: 'Newest', value: 'created_at' },
];

type BrowseStarsProps = {
  onClose: () => void;
};

export default function BrowseStars({ onClose }: BrowseStarsProps) {
  const [stars, setStars] = useState<StarType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedPriceRange, setSelectedPriceRange] = useState(priceRanges[0]);
  const [selectedRating, setSelectedRating] = useState(ratingOptions[0]);
  const [selectedSort, setSelectedSort] = useState(sortOptions[0]);
  const [showFilters, setShowFilters] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  useEffect(() => {
    fetchStars();
    // fetchStars reads only the filter state below; re-run when those change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, selectedPriceRange, selectedRating, selectedSort]);

  const fetchStars = async () => {
    setLoading(true);
    try {
      const sortValue = selectedSort.value;
      const sort = sortValue === 'price_asc' || sortValue === 'price_desc' ? 'price' : sortValue;
      const order = sortValue === 'price_asc' ? 'asc' : 'desc';

      let data = await fetchStarsApi({ category: selectedCategory, sort, order });

      if (selectedPriceRange.max !== Infinity || selectedPriceRange.min > 0) {
        data = data.filter(
          (star) => star.price >= selectedPriceRange.min && star.price <= selectedPriceRange.max
        );
      }
      if (selectedRating.value > 0) {
        data = data.filter((star) => star.rating >= selectedRating.value);
      }

      setStars(data);
    } catch (error) {
      console.error('Error fetching stars:', error);
    }
    setLoading(false);
  };

  const filteredStars = stars.filter((star) =>
    star.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const clearFilters = () => {
    setSelectedCategory('All');
    setSelectedPriceRange(priceRanges[0]);
    setSelectedRating(ratingOptions[0]);
    setSearchQuery('');
  };

  const hasActiveFilters =
    selectedCategory !== 'All' ||
    selectedPriceRange !== priceRanges[0] ||
    selectedRating !== ratingOptions[0] ||
    searchQuery !== '';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      // z-[99] sits below the main nav (z-[100]) so the nav remains visible on top
      className="fixed inset-0 z-[99] bg-dark-950 flex flex-col overflow-hidden"
    >
      {/* Spacer so content starts below the fixed main nav (~72px tall) */}
      <div className="flex-shrink-0 h-[72px]" />

      {/* Search / filter bar */}
      <div className="flex-shrink-0 bg-dark-950 border-b border-white/10 shadow-md">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-4">
          {/* Title row */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={onClose}
              className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
            >
              <span className="text-sm font-medium">← Back</span>
            </button>
            <h1 className="text-2xl font-bold text-white">Browse Stars</h1>
            <div className="w-20" />
          </div>

          {/* Search + sort row */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
              <input
                type="text"
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-dark-900 border border-white/10 rounded-xl text-white placeholder-dark-400 focus:outline-none focus:border-primary-500 transition-colors"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-colors ${
                  showFilters || hasActiveFilters
                    ? 'bg-primary-500/10 border-primary-500 text-primary-400'
                    : 'bg-dark-900 border-white/10 text-white hover:border-white/20'
                }`}
              >
                <SlidersHorizontal className="w-5 h-5" />
                <span className="hidden sm:inline">Filters</span>
                {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-primary-500" />}
              </button>

              <div className="relative">
                <button
                  onClick={() => setShowSortDropdown(!showSortDropdown)}
                  className="flex items-center gap-2 px-4 py-3 bg-dark-900 border border-white/10 rounded-xl text-white hover:border-white/20 transition-colors"
                >
                  <span className="hidden sm:inline">{selectedSort.label}</span>
                  <span className="sm:hidden">Sort</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showSortDropdown ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {showSortDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute right-0 top-full mt-2 w-48 bg-dark-900 border border-white/10 rounded-xl overflow-hidden shadow-xl z-20"
                    >
                      {sortOptions.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => { setSelectedSort(option); setShowSortDropdown(false); }}
                          className={`w-full px-4 py-3 text-left text-sm transition-colors ${
                            selectedSort.value === option.value
                              ? 'bg-primary-500/10 text-primary-400'
                              : 'text-white hover:bg-white/5'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Expandable filters */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-6 pb-2 space-y-6">
                  <div>
                    <h3 className="text-sm font-medium text-dark-400 mb-3">Category</h3>
                    <div className="flex flex-wrap gap-2">
                      {categories.map((category) => (
                        <button
                          key={category}
                          onClick={() => setSelectedCategory(category)}
                          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                            selectedCategory === category
                              ? 'bg-primary-500 text-white'
                              : 'bg-dark-800 text-dark-300 hover:bg-dark-700'
                          }`}
                        >
                          {category}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-sm font-medium text-dark-400 mb-3">Price Range</h3>
                      <div className="flex flex-wrap gap-2">
                        {priceRanges.map((range) => (
                          <button
                            key={range.label}
                            onClick={() => setSelectedPriceRange(range)}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                              selectedPriceRange === range
                                ? 'bg-primary-500 text-white'
                                : 'bg-dark-800 text-dark-300 hover:bg-dark-700'
                            }`}
                          >
                            {range.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-dark-400 mb-3">Minimum Rating</h3>
                      <div className="flex flex-wrap gap-2">
                        {ratingOptions.map((option) => (
                          <button
                            key={option.label}
                            onClick={() => setSelectedRating(option)}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                              selectedRating === option
                                ? 'bg-primary-500 text-white'
                                : 'bg-dark-800 text-dark-300 hover:bg-dark-700'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="flex items-center gap-2 text-sm text-primary-400 hover:text-primary-300 transition-colors"
                    >
                      <X className="w-4 h-4" />
                      Clear all filters
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Scrollable star grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-[3/4] bg-dark-800 rounded-2xl" />
                </div>
              ))}
            </div>
          ) : filteredStars.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-xl text-dark-400 mb-4">No stars found</p>
              <p className="text-dark-500 mb-6">Try adjusting your filters or search query</p>
              {hasActiveFilters && (
                <Button variant="outline" onClick={clearFilters}>Clear Filters</Button>
              )}
            </div>
          ) : (
            <>
              <p className="text-sm text-dark-400 mb-6">
                {filteredStars.length} {filteredStars.length === 1 ? 'star' : 'stars'} found
              </p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {filteredStars.map((star, index) => (
                  <motion.div
                    key={star.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className="relative"
                  >
                    <div className="relative rounded-2xl overflow-hidden glass-card">
                      <div className="aspect-[3/4] overflow-hidden">
                        <img
                          src={star.image_url}
                          alt={star.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0b1630] via-[#0b1630]/20 to-transparent" />
                      </div>

                      <div className="absolute top-4 right-4">
                        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
                          <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                          <span className="text-xs font-medium text-white">{star.rating}</span>
                        </div>
                      </div>

                      <motion.button className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center opacity-100">
                        <Play className="w-6 h-6 text-white fill-white ml-1" />
                      </motion.button>

                      <div className="absolute bottom-0 left-0 right-0 p-5">
                        <span className="text-xs font-medium text-blue-100 uppercase tracking-wider">
                          {star.category}
                        </span>
                        <h3 className="text-xl font-bold text-white mt-1 mb-2">{star.name}</h3>
                        <div className="flex items-center justify-between">
                          <span className="text-sm glass-card-muted">
                            {star.reviews_count.toLocaleString()} reviews
                          </span>
                          <span className="text-lg font-bold text-white">₹{star.price.toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
