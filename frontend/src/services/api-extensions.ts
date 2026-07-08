/**
 * API Extensions — Orders, Reviews, Verification (Creator features).
 * Builds on the shared `apiRequest` helper (auto-attaches Firebase auth token).
 */
import { apiRequest, type PaginatedResponse } from './api';

// ─── Stars (creators marketplace) ────────────────────────────

export type PricingTier = {
    id: string;
    tier_name: string;
    description: string | null;
    price: number;
    delivery_days: number;
};

export type GalleryMedia = {
    id: string;
    media_url: string;
    media_type: 'image' | 'video';
    caption: string | null;
    sort_order: number;
    created_at: string;
};

export type Star = {
    id: string;
    name: string;
    category: string;
    image_url: string;
    rating: number;
    reviews_count: number;
    price: number;
    is_featured: boolean;
    is_verified: boolean;
    bio?: string;
    instagram_url?: string | null;
    youtube_url?: string | null;
    twitter_url?: string | null;
    accepting_bookings?: boolean;
    pricing_tiers?: PricingTier[];
    username?: string | null;
    profile_picture_url?: string | null;
    cover_image_url?: string | null;
    avg_rating?: number;
    review_count?: number;
    gallery?: GalleryMedia[];
    created_at?: string;
    updated_at?: string;
};

type GetStarsOptions = {
    category?: string;
    search?: string;
    sort?: 'name' | 'rating' | 'price' | 'reviews_count' | 'created_at';
    order?: 'asc' | 'desc';
    page?: number;
    limit?: number;
};

export async function getStars(options: GetStarsOptions = {}): Promise<PaginatedResponse<Star>> {
    const params = new URLSearchParams();
    Object.entries(options).forEach(([k, v]) => { if (v !== undefined) params.append(k, String(v)); });
    const query = params.toString();
    return await apiRequest(`/stars${query ? `?${query}` : ''}`);
}

export async function getStarById(id: string): Promise<Star> {
    const data = await apiRequest(`/stars/${id}`);
    return data.data;
}

// ─── Orders ──────────────────────────────────────────────────

export type OrderType =
    | 'birthday_wish'
    | 'shoutout'
    | 'brand_promotion'
    | 'product_launch'
    | 'event_invitation'
    | 'chief_guest'
    | 'emcee'
    | 'pep_talk'
    | 'roast'
    | 'custom';

export type OrderStatus =
    | 'pending'
    | 'accepted'
    | 'rejected'
    | 'in_progress'
    | 'delivered'
    | 'completed'
    | 'cancelled'
    | 'refunded';

export type Order = {
    id: string;
    buyer_id: string;
    buyer_name: string;
    buyer_email: string;
    star_id: string;
    order_type: OrderType;
    status: OrderStatus;
    recipient_name: string | null;
    occasion: string | null;
    instructions: string | null;
    price: number;
    company_name: string | null;
    event_name: string | null;
    event_date: string | null;
    video_url: string | null;
    video_duration: number | null;
    delivered_at: string | null;
    delivery_deadline: string | null;
    accepted_at: string | null;
    completed_at: string | null;
    cancelled_at: string | null;
    cancel_reason: string | null;
    payment_status: string | null;
    star_name: string | null;
    star_image: string | null;
    star_category: string | null;
    created_at: string;
    updated_at: string;
};

// All counts come back as strings from the DB aggregate query.
export type CreatorStats = {
    pending_count: string;
    accepted_count: string;
    in_progress_count: string;
    delivered_count: string;
    completed_count: string;
    cancelled_count: string;
    total_orders: string;
    total_earnings: string;
};

export type CreateOrderData = {
    star_id: string;
    order_type: OrderType;
    recipient_name?: string;
    occasion?: string;
    instructions?: string;
    company_name?: string;
    event_name?: string;
    event_date?: string;
    delivery_deadline?: string;
};

// ─── Reviews ─────────────────────────────────────────────────

export type Review = {
    id: string;
    order_id: string;
    rating: number;
    review_text: string | null;
    first_name: string;
    last_name: string;
    avatar_url: string | null;
    star_name?: string;
    star_image?: string;
    created_at: string;
};

export type RatingBreakdown = {
    rating: number;
    count: string;
};

// ─── Verification ────────────────────────────────────────────

export type VerificationStatus = 'unverified' | 'pending' | 'approved' | 'verified' | 'rejected';

export type IdentityProofType =
    | 'aadhaar'
    | 'pan'
    | 'passport'
    | 'driving_license'
    | 'voter_id'
    | 'other';

export type SocialPlatform = 'instagram' | 'youtube' | 'tiktok' | 'twitter';

export type OwnershipMethod = 'bio' | 'story' | 'email';

