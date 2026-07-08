import type { Creator } from '@/data/creators';
import CreatorCard from './CreatorCard';

type CreatorGridProps = {
    creators: Creator[];
};

/** Responsive grid of CreatorCards. */
export default function CreatorGrid({ creators }: CreatorGridProps) {
    if (creators.length === 0) {
        return (
            <div className="text-center py-20">
                <p className="text-xl text-white/60">No creators found</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 sm:gap-6">
            {creators.map((creator, i) => (
                <CreatorCard key={creator.id} creator={creator} index={i} />
            ))}
        </div>
    );
}
