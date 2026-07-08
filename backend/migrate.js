/**
 * Simple migration runner for Clipixx.
 * Tracks applied migrations in a `schema_migrations` table.
 *
 * Usage:
 *   node migrate.js          - Run all pending migrations
 *   node migrate.js --status - Show migration status
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const requiredEnvVars = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
for (const key of requiredEnvVars) {
    if (!process.env[key]) {
        console.error(`FATAL: Missing required env var: ${key}`);
        process.exit(1);
    }
}

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function ensureMigrationsTable() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            id SERIAL PRIMARY KEY,
            filename TEXT NOT NULL UNIQUE,
            applied_at TIMESTAMPTZ DEFAULT now()
        );
    `);
}

async function getAppliedMigrations() {
    const result = await pool.query('SELECT filename FROM schema_migrations ORDER BY filename');
    return new Set(result.rows.map((r) => r.filename));
}

async function getPendingMigrations() {
    const applied = await getAppliedMigrations();
    const allFiles = fs
        .readdirSync(MIGRATIONS_DIR)
        .filter((f) => f.endsWith('.sql'))
        .sort();
    return allFiles.filter((f) => !applied.has(f));
}

async function runMigrations() {
    await ensureMigrationsTable();
    const pending = await getPendingMigrations();

    if (pending.length === 0) {
        console.log('✅ All migrations are up to date.');
        return;
    }

    console.log(`\n📦 Running ${pending.length} pending migration(s)...\n`);

    for (const filename of pending) {
        const filepath = path.join(MIGRATIONS_DIR, filename);
        const sql = fs.readFileSync(filepath, 'utf-8');

        console.log(`  ⏳ Running: ${filename}`);

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query(sql);
            await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
            await client.query('COMMIT');
            console.log(`  ✅ Applied: ${filename}`);
        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`  ❌ Failed:  ${filename}`);
            console.error(`     Error:   ${error.message}`);
            process.exit(1);
        } finally {
            client.release();
        }
    }

    console.log(`\n✅ All migrations applied successfully.\n`);
}

async function showStatus() {
    await ensureMigrationsTable();
    const applied = await getAppliedMigrations();
    const allFiles = fs
        .readdirSync(MIGRATIONS_DIR)
        .filter((f) => f.endsWith('.sql'))
        .sort();

    console.log('\n📋 Migration Status:\n');
    for (const f of allFiles) {
        const status = applied.has(f) ? '✅' : '⏳';
        console.log(`  ${status} ${f}`);
    }
    console.log('');
}

async function main() {
    try {
        if (process.argv.includes('--status')) {
            await showStatus();
        } else {
            await runMigrations();
        }
    } catch (error) {
        console.error('Migration error:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
