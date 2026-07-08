'use strict';

/**
 * Suggestions business logic + data access.
 * Behavior identical to pre-refactor routes/suggestions.js: same INSERT, same
 * returned fields, same empty-string fallbacks for optional columns.
 */

const pool = require('../../config/db');

/**
 * Insert a star suggestion.
 * @returns {{ id, celebrity_name, category, status, created_at }}
 */
async function submitSuggestion({ celebrity_name, category, social_links, reason, submitter_email }) {
    const result = await pool.query(
        `INSERT INTO star_suggestions (celebrity_name, category, social_links, reason, submitter_email)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, celebrity_name, category, status, created_at`,
        [celebrity_name, category, social_links || '', reason || '', submitter_email],
    );
    return result.rows[0];
}

module.exports = { submitSuggestion };
