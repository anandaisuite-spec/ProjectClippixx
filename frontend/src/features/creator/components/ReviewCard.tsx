import type { Review } from '@/services/api-extensions';
import StarRating from './StarRating';
import AvatarPlaceholder from '@/components/ui/AvatarPlaceholder';

type ReviewCardProps = {
    review: Review;
};

function formatDate(value: string): string {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ReviewCard({ review }: ReviewCardProps) {
    const r = {
        name: `${review.first_name} ${review.last_name}`.trim() || 'Anonymous',
        avatarUrl: review.avatar_url || null,
        rating: review.rating,
        text: review.review_text || '',
        date: formatDate(review.created_at),
    };

    return (
        <div className="rounded-2xl border border-white/10 bg-dark-900 p-5">
            <div className="flex items-center gap-3 mb-3">
                <AvatarPlaceholder name={r.name} src={r.avatarUrl} size={40} />
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{r.name}</p>
                    <p className="text-xs text-white/40">{r.date}</p>
                </div>
            </div>

            <div className="mb-2">
                <StarRating value={r.rating} size="sm" />
            </div>

            {r.text && <p className="text-sm text-white/70 leading-relaxed">{r.text}</p>}
        </div>
    );
}
