import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { POLICY_TITLES, POLICY_CONTENT, type PolicyKey } from '@/pages/policy/policyContent';

type PolicyModalProps = {
    policy: PolicyKey | null;
    onClose: () => void;
};

/**
 * Footer policy links open here as a centered card (instead of navigating to the
 * full page). Reuses the shared policy content — single source of truth. The
 * /terms /privacy /refunds routes still exist for direct/shareable URLs.
 */
export default function PolicyModal({ policy, onClose }: PolicyModalProps) {
    return (
        <AnimatePresence>
            {policy && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[200] flex items-center justify-center p-4"
                >
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-gray-100/90 dark:bg-dark-950/90 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-2xl max-h-[85vh] flex flex-col bg-white dark:bg-dark-900 rounded-2xl border border-gray-200 dark:border-white/10 shadow-2xl overflow-hidden"
                    >
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-500 via-cyan-500 to-primary-500" />

                        {/* Header */}
                        <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-100 dark:border-white/10">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                {POLICY_TITLES[policy]}
                            </h2>
                            <button
                                onClick={onClose}
                                aria-label="Close"
                                className="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-500 dark:text-dark-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Scrollable content */}
                        <div
                            className="overflow-y-auto px-6 py-5 text-gray-700 dark:text-dark-300"
                            style={{ fontSize: '15px', lineHeight: 1.75 }}
                        >
                            <p className="text-xs text-gray-400 dark:text-dark-500 mb-4">Last updated: June 2026</p>
                            {(() => {
                                const Content = POLICY_CONTENT[policy];
                                return <Content />;
                            })()}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
