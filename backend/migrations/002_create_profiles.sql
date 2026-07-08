-- =============================================
-- 002: Create Profiles Table
-- Uses TEXT primary key to store Firebase UIDs
-- =============================================

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  account_type TEXT NOT NULL CHECK (account_type IN ('fan', 'creator')),
  first_name TEXT NOT NULL CHECK (length(first_name) <= 100),
  last_name TEXT NOT NULL CHECK (length(last_name) <= 100),
  email TEXT CHECK (length(email) <= 320),
  phone TEXT CHECK (length(phone) <= 20),
  avatar_url TEXT CHECK (length(avatar_url) <= 2048),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_profiles_updated_at'
  ) THEN
    CREATE TRIGGER update_profiles_updated_at
      BEFORE UPDATE ON profiles
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
