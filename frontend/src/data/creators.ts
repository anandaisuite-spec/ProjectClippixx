/**
 * Marketplace data layer — now backed by the real /api/stars endpoints.
 * `Creator` is the live `Star` shape (real UUID ids, no slug/gallery/tags).
 */
import { getStars, getStarById } from '../services/api-extensions';
import type { Star } from '../services/api-extensions';

export type Creator = Star;

export async function getAllCreators(): Promise<Creator[]> {
    const result = await getStars({ limit: 50, sort: 'rating', order: 'desc' });
    return result.data;
}

export async function getCreatorById(id: string): Promise<Creator | null> {
    try {
        return await getStarById(id);
    } catch {
        return null;
    }
}
