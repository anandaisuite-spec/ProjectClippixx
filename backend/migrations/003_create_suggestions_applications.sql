-- =============================================
-- 003: Create Star Suggestions & Creator Applications
-- =============================================

CREATE TABLE IF NOT EXISTS star_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  celebrity_name TEXT NOT NULL CHECK (length(celebrity_name) <= 200),
  category TEXT NOT NULL CHECK (category IN ('Actor', 'Athlete', 'Creator', 'Musician')),
  social_links TEXT DEFAULT '' CHECK (length(social_links) <= 2048),
  reason TEXT DEFAULT '' CHECK (length(reason) <= 2000),
  submitter_email TEXT NOT NULL CHECK (length(submitter_email) <= 320),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_star_suggestions_status ON star_suggestions(status);

CREATE TABLE IF NOT EXISTS creator_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL CHECK (length(full_name) <= 200),
  email TEXT NOT NULL CHECK (length(email) <= 320),
  category TEXT NOT NULL CHECK (category IN ('Actor', 'Athlete', 'Creator', 'Musician')),
  social_links TEXT NOT NULL CHECK (length(social_links) <= 2048),
  followers_count TEXT DEFAULT '' CHECK (length(followers_count) <= 50),
  bio TEXT NOT NULL CHECK (length(bio) <= 5000),
  why_join TEXT NOT NULL CHECK (length(why_join) <= 5000),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_creator_applications_status ON creator_applications(status);
