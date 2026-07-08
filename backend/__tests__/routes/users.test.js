require('../setup');

jest.mock('../../config/firebase', () => ({
    admin: { auth: jest.fn() },
    firebaseInitialized: true,
}));

const request = require('supertest');
const pool = require('../../config/db');

function makeApp() {
    return require('../../server');
}

const CREATOR_UID = 'creator-browse-' + Date.now();
const FAN_UID     = 'fan-browse-' + Date.now();

beforeAll(async () => {
    await pool.query(
        `INSERT INTO profiles (id, account_type, first_name, last_name, email, bio)
         VALUES
           ($1, 'creator', 'Browse', 'Creator', $2, 'I am a creator'),
           ($3, 'fan',     'Browse', 'Fan',     $4, '')
         ON CONFLICT (id) DO NOTHING`,
        [CREATOR_UID, `creator-${Date.now()}@test.com`, FAN_UID, `fan-${Date.now()}@test.com`]
    );
});

afterAll(async () => {
    await pool.query('DELETE FROM profiles WHERE id = ANY($1)', [[CREATOR_UID, FAN_UID]]);
});

describe('GET /api/users', () => {
    it('is accessible without authentication', async () => {
        const app = makeApp();
        const res = await request(app).get('/api/users');
        expect(res.status).toBe(200);
    });

    it('returns only creators — not fans', async () => {
        const app = makeApp();
        const res = await request(app).get('/api/users');
        expect(res.status).toBe(200);
        res.body.data.forEach((u) => expect(u.account_type).toBe('creator'));
    });

    it('never exposes email, phone, or role fields', async () => {
        const app = makeApp();
        const res = await request(app).get('/api/users');
        res.body.data.forEach((u) => {
            expect(u.email).toBeUndefined();
            expect(u.phone).toBeUndefined();
            expect(u.role).toBeUndefined();
        });
    });

    it('returns pagination object', async () => {
        const app = makeApp();
        const res = await request(app).get('/api/users?page=1&limit=5');
        expect(res.body.pagination).toBeDefined();
        expect(res.body.pagination.page).toBe(1);
        expect(res.body.pagination.limit).toBe(5);
    });

    it('caps limit at 50', async () => {
        const app = makeApp();
        const res = await request(app).get('/api/users?limit=500');
        expect(res.body.pagination.limit).toBe(50);
    });

    it('filters by search name', async () => {
        const app = makeApp();
        const res = await request(app).get('/api/users?search=Browse');
        expect(res.status).toBe(200);
        res.body.data.forEach((u) => {
            const fullName = `${u.first_name} ${u.last_name}`.toLowerCase();
            expect(fullName).toContain('browse');
        });
    });

    it('sorts alphabetically by first_name asc', async () => {
        const app = makeApp();
        const res = await request(app).get('/api/users?sort=first_name&order=asc');
        expect(res.status).toBe(200);
        const names = res.body.data.map((u) => u.first_name);
        const sorted = [...names].sort();
        expect(names).toEqual(sorted);
    });
});
