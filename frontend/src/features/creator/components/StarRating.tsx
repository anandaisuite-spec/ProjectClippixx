import { useState } from 'react';
import { Star } from 'lucide-react';

type StarRatingProps = {
    value: number;                   // 0–5, may be decimal in read-only mode
    onChange?: (v: number) => void;  // when provided → interactive selector
    size?: 'sm' | 'md' | 'lg';
    showValue?: boolean;
};

const SIZE_PX = { sm: 14, md: 18, lg: 24 } as const;

export default function StarRating({ value, onChange, size = 'md', showValue = false }: StarRatingProps) {
    const [hover, setHover] = useState<number | null>(null);
    const px = SIZE_PX[size];
    const interactive = typeof onChange === 'function';

    // In interactive mode, the displayed fill follows hover (preview) then value.
    const display = interactive && hover !== null ? hover : value;

    return (
        <div className="inline-flex items-center gap-1.5">
            <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => {
                    const starIndex = i + 1;
                    const filled = display >= starIndex;
                    const half = !filled && display >= starIndex - 0.5;

                    const iconClass = filled || half ? 'text-yellow-400' : 'text-white/20 dark:text-white/20';

                    const star = (
                        <span className="relative inline-block" style={{ width: px, height: px }}>
                            {/* base (empty) */}
                            <Star className="absolute inset-0" style={{ width: px, height: px }} />
                            {/* fill overlay — full or half width */}
                            {(filled || half) && (
                                <span
                                    className="absolute inset-0 overflow-hidden"
                                    style={{ width: half ? px / 2 : px }}
                                >
                                    <Star
                                        className="text-yellow-400"
                                        fill="currentColor"
                                        style={{ width: px, height: px }}
                                    />
                                </span>
                            )}
                        </span>
                    );

                    if (!interactive) {
                        return (
                            <span key={i} className={iconClass}>
                                {star}
                            </span>
                        );
                    }

                    return (
                        <button
                            key={i}
                            type="button"
                            onClick={() => onChange!(starIndex)}
                            onMouseEnter={() => setHover(starIndex)}
                            onMouseLeave={() => setHover(null)}
                            className={`${iconClass} transition-transform hover:scale-110`}
                            aria-label={`Rate ${starIndex} star${starIndex > 1 ? 's' : ''}`}
                        >
                            {star}
                        </button>
                    );
                })}
            </div>
            {showValue && (
                <span className="text-sm font-medium text-white/80">{Number(value).toFixed(1)}</span>
            )}
        </div>
    );
}
