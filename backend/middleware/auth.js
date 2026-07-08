const { admin, firebaseInitialized } = require('../config/firebase');

/**
 * Middleware to verify Firebase Auth tokens.
 * Extracts the user's UID from the token and attaches it to req.user.
 */
const verifyToken = async (req, res, next) => {
    if (!firebaseInitialized) {
        return res.status(503).json({
            error: 'Authentication service not configured',
            message: 'Firebase Admin SDK is not initialized. Please set up your service account.',
        });
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'No authentication token provided. Include "Authorization: Bearer <token>" header.',
        });
    }

    const token = authHeader.split('Bearer ')[1];

    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        req.user = {
            uid: decodedToken.uid,
            email: decodedToken.email,
            name: decodedToken.name || null,
        };
        next();
    } catch (error) {
        console.error('Token verification failed:', error.message);
        return res.status(401).json({
            error: 'Invalid token',
            message: 'Invalid or expired authentication token.',
        });
    }
};

module.exports = { verifyToken };
