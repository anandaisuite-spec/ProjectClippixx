-- =============================================
-- 007: Feature Extensions
--   - Add bio to profiles
--   - Add missing indexes on profiles
--   - Create audit_logs table
-- =============================================

-- 1. Add bio column to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '' CHECK (length(bio) <= 2000);

-- 2. Missing indexes on profiles (fixes unbounded query scan)
CREATE INDEX IF NOT EXISTS idx_profiles_role         ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at   ON profiles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_account_type ON profiles(account_type);

-- Trigram index for name search (pg_trgm enabled in migration 005)
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_profiles_name_trgm
    ON profiles USING gin ((first_name || ' ' || last_name) gin_trgm_ops);
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Skipping trigram index for profiles — pg_trgm may not be enabled';
END $$;

-- 3. Audit logs table
-- actor_id uses ON DELETE SET NULL so logs survive if a super_admin is deleted
CREATE TABLE IF NOT EXISTS audit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id     TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  actor_email  TEXT NOT NULL CHECK (length(actor_email) <= 320),
  action       TEXT NOT NULL CHECK (action IN (
                  'role_change',
                  'user_delete',
                  'admin_create_user',
                  'profile_update_by_admin'
               )),
  target_id    TEXT,
  target_email TEXT,
  metadata     JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_actor   ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_action  ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_target  ON audit_logs(target_id);
