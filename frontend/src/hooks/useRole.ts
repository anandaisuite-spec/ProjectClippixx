import { useState, useEffect, useRef } from 'react';
import { getMyProfile } from "@/services/api";
import { useAuth } from "@/providers/AuthProvider";
import type { UserRole } from "@/services/api";

type AccountType = 'fan' | 'creator';

const roleClientCache = new Map<string, { role: UserRole; accountType: AccountType; cachedAt: number }>();
const CLIENT_TTL_MS = 5 * 60 * 1000;

export function invalidateRoleClientCache(uid: string) {
    roleClientCache.delete(uid);
}

/** Returns the canonical home route for a given role. */
export function defaultDashboardFor(role: UserRole): string {
    if (role === 'super_admin') return '/superadmin';
    if (role === 'admin') return '/admin';
    return '/dashboard';
}

export function useRole() {
    const { user, loading: authLoading } = useAuth();
    const [role, setRole] = useState<UserRole>('user');
    const [accountType, setAccountType] = useState<AccountType>('fan');
    const [loading, setLoading] = useState(true);
    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    useEffect(() => {
        if (authLoading) return;

        if (!user) {
            setRole('user');
            setAccountType('fan');
            setLoading(false);
            return;
        }

        const cached = roleClientCache.get(user.uid);
        if (cached && Date.now() - cached.cachedAt < CLIENT_TTL_MS) {
            setRole(cached.role);
            setAccountType(cached.accountType);
            setLoading(false);
            return;
        }

        let cancelled = false;
        setLoading(true);

        getMyProfile()
            .then((profile) => {
                if (cancelled || !isMounted.current) return;
                const r = (profile.role as UserRole) || 'user';
                const at = (profile.account_type as AccountType) || 'fan';
                roleClientCache.set(user.uid, { role: r, accountType: at, cachedAt: Date.now() });
                setRole(r);
                setAccountType(at);
            })
            .catch((err) => {
                console.error('Failed to fetch role:', err);
                if (!cancelled && isMounted.current) {
                    setRole('user');
                    setAccountType('fan');
                }
            })
            .finally(() => {
                if (!cancelled && isMounted.current) setLoading(false);
            });

        return () => { cancelled = true; };
    }, [user, authLoading]);

    return {
        role,
        accountType,
        /** True ONLY for role === 'admin'. Does NOT include super_admin. */
        isAdmin: role === 'admin',
        /** True ONLY for role === 'super_admin'. */
        isSuperAdmin: role === 'super_admin',
        /** True for any authenticated non-guest user. */
        isUser: role === 'user',
        isCreator: accountType === 'creator',
        /** The correct dashboard path for this role. */
        defaultDashboard: defaultDashboardFor(role),
        loading: loading || authLoading,
    };
}
