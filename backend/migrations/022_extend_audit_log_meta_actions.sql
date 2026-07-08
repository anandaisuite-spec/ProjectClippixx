-- =============================================
-- 022: Extend audit_logs for audit-log self-management
--   - audit_log_edited  : a super admin edited an existing audit log entry
--   - audit_log_deleted : a super admin deleted an audit log entry
--
-- These meta-actions keep edit/delete of audit rows themselves auditable, so
-- even though the trail is now mutable there is still a record of who changed it.
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
    'admin_reset_password',
    'audit_log_edited',
    'audit_log_deleted'
  ));
