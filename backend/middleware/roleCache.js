const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** @type {Map<string, { role: string, expiresAt: number }>} */
const roleMap = new Map();

function getCachedRole(uid) {
    const entry = roleMap.get(uid);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        roleMap.delete(uid);
        return null;
    }
    return entry.role;
}

function setCachedRole(uid, role) {
    roleMap.set(uid, { role, expiresAt: Date.now() + CACHE_TTL_MS });
}

function invalidateCachedRole(uid) {
    roleMap.delete(uid);
}

function cacheSize() {
    return roleMap.size;
}

module.exports = { getCachedRole, setCachedRole, invalidateCachedRole, cacheSize };
