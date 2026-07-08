-- =============================================
-- 005: Add Text Search Index (optional, requires pg_trgm)
-- =============================================

-- Enable trigram extension for ILIKE performance
-- This may already be enabled on Supabase-hosted PostgreSQL
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'pg_trgm extension not available, skipping trigram index';
END $$;

-- Create trigram index for star name search (only if pg_trgm is available)
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_stars_name_trgm ON stars USING gin (name gin_trgm_ops);
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Skipping trigram index for stars.name';
END $$;
