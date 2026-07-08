-- Migration 021: Cleanup function + additional performance indexes

-- 1. Stored procedure for hourly cleanup (called by Node cron job)
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS INTEGER AS $$
DECLARE
    deleted INTEGER;
BEGIN
    DELETE FROM otp_codes
    WHERE
        -- Expired and not used
        (expires_at < now() AND used = false)
        OR
        -- Used OTPs older than 24 hours
        (used = true AND created_at < now() - INTERVAL '24 hours')
        OR
        -- Invalidated OTPs older than 24 hours
        (invalidated = true AND created_at < now() - INTERVAL '24 hours');

    GET DIAGNOSTICS deleted = ROW_COUNT;
    RETURN deleted;
END;
$$ LANGUAGE plpgsql;

-- 2. Cleanup for expired pending signups
CREATE OR REPLACE FUNCTION cleanup_expired_pending_signups()
RETURNS INTEGER AS $$
DECLARE
    deleted INTEGER;
BEGIN
    DELETE FROM pending_signups WHERE expires_at < now();
    GET DIAGNOSTICS deleted = ROW_COUNT;
    RETURN deleted;
END;
$$ LANGUAGE plpgsql;

-- 3. Audit log cleanup — keep 90 days
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted INTEGER;
BEGIN
    DELETE FROM security_audit_logs WHERE created_at < now() - INTERVAL '90 days';
    GET DIAGNOSTICS deleted = ROW_COUNT;
    RETURN deleted;
END;
$$ LANGUAGE plpgsql;

-- 4. Additional covering indexes for high-throughput lookup patterns
CREATE INDEX IF NOT EXISTS idx_otp_active_email
    ON otp_codes(email, purpose, created_at DESC)
    WHERE used = false AND invalidated = false;

CREATE INDEX IF NOT EXISTS idx_otp_active_phone
    ON otp_codes(phone, purpose, created_at DESC)
    WHERE used = false AND invalidated = false;

CREATE INDEX IF NOT EXISTS idx_otp_active_signup
    ON otp_codes(email, phone, created_at DESC)
    WHERE purpose = 'signup' AND used = false AND invalidated = false;
