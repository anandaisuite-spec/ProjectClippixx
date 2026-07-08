-- =============================================
-- 006: Add Role to Profiles Table
-- =============================================

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user' 
CHECK (role IN ('user', 'admin', 'super_admin'));
