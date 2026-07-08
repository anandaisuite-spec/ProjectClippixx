require('dotenv').config();
const pool = require('./config/db');

async function seedProfile() {
    const profile = {
        id:           'dev-user-001',
        account_type: 'creator',
        first_name:   'Anand',
        last_name:    'Dev',
        email:        'anand.dev@clipixx.com',
        phone:        null,
        bio:          'Test creator profile for local development.',
        role:         'user',
    };

    try {
        const result = await pool.query(
            `INSERT INTO profiles (id, account_type, first_name, last_name, email, phone, bio, role)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (id) DO UPDATE SET
               account_type = EXCLUDED.account_type,
               first_name   = EXCLUDED.first_name,
               last_name    = EXCLUDED.last_name,
               email        = EXCLUDED.email,
               bio          = EXCLUDED.bio,
               role         = EXCLUDED.role,
               updated_at   = now()
             RETURNING *`,
            [profile.id, profile.account_type, profile.first_name, profile.last_name,
             profile.email, profile.phone, profile.bio, profile.role]
        );

        console.log('\n✅ Profile upserted:\n');
        console.table(result.rows);
    } finally {
        await pool.end();
    }
}

seedProfile().catch(console.error);
