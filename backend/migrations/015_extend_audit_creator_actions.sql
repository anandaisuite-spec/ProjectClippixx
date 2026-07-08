-- =============================================
-- 015: Extend audit_logs for creator onboarding
--   - admin_create_creator : admin/super_admin creates a creator account
--   - admin_reset_password  : admin/super_admin sets a new password directly
-- =============================================

ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;

ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_check
  CHECK (action IN (
    'role_change',
    'user_delete',
    'admin_create_user',
    'profile_update_by_admin',
    'application_status_change',
    'mfa_enabled',
    'mfa_disabled',
    'mfa_backup_regenerated',
    'admin_create_creator',
    'admin_reset_password'
  ));
