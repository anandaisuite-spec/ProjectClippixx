require('../setup');

const { authenticator } = require('otplib');
const pool = require('../../config/db');
const mfaService = require('../../services/mfaService');

const TEST_UID = 'mfa-test-uid-' + Date.now();
const TEST_EMAIL = `mfa-${Date.now()}@test.com`;

beforeAll(async () => {
    // MFA rows FK to profiles — create a throwaway profile.
    await pool.query(
        `INSERT INTO profiles (id, account_type, first_name, last_name, email, role)
         VALUES ($1, 'fan', 'Mfa', 'Tester', $2, 'user')
         ON CONFLICT (id) DO NOTHING`,
        [TEST_UID, TEST_EMAIL]
    );
});

afterAll(async () => {
    await pool.query('DELETE FROM user_mfa WHERE user_id = $1', [TEST_UID]).catch(() => {});
    await pool.query('DELETE FROM profiles WHERE id = $1', [TEST_UID]).catch(() => {});
});

describe('mfaService', () => {
    let secret;
    let backupCodes;

    it('status is unenrolled before setup', async () => {
        const status = await mfaService.getStatus(TEST_UID);
        expect(status.enrolled).toBe(false);
        expect(status.enabled).toBe(false);
    });

    it('beginSetup stores a secret and returns a QR data url', async () => {
        const result = await mfaService.beginSetup(TEST_UID, TEST_EMAIL);
        expect(result.secret).toBeTruthy();
        expect(result.qrDataUrl).toMatch(/^data:image\/png;base64,/);
        expect(result.otpauth).toContain('otpauth://totp/');
        secret = result.secret;
    });

    it('does not enable with an invalid token', async () => {
        const result = await mfaService.enable(TEST_UID, '000000');
        expect(result.ok).toBe(false);
        expect(result.reason).toBe('invalid_token');
    });

    it('enables with a valid TOTP token and returns backup codes', async () => {
        const token = authenticator.generate(secret);
        const result = await mfaService.enable(TEST_UID, token);
        expect(result.ok).toBe(true);
        expect(Array.isArray(result.backupCodes)).toBe(true);
        expect(result.backupCodes).toHaveLength(10);
        backupCodes = result.backupCodes;
    });

    it('reports enabled status with backup codes remaining', async () => {
        const status = await mfaService.getStatus(TEST_UID);
        expect(status.enabled).toBe(true);
        expect(status.backupCodesRemaining).toBe(10);
    });

    it('verifies a valid TOTP token', async () => {
        const token = authenticator.generate(secret);
        const result = await mfaService.verifyForUser(TEST_UID, token);
        expect(result.ok).toBe(true);
        expect(result.method).toBe('totp');
    });

    it('consumes a backup code (single-use)', async () => {
        const code = backupCodes[0];
        const first = await mfaService.verifyForUser(TEST_UID, code);
        expect(first.ok).toBe(true);
        expect(first.method).toBe('backup_code');
        expect(first.remaining).toBe(9);

        // Same code must not work twice.
        const second = await mfaService.verifyForUser(TEST_UID, code);
        expect(second.ok).toBe(false);
    });

    it('disable removes MFA entirely', async () => {
        await mfaService.disable(TEST_UID);
        const status = await mfaService.getStatus(TEST_UID);
        expect(status.enrolled).toBe(false);
        expect(await mfaService.isEnabled(TEST_UID)).toBe(false);
    });
});
