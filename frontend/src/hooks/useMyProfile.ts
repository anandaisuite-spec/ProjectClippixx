import { useState, useEffect } from 'react';
import { getMyProfile, type Profile } from '@/services/api';
import { useAuth } from '@/providers/AuthProvider';

/**
 * Shared, subscribed cache of the logged-in user's profile.
 *
 * Multiple components (navbar, dashboard sidebar, settings) can call
 * useMyProfile() and they all share ONE fetch + ONE cache. When any caller
 * pushes an update via updateMyProfileCache() (e.g. after an avatar upload),
 * every subscribed component re-renders immediately — no page refresh, no
 * refetch.
 */

let cachedProfile: Profile | null = null;
let cachedUid: string | null = null;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
    listeners.forEach((l) => l());
}

/** Merge updated fields into the shared profile (e.g. { avatar_url }) and notify all subscribers. */
export function updateMyProfileCache(patch: Partial<Profile>) {
    if (!cachedProfile) return;
    cachedProfile = { ...cachedProfile, ...patch };
    emit();
}

/** Drop the cache (e.g. on logout); subscribers fall back to null. */
export function clearMyProfileCache() {
    cachedProfile = null;
    cachedUid = null;
    emit();
}

export function useMyProfile(): Profile | null {
    const { user } = useAuth();
    const [, force] = useState(0);

    // Subscribe to cache updates.
    useEffect(() => {
        const listener = () => force((n) => n + 1);
        listeners.add(listener);
        return () => { listeners.delete(listener); };
    }, []);

    // Populate the cache once per signed-in user (deduped across subscribers).
    useEffect(() => {
        if (!user) {
            if (cachedProfile || cachedUid) clearMyProfileCache();
            return;
        }
        if (cachedUid === user.uid && cachedProfile) return;
        if (!inflight) {
            inflight = getMyProfile()
                .then((p) => { cachedProfile = p; cachedUid = user.uid; emit(); })
                .catch(() => { /* non-critical — components keep their fallbacks */ })
                .finally(() => { inflight = null; });
        }
    }, [user]);

    return user && cachedUid === user.uid ? cachedProfile : null;
}
