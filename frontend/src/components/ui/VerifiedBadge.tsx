import { CheckCircle } from 'lucide-react';

type VerifiedBadgeProps = {
    /** Show the "Verified Creator" label text next to the icon. */
    showLabel?: boolean;
    className?: string;
};

const TOOLTIP = 'Identity and social account ownership confirmed by Clippixx';

/**
 * The verified-creator badge. Shown on the browse card, creator detail header,
 * and creator dashboard once an admin has approved the verification request.
 * Hover reveals a tooltip explaining what the badge means.
 */
export default function VerifiedBadge({ showLabel = true, className = '' }: VerifiedBadgeProps) {
    if (!showLabel) {
        return (
            <span
                title={TOOLTIP}
                className={`inline-flex items-center text-emerald-400 ${className}`}
                aria-label="Verified Creator"
            >
                <CheckCircle size={16} />
            </span>
        );
    }

    return (
        <span
            title={TOOLTIP}
            className={`inline-flex items-center gap-1 text-xs font-medium text-emerald-400 border border-emerald-400/30 rounded-full px-2 py-0.5 ${className}`}
        >
            <CheckCircle size={12} /> Verified Creator
        </span>
    );
}
