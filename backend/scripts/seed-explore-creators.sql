-- ───────────────────────────────────────────────────────────────────────────
-- Seed: sample creators for the Explore page.
--
-- Purpose: populate the discovery grid with varied creators so every filter
-- (category / price / rating / language / delivery / sort) has something to act
-- on. Without this, a near-empty DB makes the filters *look* broken when they
-- are actually working.
--
-- Safe to re-run: each seed row is keyed by a stable `seed_*` username and is
-- deleted (cascading its pricing_tiers) before re-insert. Real creators (e.g.
-- "jacky") are never touched.
--
-- Run with:
--   psql -U postgres -d clipixx -h localhost -f scripts/seed-explore-creators.sql
-- ───────────────────────────────────────────────────────────────────────────

BEGIN;

-- Remove any previous run of THIS seed only (FK cascade clears their tiers).
DELETE FROM stars WHERE username LIKE 'seed_%';

-- Insert creators. Each is accepting bookings, verified, with avg_rating set so
-- the rating filter has data. Categories/languages/prices/delivery deliberately
-- spread out to exercise every filter.
WITH seeded AS (
    INSERT INTO stars
        (name, username, category, image_url, price, bio,
         languages, accepting_bookings, is_verified, verification_status,
         avg_rating, review_count, rating, reviews_count, turnaround_days)
    VALUES
        ('Aarav Khanna',   'seed_aarav',   'Actor',      'https://i.pravatar.cc/300?img=11',  1500,
            'Film & theatre actor delivering heartfelt personalized shoutouts.',
            ARRAY['English','Hindi'],            true, true, 'approved', 4.8, 124, 4.8, 124, 3),
        ('Meera Iyer',     'seed_meera',   'Musician',   'https://i.pravatar.cc/300?img=45',   900,
            'Playback singer. Custom birthday songs and dedications.',
            ARRAY['Tamil','Telugu','English'],   true, true, 'approved', 4.5,  86, 4.5,  86, 5),
        ('Rohit Sharma',   'seed_rohit',   'Athlete',    'https://i.pravatar.cc/300?img=12',  2500,
            'Professional cricketer. Pep talks and match-day wishes.',
            ARRAY['Hindi','Marathi'],            true, true, 'approved', 4.9, 210, 4.9, 210, 7),
        ('Priya Nair',     'seed_priya',   'Influencer', 'https://i.pravatar.cc/300?img=47',   600,
            'Lifestyle & fashion creator. Fun, energetic video messages.',
            ARRAY['Malayalam','English'],        true, true, 'approved', 4.2,  53, 4.2,  53, 2),
        ('Vikram Reddy',   'seed_vikram',  'YouTuber',   'https://i.pravatar.cc/300?img=15',   750,
            'Tech YouTuber. Shoutouts, advice, and product hype.',
            ARRAY['Telugu','English','Kannada'], true, true, 'approved', 4.6, 142, 4.6, 142, 4),
        ('Sneha Das',      'seed_sneha',   'Comedian',   'https://i.pravatar.cc/300?img=49',   500,
            'Stand-up comedian. Roasts, jokes, and birthday laughs.',
            ARRAY['Bengali','Hindi'],            true, true, 'approved', 3.9,  31, 3.9,  31, 1),
        ('Arjun Mehta',    'seed_arjun',   'Podcaster',  'https://i.pravatar.cc/300?img=18',  1200,
            'Host of a top business podcast. Motivational messages.',
            ARRAY['English','Gujarati'],         true, true, 'approved', 4.7,  98, 4.7,  98, 6),
        ('Simran Kaur',    'seed_simran',  'Creator',    'https://i.pravatar.cc/300?img=44',   350,
            'Dance & reels creator. Quick, cheerful video shoutouts.',
            ARRAY['Punjabi','Hindi','English'],  true, true, 'approved', 4.4,  67, 4.4,  67, 1)
    RETURNING id, username, price, turnaround_days
)
-- One active pricing tier per creator (the Explore INNER JOIN requires it).
-- Price/delivery mirror the star row so the card's "From ₹X / Delivers in Yd"
-- matches and the price & delivery filters behave intuitively.
INSERT INTO pricing_tiers (creator_id, tier_name, description, price, delivery_days, is_active)
SELECT id, 'Personalized Video', 'A custom personalized video message.', price, turnaround_days, true
FROM seeded;

COMMIT;

-- Quick verification of what was seeded.
SELECT s.name, s.category, s.price, s.avg_rating, s.languages, t.delivery_days
FROM stars s
JOIN pricing_tiers t ON t.creator_id = s.id
WHERE s.username LIKE 'seed_%'
ORDER BY s.name;
