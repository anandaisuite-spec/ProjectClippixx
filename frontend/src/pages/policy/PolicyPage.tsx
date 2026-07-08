import { useEffect, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

type PolicyPageProps = {
    title: string;
    children: ReactNode;
};

/**
 * Reusable layout for the legal/policy pages (Terms, Privacy, Refunds).
 * Centered, max-width 800px, themed for light + dark, mobile responsive.
 */
export default function PolicyPage({ title, children }: PolicyPageProps) {
    const navigate = useNavigate();
    const { hash } = useLocation();

    // Smooth-scroll to an anchored section when the URL has a hash (e.g.
    // /privacy#cookies). Runs after content renders.
    useEffect(() => {
        if (!hash) return;
        const el = document.getElementById(hash.slice(1));
        if (el) {
            // next tick so the element is in the DOM
            requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }));
        }
    }, [hash]);

    return (
        <div className="min-h-screen bg-white dark:bg-dark-950 pt-24 pb-16 px-4 sm:px-6">
            <div className="max-w-[800px] mx-auto">
                {/* Back button */}
                <button
                    onClick={() => navigate(-1)}
                    className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-dark-400 hover:text-gray-900 dark:hover:text-white transition-colors mb-8"
                >
                    <ArrowLeft className="w-4 h-4" /> Back
                </button>

                {/* Title + last updated */}
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">{title}</h1>
                <p className="mt-2 text-sm text-gray-500 dark:text-dark-400">Last updated: June 2026</p>

                {/* Content */}
                <div
                    className="mt-8 text-gray-700 dark:text-dark-300"
                    style={{ fontSize: '16px', lineHeight: 1.8 }}
                >
                    {children}
                </div>

                {/* Footer */}
                <div className="mt-16 pt-6 border-t border-gray-200 dark:border-white/10 text-sm text-gray-500 dark:text-dark-400">
                    © 2026 Clipixx. All rights reserved.
                </div>
            </div>
        </div>
    );
}

// ─── Prose helpers (shared across the policy pages) ──────────────────────────

/** A section heading + its body. `id` enables anchor links (e.g. #cookies). */
export function Section({ heading, id, children }: { heading: string; id?: string; children: ReactNode }) {
    return (
        <section id={id} className="mt-8 first:mt-0 scroll-mt-24">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{heading}</h2>
            {children}
        </section>
    );
}

export function Para({ children }: { children: ReactNode }) {
    return <p className="mb-4">{children}</p>;
}

/** Numbered list with consistent spacing. */
export function NumberedList({ items }: { items: ReactNode[] }) {
    return (
        <ol className="list-decimal pl-6 space-y-3 mb-4">
            {items.map((item, i) => (
                <li key={i}>{item}</li>
            ))}
        </ol>
    );
}
