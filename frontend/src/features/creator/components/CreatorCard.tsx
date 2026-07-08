import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Star, Play } from 'lucide-react';
import VerifiedBadge from '@/components/ui/VerifiedBadge';
import type { Creator } from '@/data/creators';

type CreatorCardProps = {
    creator: Creator;
    index?: number;
};

/** Cameo-style creator card — image, play overlay, name, rating, reviews, price. */
export default function CreatorCard({ creator, index = 0 }: CreatorCardProps) {
    const navigate = useNavigate();

    return (
        <motion.button
            type="button"
            onClick={() => navigate(`/creator/${creator.id}`)}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: (index % 8) * 0.05 }}
            whileHover={{ y: -8 }}
            className="group text-left w-full"
        >
            <div className="relative rounded-2xl overflow-hidden bg-dark-900 border border-white/10 shadow-lg transition-shadow duration-300 group-hover:shadow-primary-500/20 group-hover:border-primary-500/40">
                {/* Image */}
                <div className="aspect-[3/4] overflow-hidden">
                    <img
                        src={creator.image_url}
                        alt={creator.name}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0b1630] via-[#0b1630]/20 to-transparent" />
                </div>

                {/* Rating chip */}
                <div className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm border border-white/15">
                    <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                    <span className="text-xs font-medium text-white">{Number(creator.rating).toFixed(1)}</span>
                </div>

                {/* Play overlay */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <Play className="w-6 h-6 text-white fill-white ml-1" />
                </div>

                {/* Meta */}
                <div className="absolute bottom-0 left-0 right-0 p-4">
                    <span className="text-[11px] font-medium text-primary-300 uppercase tracking-wider">{creator.category}</span>
                    <h3 className="flex items-center gap-1 text-lg font-bold text-white mt-0.5 mb-2">
                        {creator.name}
                        {creator.is_verified && <VerifiedBadge showLabel={false} className="shrink-0" />}
                    </h3>
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-white/60">{creator.reviews_count.toLocaleString()} reviews</span>
                        <span className="text-sm font-bold text-white">
                            <span className="text-white/60 font-normal">from </span>₹{creator.price.toLocaleString('en-IN')}
                        </span>
                    </div>
                </div>
            </div>
        </motion.button>
    );
}
