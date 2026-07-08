require('../setup');

// Mock the DB pool before requiring auditService
jest.mock('../../config/db', () => ({
    query: jest.fn(),
    end: jest.fn().mockResolvedValue(undefined),
}));

const pool = require('../../config/db');
const { writeAuditLog } = require('../../services/auditService');

describe('auditService.writeAuditLog', () => {
    beforeEach(() => jest.clearAllMocks());

    it('inserts a row when pool.query succeeds', async () => {
        pool.query.mockResolvedValueOnce({ rows: [] });

        await expect(
            writeAuditLog({
                actorId: 'uid-1',
                actorEmail: 'admin@test.com',
                action: 'role_change',
                targetId: 'uid-2',
                targetEmail: 'user@test.com',
                metadata: { previousRole: 'user', newRole: 'admin' },
            })
        ).resolves.toBeUndefined();

        expect(pool.query).toHaveBeenCalledTimes(1);
        expect(pool.query.mock.calls[0][0]).toContain('INSERT INTO audit_logs');
    });

    it('resolves (does not throw) when pool.query throws', async () => {
        pool.query.mockRejectedValueOnce(new Error('DB connection lost'));
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

        await expect(
            writeAuditLog({
                actorId: 'uid-1',
                actorEmail: 'admin@test.com',
                action: 'user_delete',
            })
        ).resolves.toBeUndefined();

        expect(spy).toHaveBeenCalledWith(
            expect.stringContaining('[auditService]'),
            expect.any(String),
            expect.any(Object)
        );
        spy.mockRestore();
    });
});
