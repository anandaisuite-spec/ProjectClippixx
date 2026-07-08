import { createContext, useContext, useState, useEffect, lazy, Suspense, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';

// ─── Lazy-loaded modal components ────────────────────────────────────────────
const BrowseStars = lazy(() => import("@/features/home/components/BrowseStars"));
const SuggestStarForm = lazy(() => import("@/features/suggest-star/components/SuggestStarForm"));
const FeedbackForm = lazy(() => import("@/features/feedback/components/FeedbackForm"));
const CreatorApplicationForm = lazy(() => import("@/features/creator/components/CreatorApplicationForm"));
const LoginModal = lazy(() => import("@/features/auth/components/LoginModal"));
const SearchModal = lazy(() => import("@/components/ui/SearchModal"));
const PolicyModal = lazy(() => import("@/features/policy/PolicyModal"));

import type { PolicyKey } from "@/pages/policy/policyContent";

// ─── Context type ────────────────────────────────────────────────────────────
type ModalContextType = {
    // Login / Signup
    openLogin: () => void;
    openSignup: () => void;
    closeLogin: () => void;

    // Search
    openSearch: () => void;
    closeSearch: () => void;

    // BrowseStars overlay (home page "View All")
    openBrowseStars: () => void;
    closeBrowseStars: () => void;

    // Suggest a Star form
    openSuggestStar: () => void;
    closeSuggestStar: () => void;

    // Feedback form
    openFeedback: () => void;
    closeFeedback: () => void;

    // Creator application form
    openCreatorApplication: () => void;
    closeCreatorApplication: () => void;

    // Policy modal (Terms / Privacy / Refunds) — footer popups
    openPolicy: (policy: PolicyKey) => void;
    closePolicy: () => void;
};

const ModalContext = createContext<ModalContextType | null>(null);

export function useModals() {
    const context = useContext(ModalContext);
    if (!context) {
        throw new Error('useModals must be used within a ModalProvider');
    }
    return context;
}

// ─── Provider ────────────────────────────────────────────────────────────────
type ModalProviderProps = {
    children: ReactNode;
};

// Every modal owned by this provider. Only ONE may be active at a time, so
// opening any modal implicitly closes whatever was open before.
type ActiveModal =
    | 'login'
    | 'search'
    | 'browseStars'
    | 'suggestStar'
    | 'feedback'
    | 'creatorApplication'
    | 'policy'
    | null;

export default function ModalProvider({ children }: ModalProviderProps) {
    const location = useLocation();

    // ─── Modal state ─────────────────────────────────────────────────────────
    // Single source of truth: at most one modal open at any moment. Setting this
    // to a new value automatically "closes" the previously open modal.
    const [activeModal, setActiveModal] = useState<ActiveModal>(null);
    // Auxiliary state for modals that need a sub-mode/argument.
    const [loginMode, setLoginMode] = useState<'login' | 'signup'>('login');
    const [policy, setPolicy] = useState<PolicyKey | null>(null);

    // Close only the modal named — no-op if a different one is already open, so a
    // stale modal's onClose can't clobber a newer one.
    const closeIf = (name: Exclude<ActiveModal, null>) =>
        setActiveModal((cur) => (cur === name ? null : cur));

    // Close non-auth modals on route change (safety net).
    // Login modal is intentionally excluded — logout opens it after navigate('/').
    useEffect(() => {
        setActiveModal((cur) => (cur === 'login' ? cur : null));
        setPolicy(null);
    }, [location.pathname]);

    // ─── Context value ───────────────────────────────────────────────────────
    const value: ModalContextType = {
        openLogin: () => { setLoginMode('login'); setActiveModal('login'); },
        openSignup: () => { setLoginMode('signup'); setActiveModal('login'); },
        closeLogin: () => closeIf('login'),

        openSearch: () => setActiveModal('search'),
        closeSearch: () => closeIf('search'),

        openBrowseStars: () => setActiveModal('browseStars'),
        closeBrowseStars: () => closeIf('browseStars'),

        openSuggestStar: () => setActiveModal('suggestStar'),
        closeSuggestStar: () => closeIf('suggestStar'),

        openFeedback: () => setActiveModal('feedback'),
        closeFeedback: () => closeIf('feedback'),

        openCreatorApplication: () => setActiveModal('creatorApplication'),
        closeCreatorApplication: () => closeIf('creatorApplication'),

        openPolicy: (p: PolicyKey) => { setPolicy(p); setActiveModal('policy'); },
        closePolicy: () => { setPolicy(null); closeIf('policy'); },
    };

    return (
        <ModalContext.Provider value={value}>
            {children}

            {/* ─── All modals rendered here — overlays any page ─────────────── */}
            <AnimatePresence>
                {activeModal === 'browseStars' && (
                    <Suspense fallback={null}>
                        <BrowseStars onClose={() => closeIf('browseStars')} />
                    </Suspense>
                )}
            </AnimatePresence>

            <Suspense fallback={null}>
                <SuggestStarForm
                    isOpen={activeModal === 'suggestStar'}
                    onClose={() => closeIf('suggestStar')}
                />
            </Suspense>

            <Suspense fallback={null}>
                <FeedbackForm
                    isOpen={activeModal === 'feedback'}
                    onClose={() => closeIf('feedback')}
                />
            </Suspense>

            <Suspense fallback={null}>
                <CreatorApplicationForm
                    isOpen={activeModal === 'creatorApplication'}
                    onClose={() => closeIf('creatorApplication')}
                />
            </Suspense>

            <Suspense fallback={null}>
                <LoginModal
                    isOpen={activeModal === 'login'}
                    onClose={() => closeIf('login')}
                    initialMode={loginMode}
                />
            </Suspense>

            <Suspense fallback={null}>
                <SearchModal
                    isOpen={activeModal === 'search'}
                    onClose={() => closeIf('search')}
                />
            </Suspense>

            <Suspense fallback={null}>
                <PolicyModal policy={activeModal === 'policy' ? policy : null} onClose={() => { setPolicy(null); closeIf('policy'); }} />
            </Suspense>
        </ModalContext.Provider>
    );
}
