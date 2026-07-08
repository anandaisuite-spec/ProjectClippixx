const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'clipixx123', // We will ask the user to enter this if needed, or assume default
    database: 'clipixx'
});

async function makeAdmin() {
    try {
        const email = 'admin11@gmail.com';
        console.log(`Setting ${email} to super_admin...`);
        const result = await pool.query(
            `UPDATE profiles SET role = 'super_admin' WHERE email = $1 RETURNING *`,
            [email]
        );

        if (result.rows.length > 0) {
            console.log('Success!', result.rows[0]);
        } else {
            console.log('User not found. Ensure you have registered via the frontend with this email first.');
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

makeAdmin();
