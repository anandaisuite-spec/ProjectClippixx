const admin = require('firebase-admin');
require('dotenv').config();

let firebaseInitialized = false;

/**
 * Resolve the service-account credentials from (in priority order):
 *
 *   1. FIREBASE_SERVICE_ACCOUNT_JSON  — the full JSON as a single env var.
 *      BEST for Docker/CasaOS: the secret is injected at runtime, never baked
 *      into the image and never depends on a gitignored file reaching the build.
 *      Accepts either raw JSON or base64-encoded JSON.
 *
 *   2. FIREBASE_SERVICE_ACCOUNT_PATH  — path to a JSON file on disk (dev/local).
 *      Note: backend/config/firebase-service-account.json is gitignored, so it
 *      only works when the file is physically present in the build context.
 *
 * If neither resolves, auth-protected routes return 503 (see middleware/auth.js).
 */
function loadServiceAccount() {
    const inlineJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (inlineJson && inlineJson.trim()) {
        const raw = inlineJson.trim();
        // Allow base64 (handy when the platform mangles newlines in the private key).
        const decoded = raw.startsWith('{')
            ? raw
            : Buffer.from(raw, 'base64').toString('utf8');
        return JSON.parse(decoded);
    }

    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    if (serviceAccountPath) {
        // eslint-disable-next-line import/no-dynamic-require, global-require
        return require(`../${serviceAccountPath}`);
    }

    return null;
}

try {
    const serviceAccount = loadServiceAccount();

    if (serviceAccount) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
        firebaseInitialized = true;
        const source = process.env.FIREBASE_SERVICE_ACCOUNT_JSON ? 'env (FIREBASE_SERVICE_ACCOUNT_JSON)' : 'file (FIREBASE_SERVICE_ACCOUNT_PATH)';
        console.log(`✅ Firebase Admin SDK initialized — credentials from ${source}`);
    } else {
        console.warn('⚠️  Firebase service account not configured (set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH). Auth middleware will reject all requests.');
    }
} catch (error) {
    console.warn('⚠️  Firebase Admin SDK init failed:', error.message);
    console.warn('   Auth-protected routes will reject all requests.');
}

module.exports = { admin, firebaseInitialized };
