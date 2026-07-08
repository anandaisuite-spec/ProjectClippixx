'use strict';

/**
 * Cloudflare R2 (S3-compatible) media storage.
 *
 * Lazily constructs the S3 client only when all R2 env vars are present, so the
 * app boots fine without storage configured. Every operation is defensive:
 *   - isConfigured() lets routes return a clean 503 instead of crashing.
 *   - uploadBuffer / deleteObject reject with a tagged error on failure; callers
 *     decide how to respond (uploads must never crash the request).
 */

const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

let client = null;

function isConfigured() {
    return Boolean(
        process.env.R2_ACCOUNT_ID &&
        process.env.R2_ACCESS_KEY_ID &&
        process.env.R2_SECRET_ACCESS_KEY &&
        process.env.R2_BUCKET_NAME &&
        process.env.R2_PUBLIC_URL,
    );
}

function getClient() {
    if (client) return client;
    if (!isConfigured()) return null;
    client = new S3Client({
        region: 'auto',
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: process.env.R2_ACCESS_KEY_ID,
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        },
    });
    return client;
}

/** Build the public URL for a stored object key. */
function publicUrl(key) {
    const base = (process.env.R2_PUBLIC_URL || '').replace(/\/+$/, '');
    return `${base}/${key}`;
}

/**
 * Upload a buffer. Returns { url, key }. Throws on failure (caller catches).
 * @param {Buffer} buffer
 * @param {string} key      object key, e.g. "avatars/<id>/<ts>.jpg"
 * @param {string} contentType
 */
async function uploadBuffer(buffer, key, contentType) {
    const s3 = getClient();
    if (!s3) {
        const err = new Error('R2 storage is not configured');
        err.code = 'R2_NOT_CONFIGURED';
        throw err;
    }
    await s3.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: contentType,
    }));
    return { url: publicUrl(key), key };
}

/**
 * Best-effort delete by either a stored key or a full public URL.
 * Never throws — returns true/false so DB cleanup can proceed regardless.
 */
async function deleteObject(keyOrUrl) {
    const s3 = getClient();
    if (!s3) return false;
    let key = keyOrUrl;
    const base = (process.env.R2_PUBLIC_URL || '').replace(/\/+$/, '');
    if (base && keyOrUrl.startsWith(base)) {
        key = keyOrUrl.slice(base.length + 1);
    }
    try {
        await s3.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }));
        return true;
    } catch (err) {
        console.error('[r2] delete failed:', err.message);
        return false;
    }
}

/** Extract the object key from a public URL (null if not one of ours). */
function keyFromUrl(url) {
    const base = (process.env.R2_PUBLIC_URL || '').replace(/\/+$/, '');
    if (base && url && url.startsWith(base)) return url.slice(base.length + 1);
    return null;
}

module.exports = { isConfigured, uploadBuffer, deleteObject, publicUrl, keyFromUrl };
