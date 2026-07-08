import { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, Star, ArrowRight } from 'lucide-react';
import Button from '@/components/ui/Button';
import { fetchStars, type Star as StarType } from "@/services/api";

type ShowcaseProps = {
  onViewAll?: () => void;
};

// Static fallback shown when the API returns no featured stars (e.g. backend
// offline or none flagged featured), so the section is never empty.
const FEATURED_FALLBACK: StarType[] = [
  { id: 'f1', name: 'Alex Sterling', category: 'Actor',    image_url: 'https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=600', rating: 4.9, reviews_count: 2840, price: 199, is_featured: true, bio: '', created_at: '' },
  { id: 'f2', name: 'Jordan Blake',  category: 'Athlete',  image_url: 'https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg?auto=compress&cs=tinysrgb&w=600', rating: 5.0, reviews_count: 1256, price: 299, is_featured: true, bio: '', created_at: '' },
  { id: 'f3', name: 'Mia Chen',      category: 'Creator',  image_url: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=600', rating: 4.8, reviews_count: 4521, price: 99,  is_featured: true, bio: '', created_at: '' },
  { id: 'f4', name: 'David Park',    category: 'Musician', image_url: 'https://images.pexels.com/photos/1212984/pexels-photo-1212984.jpeg?auto=compress&cs=tinysrgb&w=600', rating: 4.9, reviews_count: 892,  price: 249, is_featured: true, bio: '', created_at: '' },
];

export default function Showcase({ onViewAll }: ShowcaseProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const [stars, setStars] = useState<StarType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStars({ featured: true })
      .then((data) => setStars(data))
      .catch((err) => console.error('Failed to fetch featured stars:', err))
      .finally(() => setLoading(false));
  }, []);

  // Use live featured stars when available; otherwise show the static fallback.
  const displayStars = stars.length > 0 ? stars : FEATURED_FALLBACK;

  return (
    <section
      ref={sectionRef}
      id="organisations"
      className="relative py-24 md:py-32"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-primary-950/5 via-transparent to-primary-950/5" />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-block px-5 py-1.5 text-lg font-bold tracking-wider uppercase section-pill-oval rounded-full mb-6">
            Featured Stars
          </span>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6">
            Meet our{' '}
            <span className="gradient-italic">trending</span>{' '}
            celebrities
          </h2>
          <p className="text-lg text-gray-600 dark:text-dark-400 max-w-2xl mx-auto mb-8">
            Discover the most requested stars on our platform and book your
            personalized video today.
          </p>
          {onViewAll && (
            <Button onClick={onViewAll} variant="outline">
              <span className="flex items-center gap-2">
                View All Stars
                <ArrowRight className="w-4 h-4" />
              </span>
            </Button>
          )}
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="relative rounded-2xl overflow-hidden bg-white dark:bg-dark-900 shadow-lg dark:shadow-none animate-pulse">
                <div className="aspect-[3/4] bg-gray-200 dark:bg-dark-800" />
              </div>
            ))
          ) : (
            displayStars.map((star, index) => (
              <motion.div
                key={star.id}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                whileHover={{ y: -12 }}
                className="group relative"
              >
                <div className="relative rounded-2xl overflow-hidden bg-white dark:bg-dark-900 shadow-lg dark:shadow-none">
                  <div className="aspect-[3/4] overflow-hidden">
                    <img
                      src={star.image_url}
                      alt={star.name}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900 dark:from-dark-950 via-gray-900/20 dark:via-dark-950/20 to-transparent" />
                  </div>

                  <div className="absolute top-4 right-4">
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/90 dark:bg-dark-900/80 backdrop-blur-sm">
                      <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                      <span className="text-xs font-medium text-gray-900 dark:text-white">
                        {star.rating}
                      </span>
                    </div>
                  </div>

                  <motion.button
                    initial={{ x: '-50%', y: '-50%', scale: 1 }}
                    whileHover={{ x: '-50%', y: '-50%', scale: 1.1 }}
                    whileTap={{ x: '-50%', y: '-50%', scale: 0.95 }}
                    className="absolute top-1/2 left-1/2 w-16 h-16 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  >
                    <Play className="w-6 h-6 text-white fill-white ml-1" />
                  </motion.button>

                  <div className="absolute bottom-0 left-0 right-0 p-5">
                    <span className="text-xs font-medium text-primary-400 uppercase tracking-wider">
                      {star.category}
                    </span>
                    <h3 className="text-xl font-bold text-white mt-1 mb-2">
                      {star.name}
                    </h3>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-300 dark:text-dark-400">
                        {star.reviews_count.toLocaleString()} reviews
                      </span>
                      <span className="text-lg font-bold text-white">
                        ₹{star.price.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )))}
        </div>
      </div>
    </section>
  );
}
