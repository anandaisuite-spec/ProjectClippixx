-- =============================================
-- 008: Extend audit_logs for admin moderation
--   - Add 'application_status_change' action type
-- =============================================

-- Drop the old CHECK constraint and add updated one
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;

ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_check
  CHECK (action IN (
    'role_change',
    'user_delete',
    'admin_create_user',
    'profile_update_by_admin',
    'application_status_change'
  ));
