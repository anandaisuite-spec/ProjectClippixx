-- =============================================
-- 009: Add bio column to profiles
-- =============================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '' CHECK (length(bio) <= 2000);
