'use strict';

/**
 * Weighted verification score from available trust signals.
 *
 *   TMDB/Wikidata match ............. 15
 *   Verified social account badge ... 30
 *   Government ID uploaded .......... 40
 *   Agency email verified ........... 20
 *   Ownership proof confirmed ....... 15
 *
 * Verdict thresholds:
 *   score >= 60 → auto_verified
 *   score 40–59 → review_queue
 *   score < 40  → not_verified
 */
function calculateVerificationScore(signals = {}) {
    let score = 0;
    const breakdown = [];

    const add = (cond, label, points) => {
        if (cond) {
            score += points;
            breakdown.push({ signal: label, score: points });
        }
    };

    add(signals.tmdbFound, 'TMDB/Wikidata match', 15);
    add(signals.hasVerifiedSocialBadge, 'Verified social account badge', 30);
    add(signals.governmentIdUploaded, 'Government ID uploaded', 40);
    add(signals.agencyEmailVerified, 'Agency email verified', 20);
    add(signals.ownershipCodeConfirmed, 'Ownership proof confirmed', 15);

    let verdict;
    if (score >= 60) verdict = 'auto_verified';
    else if (score >= 40) verdict = 'review_queue';
    else verdict = 'not_verified';

    return { score, verdict, breakdown };
}

module.exports = { calculateVerificationScore };
