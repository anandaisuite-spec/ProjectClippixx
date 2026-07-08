import { useState } from 'react';
import { Play, X } from 'lucide-react';
import type { GalleryMedia } from '@/services/api-extensions';

/**
 * Public gallery grid for the creator profile.
 * Images render in a grid (3 cols desktop, 2 mobile); videos show a play
 * overlay and open in a lightbox modal. Renders nothing when empty.
 */
export default function ProfileGallery({ items }: { items: GalleryMedia[] }) {
    const [lightbox, setLightbox] = useState<GalleryMedia | null>(null);

    if (!items || items.length === 0) return null;

    return (
        <section>
            <h2 className="text-lg font-bold text-white mb-4">Gallery</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {items.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => setLightbox(item)}
                        className="relative aspect-square rounded-2xl overflow-hidden bg-white/5 group"
                    >
                        {item.media_type === 'video' ? (
                            <>
                                <video src={item.media_url} className="w-full h-full object-cover" />
                                <span className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition">
                                    <span className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                                        <Play className="w-5 h-5 text-gray-900 fill-gray-900 ml-0.5" />
                                    </span>
                                </span>
                            </>
                        ) : (
                            <img src={item.media_url} alt={item.caption || ''} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        )}
                    </button>
                ))}
            </div>

            {/* Lightbox */}
            {lightbox && (
                <div className="fixed inset-0 z-[160] flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                    <button
                        onClick={() => setLightbox(null)}
                        className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    <div className="relative max-w-4xl max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
                        {lightbox.media_type === 'video' ? (
                            <video src={lightbox.media_url} controls autoPlay className="max-w-full max-h-[85vh] rounded-2xl" />
                        ) : (
                            <img src={lightbox.media_url} alt={lightbox.caption || ''} className="max-w-full max-h-[85vh] rounded-2xl object-contain" />
                        )}
                    </div>
                </div>
            )}
        </section>
    );
}
