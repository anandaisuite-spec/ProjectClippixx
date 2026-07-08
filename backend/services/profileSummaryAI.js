'use strict';

/**
 * Creator bio generation.
 *
 * If GROQ_API_KEY is set, generate a polished bio via Groq/LLaMA. Otherwise
 * fall back to a deterministic template built from the same facts, so the
 * feature works with no external dependency or key.
 */

let groqClient = null;
function getGroq() {
    if (groqClient) return groqClient;
    if (!process.env.GROQ_API_KEY) return null;
    // Lazy require so the dependency is only touched when a key is configured.
    const Groq = require('groq-sdk');
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
    return groqClient;
}

/** Deterministic, no-LLM fallback bio assembled from the facts. */
function templateBio(facts) {
    const name = facts.name || 'This creator';
    const occupation = facts.occupation || 'creator';
    const known = Array.isArray(facts.knownFor) ? facts.knownFor.filter(Boolean) : [];

    // Prefer a trimmed Wikipedia/source paragraph when we have one.
    if (facts.wikipediaSummary && facts.wikipediaSummary.length > 40) {
        const trimmed = facts.wikipediaSummary.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ');
        return trimmed.length > 320 ? `${trimmed.slice(0, 317)}…` : trimmed;
    }

    let bio = `${name} is a celebrated ${occupation.toLowerCase()}`;
    if (known.length >= 2) bio += `, best known for ${known[0]} and ${known[1]}`;
    else if (known.length === 1) bio += `, best known for ${known[0]}`;
    bio += '.';
    if (known.length > 2) {
        bio += ` Their work also includes ${known.slice(2, 4).join(' and ')}.`;
    }
    return bio;
}

async function generateCreatorSummary(facts) {
    const groq = getGroq();

    // No key → template fallback.
    if (!groq) {
        return { bio: templateBio(facts), source: 'template' };
    }

    const prompt = `
You are writing a short, engaging creator bio for a booking platform.
Based on these facts, write a 2-3 sentence bio in third person:

Name: ${facts.name}
Occupation: ${facts.occupation || 'Creator'}
Known for: ${facts.knownFor?.join(', ') || 'Not specified'}
Background: ${facts.bio || 'Not available'}
Awards: ${facts.awards?.join(', ') || 'None listed'}

Write a confident, professional bio. Do not mention the platform name. Keep it under 60 words.
    `.trim();

    try {
        const completion = await groq.chat.completions.create({
            model: 'llama-3.1-8b-instant',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 150,
        });
        const text = completion.choices[0]?.message?.content?.trim();
        if (text) return { bio: text, source: 'groq' };
        return { bio: templateBio(facts), source: 'template' };
    } catch (err) {
        // LLM failure must not break enrichment — fall back to template.
        console.error('[profileSummaryAI] Groq generation failed, using template:', err.message);
        return { bio: templateBio(facts), source: 'template' };
    }
}

module.exports = { generateCreatorSummary, templateBio };
