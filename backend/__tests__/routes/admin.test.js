require('../setup');

const mockAdminAuth = { verifyIdToken: jest.fn() };
jest.mock('../../config/firebase', () => ({
    admin: { auth: () => mockAdminAuth },
    firebaseInitialized: true,
}));

const request = require('supertest');
const pool = require('../../config/db');
const firebaseConfig = require('../../config/firebase');

function makeApp() {
    return require('../../server');
}

function mockFirebaseToken(uid, email = `${uid}@test.com`) {
    mockAdminAuth.verifyIdToken.mockResolvedValueOnce({ uid, email });
}

const ADMIN_UID   = 'admin-stats-' + Date.now();
const SUPER_UID   = 'super-stats-' + Date.now();
const USER_UID    = 'user-stats-' + Date.now();
const ADMIN_EMAIL = `admin-stats-${Date.now()}@test.com`;
const SUPER_EMAIL = `super-stats-${Date.now()}@test.com`;
const USER_EMAIL  = `user-stats-${Date.now()}@test.com`;

beforeAll(async () => {
    await pool.query(
        `INSERT INTO profiles (id, account_type, first_name, last_name, email, role) VALUES
         ($1, 'fan', 'Admin', 'Stats', $2, 'admin'),
         ($3, 'fan', 'Super', 'Stats', $4, 'super_admin'),
         ($5, 'fan', 'Plain', 'Stats', $6, 'user')
         ON CONFLICT (id) DO NOTHING`,
        [ADMIN_UID, ADMIN_EMAIL, SUPER_UID, SUPER_EMAIL, USER_UID, USER_EMAIL]
    );
});

afterAll(async () => {
    await pool.query('DELETE FROM profiles WHERE id = ANY($1)', [[ADMIN_UID, SUPER_UID, USER_UID]]);
});

describe('GET /api/admin/stats', () => {
    it('returns 403 for plain user', async () => {
        const app = makeApp();
        mockFirebaseToken(USER_UID, USER_EMAIL);
        const res = await request(app).get('/api/admin/stats').set('Authorization', 'Bearer fake');
        expect(res.status).toBe(403);
    });

    it('returns all 6 stat keys for admin', async () => {
        const app = makeApp();
        mockFirebaseToken(ADMIN_UID, ADMIN_EMAIL);
        const res = await request(app).get('/api/admin/stats').set('Authorization', 'Bearer fake');
        expect(res.status).toBe(200);
        const keys = ['totalUsers', 'totalCreators', 'totalStars', 'pendingApplications', 'pendingFeedback', 'totalAdmins'];
        keys.forEach((k) => expect(res.body.data[k]).toBeDefined());
    });

    it('returns stats for super_admin too', async () => {
        const app = makeApp();
        mockFirebaseToken(SUPER_UID, SUPER_EMAIL);
        const res = await request(app).get('/api/admin/stats').set('Authorization', 'Bearer fake');
        expect(res.status).toBe(200);
    });
});

describe('GET /api/admin/audit-logs', () => {
    // FIX: The route uses requireRole(['admin', 'super_admin']),
    // so admin IS allowed. Test was incorrectly expecting 403.
    it('returns 200 for admin role (admin is allowed)', async () => {
        const app = makeApp();
        mockFirebaseToken(ADMIN_UID, ADMIN_EMAIL);
        const res = await request(app).get('/api/admin/audit-logs').set('Authorization', 'Bearer fake');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('returns paginated logs for super_admin', async () => {
        const app = makeApp();
        mockFirebaseToken(SUPER_UID, SUPER_EMAIL);
        const res = await request(app)
            .get('/api/admin/audit-logs?page=1&limit=10')
            .set('Authorization', 'Bearer fake');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.pagination).toBeDefined();
    });

    it('respects action filter', async () => {
        const app = makeApp();
        mockFirebaseToken(SUPER_UID, SUPER_EMAIL);
        const res = await request(app)
            .get('/api/admin/audit-logs?action=role_change')
            .set('Authorization', 'Bearer fake');
        expect(res.status).toBe(200);
        res.body.data.forEach((log) => expect(log.action).toBe('role_change'));
    });

    it('returns 403 for plain user', async () => {
        const app = makeApp();
        mockFirebaseToken(USER_UID, USER_EMAIL);
        const res = await request(app).get('/api/admin/audit-logs').set('Authorization', 'Bearer fake');
        expect(res.status).toBe(403);
    });
});