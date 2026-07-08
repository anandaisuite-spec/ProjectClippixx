import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type ComingSoonProps = {
    title: string;
    description?: string;
    icon?: LucideIcon;
};

/**
 * Lightweight placeholder for routes whose backend isn't built yet.
 * Keeps menu links live so the navigation has no dead ends.
 */
export default function ComingSoon({ title, description, icon: Icon = Sparkles }: ComingSoonProps) {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-dark-950 pt-24 pb-16 px-4 sm:px-6">
            <div className="max-w-2xl mx-auto">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors mb-8"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                </button>

                <div className="rounded-3xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d1230] p-10 sm:p-14 text-center">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-900/30">
                        <Icon className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="mt-6 text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{title}</h1>
                    <p className="mt-3 text-gray-500 dark:text-gray-400">
                        {description || 'This feature is coming soon. Stay tuned!'}
                    </p>
                    <span className="mt-6 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300">
                        <Sparkles className="w-3 h-3" />
                        Coming soon
                    </span>
                </div>
            </div>
        </div>
    );
}
