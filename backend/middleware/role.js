const pool = require('../config/db');
const { getCachedRole, setCachedRole, invalidateCachedRole } = require('./roleCache');

/**
 * Middleware factory to restrict access to specific roles.
 * Must run AFTER verifyToken so req.user is populated.
 * Checks in-memory cache first; falls back to DB on cache miss.
 * @param {string[]} allowedRoles
 */
const requireRole = (allowedRoles) => {
    return async (req, res, next) => {
        try {
            const uid = req.user?.uid;
            if (!uid) {
                return res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
            }

            let userRole = getCachedRole(uid);

            if (!userRole) {
                const result = await pool.query(
                    'SELECT role FROM profiles WHERE id = $1',
                    [uid]
                );
                if (result.rows.length === 0) {
                    return res.status(404).json({ error: 'Not Found', message: 'User profile not found' });
                }
                userRole = result.rows[0].role;
                setCachedRole(uid, userRole);
            }

            if (userRole !== 'super_admin' && !allowedRoles.includes(userRole)) {
                return res.status(403).json({
                    error: 'Forbidden',
                    message: `Requires one of the following roles: ${allowedRoles.join(', ')}`,
                });
            }

            req.user.role = userRole;
            next();
        } catch (error) {
            console.error('Role verification failed:', error);
            res.status(500).json({ error: 'Server Error', message: 'Failed to verify user role' });
        }
    };
};

module.exports = { requireRole, invalidateCachedRole };
