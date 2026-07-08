require('../setup');

// Mock Firebase Admin
const mockAuthInstance = {
    verifyIdToken: jest.fn(),
    deleteUser: jest.fn().mockResolvedValue(undefined),
    createUser: jest.fn(),
};
jest.mock('../../config/firebase', () => ({
    admin: { auth: () => mockAuthInstance },
    firebaseInitialized: true,
}));

const request = require('supertest');
const pool = require('../../config/db');
const firebaseConfig = require('../../config/firebase');
const { invalidateCachedRole } = require('../../middleware/roleCache');

// Build the full Express app (real DB, mocked Firebase)
function makeApp() {
    return require('../../server');
}

// Helper to create a valid Firebase mock for a uid
function mockFirebaseToken(uid, email = `${uid}@test.com`) {
    mockAuthInstance.verifyIdToken.mockResolvedValueOnce({ uid, email });
}

// Public routes (e.g. GET /api/profiles/:id) never call verifyIdToken, so a
// queued `mockResolvedValueOnce` from such a test would otherwise leak into the
// next test and resolve the wrong uid. Reset the queue before every test.
beforeEach(() => {
    mockAuthInstance.verifyIdToken.mockReset();
});

const TEST_UID = 'test-profile-uid-' + Date.now();
const TEST_EMAIL = `profile-test-${Date.now()}@test.com`;

afterAll(async () => {
    // Clean up test records
    await pool.query('DELETE FROM profiles WHERE id = $1', [TEST_UID]).catch(() => {});
});

describe('GET /api/profiles/me', () => {
    it('returns 401 without token', async () => {
        const app = makeApp();
        const res = await request(app).get('/api/profiles/me');
        expect(res.status).toBe(401);
    });

    it('returns 404 when profile does not exist', async () => {
        const app = makeApp();
        mockFirebaseToken('nonexistent-uid-xyz');
        const res = await request(app)
            .get('/api/profiles/me')
            .set('Authorization', 'Bearer fake');
        expect(res.status).toBe(404);
    });
});

describe('POST /api/profiles (UPSERT)', () => {
    it('creates a profile and returns 201', async () => {
        const app = makeApp();
        mockFirebaseToken(TEST_UID, TEST_EMAIL);
        const res = await request(app)
            .post('/api/profiles')
            .set('Authorization', 'Bearer fake')
            .send({ account_type: 'fan', first_name: 'Test', last_name: 'User' });
        expect(res.status).toBe(201);
        expect(res.body.data.id).toBe(TEST_UID);
    });

    it('is idempotent — calling twice does not cause duplicate key error', async () => {
        const app = makeApp();
        mockFirebaseToken(TEST_UID, TEST_EMAIL);
        const res = await request(app)
            .post('/api/profiles')
            .set('Authorization', 'Bearer fake')
            .send({ account_type: 'fan', first_name: 'Test', last_name: 'User' });
        expect([200, 201]).toContain(res.status);
        expect(res.body.data).toBeDefined();
    });
});

describe('PUT /api/profiles/me', () => {
    it('updates bio field', async () => {
        const app = makeApp();
        mockFirebaseToken(TEST_UID, TEST_EMAIL);
        const res = await request(app)
            .put('/api/profiles/me')
            .set('Authorization', 'Bearer fake')
            .send({ bio: 'Test bio content' });
        expect(res.status).toBe(200);
        expect(res.body.data.bio).toBe('Test bio content');
    });

    it('rejects bio over 2000 chars', async () => {
        const app = makeApp();
        mockFirebaseToken(TEST_UID, TEST_EMAIL);
        const res = await request(app)
            .put('/api/profiles/me')
            .set('Authorization', 'Bearer fake')
            .send({ bio: 'x'.repeat(2001) });
        expect(res.status).toBe(422);
    });
});

describe('GET /api/profiles (admin list)', () => {
    it('returns 403 for plain user role', async () => {
        // Insert a plain-user profile first
        const uid = 'plain-user-' + Date.now();
        const email = `plain-${Date.now()}@test.com`;
        await pool.query(
            `INSERT INTO profiles (id, account_type, first_name, last_name, email, role)
             VALUES ($1, 'fan', 'Plain', 'User', $2, 'user')
             ON CONFLICT (id) DO NOTHING`,
            [uid, email]
        );

        const app = makeApp();
        invalidateCachedRole(uid);
        mockFirebaseToken(uid, email);
        const res = await request(app)
            .get('/api/profiles')
            .set('Authorization', 'Bearer fake');
        expect(res.status).toBe(403);

        await pool.query('DELETE FROM profiles WHERE id = $1', [uid]);
    });

    it('returns paginated data with pagination object for admin', async () => {
        const uid = 'admin-user-' + Date.now();
        const email = `admin-${Date.now()}@test.com`;
        await pool.query(
            `INSERT INTO profiles (id, account_type, first_name, last_name, email, role)
             VALUES ($1, 'fan', 'Admin', 'User', $2, 'admin')
             ON CONFLICT (id) DO NOTHING`,
            [uid, email]
        );

        const app = makeApp();
        invalidateCachedRole(uid);
        mockFirebaseToken(uid, email);
        const res = await request(app)
            .get('/api/profiles?page=1&limit=5')
            .set('Authorization', 'Bearer fake');
        expect(res.status).toBe(200);
        expect(res.body.pagination).toBeDefined();
        expect(res.body.pagination.page).toBe(1);
        expect(res.body.pagination.limit).toBe(5);
        expect(Array.isArray(res.body.data)).toBe(true);

        await pool.query('DELETE FROM profiles WHERE id = $1', [uid]);
    });
});

describe('GET /api/profiles/:id', () => {
    it('returns public profile without email, phone, or role', async () => {
        const app = makeApp();
        mockFirebaseToken(TEST_UID, TEST_EMAIL);
        const res = await request(app)
            .get(`/api/profiles/${TEST_UID}`)
            .set('Authorization', 'Bearer fake');
        expect(res.status).toBe(200);
        expect(res.body.data.email).toBeUndefined();
        expect(res.body.data.phone).toBeUndefined();
        expect(res.body.data.role).toBeUndefined();
        expect(res.body.data.first_name).toBeDefined();
    });

    it('returns 404 for nonexistent profile', async () => {
        const app = makeApp();
        mockFirebaseToken(TEST_UID, TEST_EMAIL);
        const res = await request(app)
            .get('/api/profiles/does-not-exist-xyz')
            .set('Authorization', 'Bearer fake');
        expect(res.status).toBe(404);
    });
});

describe('POST /api/profiles/admin/users', () => {
    it('rejects password shorter than 8 characters', async () => {
        const uid = 'super-' + Date.now();
        const email = `super-${Date.now()}@test.com`;
        await pool.query(
            `INSERT INTO profiles (id, account_type, first_name, last_name, email, role)
             VALUES ($1, 'fan', 'Super', 'Admin', $2, 'super_admin')
             ON CONFLICT (id) DO NOTHING`,
            [uid, email]
        );

        // FIX: Invalidate any stale cache for this uid so the
        // role middleware reads the fresh super_admin role from DB
        invalidateCachedRole(uid);

        const app = makeApp();
        mockFirebaseToken(uid, email);
        const res = await request(app)
            .post('/api/profiles/admin/users')
            .set('Authorization', 'Bearer fake')
            .send({ email: 'new@test.com', password: 'short', first_name: 'New', role: 'user' });
        expect(res.status).toBe(422);

        await pool.query('DELETE FROM profiles WHERE id = $1', [uid]);
    });
});