export type VerificationInfo = {
    id: string;
    name?: string;
    verification_status: VerificationStatus;
    is_verified: boolean;
    verified_at: string | null;
    platform: SocialPlatform | null;
    follower_count: number | null;
    instagram_url: string | null;
    youtube_url: string | null;
    twitter_url: string | null;
    tiktok_url?: string | null;
    identity_proof_url?: string | null;
    identity_proof_type: IdentityProofType | null;
    ownership_code: string | null;
    ownership_method: OwnershipMethod | null;
    verification_notes?: string | null;
};

export type SubmitVerificationData = {
    star_id?: string;
    platform?: SocialPlatform;
    follower_count?: number;
    instagram_url?: string;
    youtube_url?: string;
    twitter_url?: string;
    tiktok_url?: string;
    identity_proof_url: string;
    identity_proof_type: IdentityProofType;
    /** Digital ownership consent — required by the backend. */
    consent: boolean;
};

type ListOrdersOptions = { status?: OrderStatus; page?: number; limit?: number };

function buildQuery(options: Record<string, string | number | undefined>): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(options)) {
        if (value !== undefined && value !== null && value !== '') {
            params.append(key, String(value));
        }
    }
    const q = params.toString();
    return q ? `?${q}` : '';
}

// ─── Orders API ──────────────────────────────────────────────

export async function createOrder(data: CreateOrderData): Promise<Order> {
    const res = await apiRequest('/orders', { method: 'POST', body: JSON.stringify(data) });
    return res.data;
}

export async function getMyOrders(options: ListOrdersOptions = {}): Promise<PaginatedResponse<Order>> {
    return await apiRequest(`/orders${buildQuery(options)}`);
}

export async function getIncomingOrders(options: ListOrdersOptions = {}): Promise<PaginatedResponse<Order>> {
    return await apiRequest(`/orders/incoming${buildQuery(options)}`);
}

export async function getOrderById(orderId: string): Promise<Order> {
    const res = await apiRequest(`/orders/${orderId}`);
    return res.data;
}

export async function updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    cancelReason?: string,
): Promise<Order> {
    const res = await apiRequest(`/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, ...(cancelReason ? { cancel_reason: cancelReason } : {}) }),
    });
    return res.data;
}

export async function deliverOrder(
    orderId: string,
    videoUrl: string,
    videoDuration?: number,
): Promise<Order> {
    const res = await apiRequest(`/orders/${orderId}/deliver`, {
        method: 'PATCH',
        body: JSON.stringify({ video_url: videoUrl, ...(videoDuration ? { video_duration: videoDuration } : {}) }),
    });
    return res.data;
}

export async function getCreatorStats(): Promise<CreatorStats> {
    const res = await apiRequest('/orders/stats/creator');
    return res.data;
}

// ─── Reviews API ─────────────────────────────────────────────

export async function submitReview(
    orderId: string,
    rating: number,
    reviewText?: string,
): Promise<Review> {
    const res = await apiRequest('/reviews', {
        method: 'POST',
        body: JSON.stringify({ order_id: orderId, rating, ...(reviewText ? { review_text: reviewText } : {}) }),
    });
    return res.data;
}

export async function getStarReviews(
    starId: string,
    page?: number,
    limit?: number,
): Promise<PaginatedResponse<Review> & { breakdown?: RatingBreakdown[] }> {
    return await apiRequest(`/reviews/star/${starId}${buildQuery({ page, limit })}`);
}

export async function getMyReviews(): Promise<Review[]> {
    const res = await apiRequest('/reviews/my');
    return res.data;
}

export async function updateReview(
    reviewId: string,
    rating: number,
    reviewText?: string,
): Promise<Review> {
    const res = await apiRequest(`/reviews/${reviewId}`, {
        method: 'PUT',
        body: JSON.stringify({ rating, ...(reviewText ? { review_text: reviewText } : {}) }),
    });
    return res.data;
}

export async function deleteReview(reviewId: string): Promise<void> {
    await apiRequest(`/reviews/${reviewId}`, { method: 'DELETE' });
}

// ─── Verification API ────────────────────────────────────────

export async function submitVerification(data: SubmitVerificationData): Promise<VerificationInfo> {
    // Backend validates consent with .equals('true'), so send it as a string.
    const payload = { ...data, consent: data.consent ? 'true' : 'false' };
    const res = await apiRequest('/verification/submit', { method: 'POST', body: JSON.stringify(payload) });
    return res.data;
}

export async function getVerificationStatus(): Promise<VerificationInfo | null> {
    const res = await apiRequest('/verification/status');
    return res.data;
}

/**
 * Creator confirms they've placed the ownership code (bio / story / email) and
 * asks an admin to review. Moves the request to 'pending'.
 */
export async function notifyAdminVerification(
    ownershipMethod: OwnershipMethod,
    starId?: string,
): Promise<VerificationInfo> {
    const res = await apiRequest('/verification/notify-admin', {
        method: 'POST',
        body: JSON.stringify({ ownership_method: ownershipMethod, ...(starId ? { star_id: starId } : {}) }),
    });
    return res.data;
}
