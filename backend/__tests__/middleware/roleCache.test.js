require('../setup');

// Fresh require each test to reset module-level Map
beforeEach(() => jest.resetModules());

describe('roleCache', () => {
    it('getCachedRole returns null on miss', () => {
        const { getCachedRole } = require('../../middleware/roleCache');
        expect(getCachedRole('unknown-uid')).toBeNull();
    });

    it('setCachedRole then getCachedRole returns the role', () => {
        const { getCachedRole, setCachedRole } = require('../../middleware/roleCache');
        setCachedRole('uid-1', 'admin');
        expect(getCachedRole('uid-1')).toBe('admin');
    });

    it('invalidateCachedRole removes the entry', () => {
        const { getCachedRole, setCachedRole, invalidateCachedRole } = require('../../middleware/roleCache');
        setCachedRole('uid-2', 'super_admin');
        invalidateCachedRole('uid-2');
        expect(getCachedRole('uid-2')).toBeNull();
    });

    it('expired entry returns null and is deleted', () => {
        jest.useFakeTimers();
        const { getCachedRole, setCachedRole, cacheSize } = require('../../middleware/roleCache');
        setCachedRole('uid-3', 'user');
        expect(getCachedRole('uid-3')).toBe('user');

        // Advance time past 5 minute TTL
        jest.advanceTimersByTime(6 * 60 * 1000);

        expect(getCachedRole('uid-3')).toBeNull();
        expect(cacheSize()).toBe(0);
        jest.useRealTimers();
    });
});
