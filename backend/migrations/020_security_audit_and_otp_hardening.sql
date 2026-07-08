-- Migration 020: security_audit_logs + OTP device fingerprinting + full purpose set

-- 1. Expand purpose CHECK to include all four purposes
ALTER TABLE otp_codes DROP CONSTRAINT IF EXISTS otp_codes_purpose_check;
ALTER TABLE otp_codes
    ADD CONSTRAINT otp_codes_purpose_check
    CHECK (purpose IN ('signup', 'login_email', 'login_phone', 'password_reset', 'email_change'));

-- 2. Device fingerprinting on otp_codes (non-null for new rows; nullable for old data)
ALTER TABLE otp_codes
    ADD COLUMN IF NOT EXISTS ip_address  TEXT,
    ADD COLUMN IF NOT EXISTS user_agent  TEXT;

-- 3. Security audit log table
CREATE TABLE IF NOT EXISTS security_audit_logs (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email       TEXT,
    phone       TEXT,
    action      TEXT        NOT NULL
                CHECK (action IN (
                    'otp_sent', 'otp_verified', 'otp_failed',
                    'otp_locked', 'otp_resend', 'signup_complete',
                    'login_complete', 'firebase_duplicate_blocked'
                )),
    ip          TEXT,
    user_agent  TEXT,
    metadata    JSONB       NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_email      ON security_audit_logs(email);
CREATE INDEX IF NOT EXISTS idx_audit_action     ON security_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_ip         ON security_audit_logs(ip);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON security_audit_logs(created_at DESC);

-- 4. Admin metrics view (req 30)
CREATE OR REPLACE VIEW otp_admin_metrics AS
SELECT
    date_trunc('day', created_at)                                      AS day,
    COUNT(*)                                                           AS otps_sent,
    COUNT(*) FILTER (WHERE used = true)                                AS verified,
    COUNT(*) FILTER (WHERE failed_attempts > 0 AND used = false)       AS failed,
    COUNT(*) FILTER (WHERE locked_until IS NOT NULL)                   AS locked_rows,
    ROUND(
        COUNT(*) FILTER (WHERE used = true)::numeric /
        NULLIF(COUNT(*), 0) * 100, 2
    )                                                                  AS success_rate_pct
FROM otp_codes
GROUP BY 1
ORDER BY 1 DESC;

-- Top-abuse IPs view
CREATE OR REPLACE VIEW otp_abuse_ips AS
SELECT
    ip_address,
    COUNT(*)                                   AS otp_rows,
    SUM(failed_attempts)                       AS total_failures,
    MAX(created_at)                            AS last_seen
FROM otp_codes
WHERE ip_address IS NOT NULL
GROUP BY ip_address
HAVING COUNT(*) > 10 OR SUM(failed_attempts) > 5
ORDER BY total_failures DESC;
