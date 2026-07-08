-- =============================================
-- 004: Create Feedback Table
-- =============================================

CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('Bug Report', 'Feature Request', 'General Feedback', 'Other')),
  subject TEXT NOT NULL CHECK (length(subject) <= 300),
  message TEXT NOT NULL CHECK (length(message) <= 10000),
  email TEXT DEFAULT '' CHECK (length(email) <= 320),
  created_at TIMESTAMPTZ DEFAULT now()
);
