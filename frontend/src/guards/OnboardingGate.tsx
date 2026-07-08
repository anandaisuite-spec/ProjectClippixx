import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/providers/AuthProvider';
import { getMyProfile, getOnboardingStatus } from '@/services/api';

/**
 * OnboardingGate
 *
 * After a creator logs in, if they haven't finished onboarding, redirect them
 * to /creator/onboarding. Runs once per authenticated session (per uid) so it
 * doesn't fight manual navigation afterwards.
 *
 * - Only applies to creator accounts (profiles.account_type === 'creator').
 * - Never redirects while already on the onboarding route.
 * - Silent on any error (e.g. non-creator, network) — never blocks the app.
 *
 * Mounted once near the app root; renders nothing.
 */
export default function OnboardingGate() {
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const checkedForUid = useRef<string | null>(null);

    useEffect(() => {
        if (loading || !user) return;
        // Already handled this user this session.
        if (checkedForUid.current === user.uid) return;
        // Don't interfere if they're already in the onboarding flow.
        if (location.pathname.startsWith('/creator/onboarding')) {
            checkedForUid.current = user.uid;
            return;
        }

        let cancelled = false;
        (async () => {
            try {
                const profile = await getMyProfile();
                if (cancelled || profile.account_type !== 'creator') {
                    checkedForUid.current = user.uid;
                    return;
                }
                const status = await getOnboardingStatus();
                if (cancelled) return;
                checkedForUid.current = user.uid;
                if (!status.onboarding_completed) {
                    navigate('/creator/onboarding', { replace: true });
                }
            } catch {
                // Non-creator or transient failure — leave the user where they are.
                if (!cancelled) checkedForUid.current = user.uid;
            }
        })();
        return () => { cancelled = true; };
    }, [user, loading, navigate, location.pathname]);

    return null;
}
