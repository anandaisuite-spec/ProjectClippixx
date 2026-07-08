import { useState } from 'react';
import { motion } from 'framer-motion';
import { Play } from 'lucide-react';

type CreatorGalleryProps = {
    images: string[];
    name: string;
};

/** Hero gallery: large active image + thumbnail strip (when multiple images). */
export default function CreatorGallery({ images, name }: CreatorGalleryProps) {
    const [active, setActive] = useState(0);
    const safeImages = images.length > 0 ? images : [''];

    return (
        <div className="space-y-3">
            <motion.div
                key={active}
                initial={{ opacity: 0.4 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="relative aspect-[4/5] sm:aspect-square rounded-3xl overflow-hidden border border-white/10"
            >
                <img src={safeImages[active]} alt={name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                <button
                    type="button"
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center hover:scale-110 transition-transform"
                    aria-label="Play preview"
                >
                    <Play className="w-7 h-7 text-white fill-white ml-1" />
                </button>
            </motion.div>

            {safeImages.length > 1 && (
                <div className="flex gap-3">
                    {safeImages.map((img, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => setActive(i)}
                            className={`relative w-20 h-20 rounded-xl overflow-hidden border-2 transition-colors ${
                                active === i ? 'border-primary-500' : 'border-white/10 hover:border-white/30'
                            }`}
                        >
                            <img src={img} alt={`${name} ${i + 1}`} className="w-full h-full object-cover" />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
