-- =============================================
-- 001: Create Stars Table
-- =============================================

CREATE TABLE IF NOT EXISTS stars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (length(name) <= 200),
  category TEXT NOT NULL CHECK (category IN ('Actor', 'Athlete', 'Creator', 'Musician')),
  image_url TEXT NOT NULL CHECK (length(image_url) <= 2048),
  rating NUMERIC(2,1) DEFAULT 5.0 CHECK (rating >= 0 AND rating <= 5),
  reviews_count INTEGER DEFAULT 0 CHECK (reviews_count >= 0),
  price INTEGER NOT NULL CHECK (price > 0),
  is_featured BOOLEAN DEFAULT false,
  bio TEXT DEFAULT '' CHECK (length(bio) <= 5000),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stars_category ON stars(category);
CREATE INDEX IF NOT EXISTS idx_stars_rating ON stars(rating DESC);
CREATE INDEX IF NOT EXISTS idx_stars_price ON stars(price);
CREATE INDEX IF NOT EXISTS idx_stars_is_featured ON stars(is_featured);

-- =============================================
-- Seed Data
-- =============================================
INSERT INTO stars (name, category, image_url, rating, reviews_count, price, is_featured, bio) VALUES
  ('Alex Sterling', 'Actor', 'https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=600', 4.9, 2840, 199, true, 'Award-winning actor known for dramatic roles'),
  ('Jordan Blake', 'Athlete', 'https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg?auto=compress&cs=tinysrgb&w=600', 5.0, 1256, 299, true, 'Professional basketball player and sports influencer'),
  ('Mia Chen', 'Creator', 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=600', 4.8, 4521, 99, true, 'Top lifestyle and beauty content creator'),
  ('David Park', 'Musician', 'https://images.pexels.com/photos/1212984/pexels-photo-1212984.jpeg?auto=compress&cs=tinysrgb&w=600', 4.9, 892, 249, true, 'Grammy-nominated producer and singer'),
  ('Sarah Mitchell', 'Actor', 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=600', 4.7, 1523, 179, false, 'Rising star in independent cinema'),
  ('Marcus Thompson', 'Athlete', 'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=600', 4.8, 987, 199, false, 'Olympic gold medalist swimmer'),
  ('Emma Rodriguez', 'Creator', 'https://images.pexels.com/photos/1065084/pexels-photo-1065084.jpeg?auto=compress&cs=tinysrgb&w=600', 4.6, 3200, 79, false, 'Comedy and lifestyle vlogger'),
  ('Jake Wilson', 'Musician', 'https://images.pexels.com/photos/1040880/pexels-photo-1040880.jpeg?auto=compress&cs=tinysrgb&w=600', 4.9, 2100, 299, false, 'Rock band frontman and songwriter'),
  ('Olivia Kim', 'Actor', 'https://images.pexels.com/photos/1130626/pexels-photo-1130626.jpeg?auto=compress&cs=tinysrgb&w=600', 4.5, 756, 149, false, 'Television drama lead actress'),
  ('Chris Anderson', 'Athlete', 'https://images.pexels.com/photos/937481/pexels-photo-937481.jpeg?auto=compress&cs=tinysrgb&w=600', 4.7, 1890, 249, false, 'Professional soccer player'),
  ('Nina Patel', 'Creator', 'https://images.pexels.com/photos/1181690/pexels-photo-1181690.jpeg?auto=compress&cs=tinysrgb&w=600', 4.8, 5600, 129, false, 'Tech reviewer and gadget expert'),
  ('Ryan Cooper', 'Musician', 'https://images.pexels.com/photos/1704488/pexels-photo-1704488.jpeg?auto=compress&cs=tinysrgb&w=600', 4.6, 1340, 179, false, 'Indie folk singer-songwriter'),
  ('Ashley Brown', 'Actor', 'https://images.pexels.com/photos/1542085/pexels-photo-1542085.jpeg?auto=compress&cs=tinysrgb&w=600', 4.9, 3100, 229, false, 'Broadway star and voice actress'),
  ('Tyler Martinez', 'Athlete', 'https://images.pexels.com/photos/2379005/pexels-photo-2379005.jpeg?auto=compress&cs=tinysrgb&w=600', 4.4, 678, 159, false, 'Professional skateboarder'),
  ('Lisa Wang', 'Creator', 'https://images.pexels.com/photos/1462637/pexels-photo-1462637.jpeg?auto=compress&cs=tinysrgb&w=600', 4.7, 4200, 109, false, 'Cooking and food content creator'),
  ('Daniel Scott', 'Musician', 'https://images.pexels.com/photos/1516680/pexels-photo-1516680.jpeg?auto=compress&cs=tinysrgb&w=600', 4.8, 2890, 269, false, 'Hip-hop artist and music producer')
ON CONFLICT DO NOTHING;
