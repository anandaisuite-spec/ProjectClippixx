'use strict';

/**
 * Creator enrichment via free, open APIs — TMDB, Wikidata SPARQL, Wikipedia.
 * IMDb is intentionally excluded (scraping it violates their terms).
 *
 * Uses Node's global fetch (Node 18+), so no node-fetch dependency.
 * Every call is defensive: network/parse failures resolve to null/[] rather
 * than throwing, so a single failing source never breaks enrichment.
 */

const UA = 'Clipixx/1.0 (https://clipixx.com)';
const TMDB_TIMEOUT_MS = 8000;

const tmdbKey = () => process.env.TMDB_API_KEY || '';
const tmdbConfigured = () => Boolean(tmdbKey());

/** fetch with a timeout that never throws — returns parsed JSON or null. */
async function safeJson(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeout || TMDB_TIMEOUT_MS);
    try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

/** Pull the numeric person id out of a TMDB URL like /person/12345-name. */
function extractTmdbId(tmdbUrl) {
    if (!tmdbUrl || typeof tmdbUrl !== 'string') return null;
    const m = tmdbUrl.match(/person\/(\d+)/);
    return m ? parseInt(m[1], 10) : null;
}

// 1. Search TMDB by name → first result (or null).
async function searchTMDB(name) {
    if (!tmdbConfigured() || !name) return null;
    const url = `https://api.themoviedb.org/3/search/person?query=${encodeURIComponent(name)}&api_key=${tmdbKey()}`;
    const data = await safeJson(url);
    return data?.results?.[0] || null;
}

// 2. Full TMDB person details + credits + external ids.
async function getTMDBPerson(tmdbId) {
    if (!tmdbConfigured() || !tmdbId) return null;
    const url = `https://api.themoviedb.org/3/person/${tmdbId}?api_key=${tmdbKey()}&append_to_response=combined_credits,external_ids`;
    return safeJson(url);
}

// 3. Wikidata SPARQL by exact English label.
async function searchWikidata(name) {
    if (!name) return [];
    const query = `
        SELECT ?item ?itemLabel ?description ?image ?occupationLabel WHERE {
          ?item wdt:P31 wd:Q5.
          ?item rdfs:label "${name.replace(/"/g, '')}"@en.
          OPTIONAL { ?item wdt:P18 ?image. }
          OPTIONAL { ?item wdt:P106 ?occupation. }
          SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
        } LIMIT 3
    `;
    const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`;
    const data = await safeJson(url, { headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' } });
    return data?.results?.bindings || [];
}

// 4. Wikipedia REST summary.
async function getWikipediaSummary(name) {
    if (!name) return null;
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`;
    return safeJson(url, { headers: { 'User-Agent': UA } });
}

/**
 * Orchestrate all sources into a single facts + preview object.
 * Returns: { preview, facts, sources, tmdbFound }
 */
async function enrichCreator({ name, tmdbUrl }) {
    const sources = [];

    // Resolve TMDB id from URL, else search by name.
    let tmdbId = extractTmdbId(tmdbUrl);
    if (!tmdbId && tmdbConfigured()) {
        const hit = await searchTMDB(name);
        tmdbId = hit?.id || null;
    }

    // Fetch everything in parallel.
    const [tmdbPerson, wikidata, wiki] = await Promise.all([
        tmdbId ? getTMDBPerson(tmdbId) : Promise.resolve(null),
        searchWikidata(name),
        getWikipediaSummary(name),
    ]);

    const tmdbFound = Boolean(tmdbPerson);
    if (tmdbFound) sources.push('TMDB');
    if (wikidata.length > 0) sources.push('Wikidata');
    if (wiki?.extract) sources.push('Wikipedia');

    // Known-for: top cast credits by popularity.
    const knownFor = (tmdbPerson?.combined_credits?.cast || [])
        .filter((c) => c.title || c.name)
        .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
        .slice(0, 5)
        .map((c) => c.title || c.name);

    const occupation =
        tmdbPerson?.known_for_department ||
        wikidata[0]?.occupationLabel?.value ||
        null;

    const awards = []; // reserved — Wikidata award queries can be added later.

    const bgBio = tmdbPerson?.biography || wiki?.extract || wikidata[0]?.description?.value || '';

    const photoUrl = tmdbPerson?.profile_path
        ? `https://image.tmdb.org/t/p/w500${tmdbPerson.profile_path}`
        : (wikidata[0]?.image?.value || null);

    const facts = {
        name: tmdbPerson?.name || name,
        occupation,
        knownFor,
        bio: bgBio,
        awards,
        wikipediaSummary: wiki?.extract || null,
    };

    const preview = {
        name: facts.name,
        bio: bgBio,            // replaced with AI/template bio by the caller
        photo_url: photoUrl,
        known_for: knownFor,
        occupation,
        tmdb_id: tmdbId || null,
        wikidata_found: wikidata.length > 0,
    };

    return { preview, facts, sources, tmdbFound };
}

module.exports = {
    searchTMDB,
    getTMDBPerson,
    searchWikidata,
    getWikipediaSummary,
    extractTmdbId,
    enrichCreator,
    tmdbConfigured,
};
