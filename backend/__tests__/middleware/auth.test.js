require('../setup');

const mockVerifyIdToken = jest.fn();

// Mock Firebase Admin before requiring auth middleware
jest.mock('../../config/firebase', () => ({
    admin: {
        auth: () => ({
            verifyIdToken: mockVerifyIdToken,
        }),
    },
    firebaseInitialized: true,
}));

const request = require('supertest');
const express = require('express');
const { verifyToken } = require('../../middleware/auth');

function makeApp() {
    const app = express();
    app.use(express.json());
    app.get('/protected', verifyToken, (req, res) => {
        res.json({ uid: req.user.uid, email: req.user.email });
    });
    return app;
}

describe('verifyToken middleware', () => {
    beforeEach(() => mockVerifyIdToken.mockReset());

    it('returns 401 when no Authorization header', async () => {
        const res = await request(makeApp()).get('/protected');
        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Unauthorized');
    });

    it('returns 401 when Authorization header has wrong format', async () => {
        const res = await request(makeApp())
            .get('/protected')
            .set('Authorization', 'Basic sometoken');
        expect(res.status).toBe(401);
    });

    it('returns 401 when Firebase verifyIdToken throws', async () => {
        mockVerifyIdToken.mockRejectedValueOnce(new Error('invalid token'));
        const res = await request(makeApp())
            .get('/protected')
            .set('Authorization', 'Bearer bad-token');
        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Invalid token');
    });

    it('attaches req.user and calls next on valid token', async () => {
        mockVerifyIdToken.mockResolvedValueOnce({
            uid: 'test-uid',
            email: 'test@example.com',
        });
        const res = await request(makeApp())
            .get('/protected')
            .set('Authorization', 'Bearer valid-token');
        expect(res.status).toBe(200);
        expect(res.body.uid).toBe('test-uid');
        expect(res.body.email).toBe('test@example.com');
    });
});
