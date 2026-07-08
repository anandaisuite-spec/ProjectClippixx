// Set test env before any modules load
process.env.NODE_ENV = 'test';
process.env.DB_HOST = process.env.TEST_DB_HOST || 'localhost';
process.env.DB_PORT = process.env.TEST_DB_PORT || '5432';
process.env.DB_USER = process.env.TEST_DB_USER || 'postgres';
process.env.DB_PASSWORD = process.env.TEST_DB_PASSWORD || '1234';
process.env.DB_NAME = process.env.TEST_DB_NAME || 'clipixx';
process.env.CORS_ORIGIN = 'http://localhost:5173';
// Blank the Turnstile secret so verifyTurnstile SKIPS in tests (set before
// dotenv loads the real .env — dotenv never overrides already-set keys).
// Tests must never call Cloudflare's live siteverify endpoint.
process.env.TURNSTILE_SECRET_KEY = '';
