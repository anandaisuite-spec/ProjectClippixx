/**
 * API Service Layer
 * Handles all communication with the Express backend.
 */

import { auth } from "@/services/firebase";

// VITE_API_URL is injected at build time (Docker build arg / .env). In dev it's
// the explicit http://localhost:5000/api; in production the Dockerfile sets it to
// the relative "/api" (same-origin — Express serves both the SPA and the API on
// one port, so there's no host to hardcode and no CORS). The fallback is "/api"
// so that even a missing env var stays same-origin-safe rather than pointing at
// localhost (which would break when the site is opened from another device).
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Backend responses are dynamically shaped ({ data }, { error }, { pagination }, …).
// The return type is inferred from `response.json()` so callers keep their existing
// `data.data` access and typed return annotations without an explicit `any`.
export async function apiRequest(endpoint: string, options: RequestInit = {}) {
    const url = `${API_BASE_URL}${endpoint}`;

    const buildHeaders = async (forceRefresh = false): Promise<Record<string, string>> => {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...((options.headers as Record<string, string>) || {}),
        };
        const user = auth.currentUser;
        if (user) {
            const token = await user.getIdToken(forceRefresh);
            headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
    };

    const response = await fetch(url, { ...options, headers: await buildHeaders() });

    // On a 401/403, the token may not have been ready yet — force-refresh and retry once.
    if (response.status === 401 || response.status === 403) {
        const retry = await fetch(url, { ...options, headers: await buildHeaders(true) });
        const data = await retry.json();
        if (!retry.ok) {
            const err = Object.assign(new Error(data.message || 'API request failed'), data);
            throw err;
        }
        return data;
    }

    const data = await response.json();
    if (!response.ok) {
        // Preserve all server fields (error, attemptsRemaining, lockedUntil, …) on the thrown error
        const err = Object.assign(new Error(data.message || 'API request failed'), data);
        throw err;
    }
    return data;
}

// ─── Site verification gate (Cloudflare Turnstile) ───────────

/** Verify a Turnstile token for the full-screen site gate. Throws on failure. */
export async function verifyTurnstileToken(turnstileToken: string): Promise<void> {
    await apiRequest('/auth/turnstile-verify', {
        method: 'POST',
        body: JSON.stringify({ turnstileToken }),
    });
}

/** Verify a Google reCAPTCHA token for the full-screen site gate. Throws on failure. */
export async function verifyRecaptchaToken(token: string): Promise<void> {
    await apiRequest('/auth/recaptcha-verify', {
        method: 'POST',
        body: JSON.stringify({ token }),
    });
}

// ─── Auth OTP — login ────────────────────────────────────────

/** Send a login OTP via email or phone. */
export async function sendOtp(channel: 'email' | 'phone', identifier: string, turnstileToken?: string): Promise<void> {
    await apiRequest('/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({ channel, identifier, turnstileToken }),
    });
}

/** Verify a login OTP and return a Firebase custom token. */
export async function verifyOtp(channel: 'email' | 'phone', identifier: string, code: string): Promise<string> {
    const data = await apiRequest('/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ channel, identifier, code }),
    });
    return data.customToken as string;
}

// ─── Auth OTP — signup ───────────────────────────────────────

export type SignupStartPayload = {
    name: string;
    email: string;
    phone: string;
    password: string;
    confirmPassword: string;
    turnstileToken?: string;
    /** Honeypot — always empty for real users. */
    website?: string;
};

/** Validate signup fields, store pending row, send both OTPs. */
export async function signupStart(payload: SignupStartPayload): Promise<void> {
    await apiRequest('/auth/signup/start', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export type SignupVerifyResult = {
    customToken: string;
};

/** Verify the shared 6-digit code; returns customToken on success. */
export async function signupVerify(email: string, code: string): Promise<SignupVerifyResult> {
    return await apiRequest('/auth/signup/verify', {
        method: 'POST',
        body: JSON.stringify({ email, code }),
    });
}

/** Resend the shared OTP to both email and phone. */
export async function signupResend(email: string): Promise<void> {
    await apiRequest('/auth/signup/resend', {
        method: 'POST',
        body: JSON.stringify({ email }),
    });
}

// ─── Domain Types ────────────────────────────────────────────

export type UserRole = 'user' | 'admin' | 'super_admin';
export type AccountType = 'fan' | 'creator';

export type Profile = {
    id: string;
    account_type: AccountType;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    avatar_url: string | null;
    bio: string;
    role: UserRole;
    created_at: string;
    updated_at: string;
};

export type PublicProfile = Pick<
    Profile,
    'id' | 'first_name' | 'last_name' | 'avatar_url' | 'bio' | 'account_type' | 'created_at'
>;

export type PaginationMeta = {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
};

export type PaginatedResponse<T> = {
    data: T[];
    pagination: PaginationMeta;
};

export type AdminStats = {
    totalUsers: number;
    totalCreators: number;
    totalStars: number;
    pendingApplications: number;
    pendingFeedback: number;
    totalAdmins: number;
    pendingVerifications: number;
};

export type AuditLog = {
    id: string;
    actor_id: string;
    actor_email: string;
    action: 'role_change' | 'user_delete' | 'admin_create_user' | 'profile_update_by_admin' | 'application_status_change' | 'admin_create_creator' | 'admin_reset_password' | 'audit_log_edited' | 'audit_log_deleted';
    target_id: string | null;
    target_email: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
};

export type AdminCreateUserData = {
    email: string;
    password: string;
    first_name: string;
    last_name?: string;
    role: UserRole;
};

// ─── Stars API ───────────────────────────────────────────────

export type Star = {
    id: string;
    name: string;
    category: string;
    image_url: string;
    rating: number;
    reviews_count: number;
    price: number;
    is_featured: boolean;
    bio: string;
    created_at: string;
};

type FetchStarsOptions = {
    category?: string;
    featured?: boolean;
    search?: string;
    sort?: string;
    order?: 'asc' | 'desc';
    limit?: number;
};

export async function fetchStars(options: FetchStarsOptions = {}): Promise<Star[]> {
    const params = new URLSearchParams();
    if (options.category && options.category !== 'All') params.append('category', options.category);
    if (options.featured) params.append('featured', 'true');
    if (options.search) params.append('search', options.search);
    if (options.sort) params.append('sort', options.sort);
    if (options.order) params.append('order', options.order);
    if (options.limit) params.append('limit', String(options.limit));
    const query = params.toString();
    const data = await apiRequest(`/stars${query ? `?${query}` : ''}`);
    return data.data;
}

export async function fetchStarById(id: string): Promise<Star> {
    const data = await apiRequest(`/stars/${id}`);
    return data.data;
}

// ─── Suggestions API ─────────────────────────────────────────

type SuggestionData = {
    celebrity_name: string;
    category: string;
    social_links?: string;
    reason?: string;
    submitter_email: string;
};

export async function submitSuggestion(formData: SuggestionData): Promise<void> {
    await apiRequest('/suggestions', { method: 'POST', body: JSON.stringify(formData) });
}

// ─── Applications API ────────────────────────────────────────

type ApplicationData = {
    full_name: string;
    email: string;
    category: string;
    social_links: string;
    followers_count?: string;
    bio: string;
    why_join: string;
};

export async function submitApplication(formData: ApplicationData): Promise<void> {
    await apiRequest('/applications', { method: 'POST', body: JSON.stringify(formData) });
}

// ─── Feedback API ────────────────────────────────────────────

type FeedbackData = {
    type: string;
    subject: string;
    message: string;
    email?: string;
};

export async function submitFeedback(formData: FeedbackData): Promise<void> {
    await apiRequest('/feedback', { method: 'POST', body: JSON.stringify(formData) });
}

// ─── Profiles API ────────────────────────────────────────────

type CreateProfileData = {
    account_type: AccountType;
    first_name: string;
    last_name: string;
    phone?: string;
    bio?: string;
    /** Cloudflare Turnstile token — verified server-side on POST /profiles. */
    turnstileToken?: string;
    /** Honeypot — hidden field; the backend silently drops signups that fill it. */
    website?: string;
};

type UpdateProfileData = Partial<Pick<Profile, 'first_name' | 'last_name' | 'phone' | 'avatar_url' | 'bio'>>;

export async function getMyProfile(): Promise<Profile> {
    const data = await apiRequest('/profiles/me');
    return data.data;
}

export type UserActivity = {
    applications: {
        id: string;
        full_name: string;
        category: string;
        status: 'pending' | 'reviewing' | 'approved' | 'rejected';
        created_at: string;
        updated_at: string;
    }[];
    suggestions: {
        id: string;
        celebrity_name: string;
        category: string;
        status: 'pending' | 'reviewed' | 'approved' | 'rejected';
        created_at: string;
    }[];
    feedback: {
        id: string;
        type: string;
        subject: string;
        created_at: string;
    }[];
};

export async function getMyActivity(): Promise<UserActivity> {
    const data = await apiRequest('/profiles/me/activity');
    return data.data;
}

export async function createProfile(profileData: CreateProfileData): Promise<Profile> {
    const data = await apiRequest('/profiles', { method: 'POST', body: JSON.stringify(profileData) });
    return data.data;
}

export async function updateProfile(updates: UpdateProfileData): Promise<Profile> {
    const data = await apiRequest('/profiles/me', { method: 'PUT', body: JSON.stringify(updates) });
    return data.data;
}

export async function getProfileById(id: string): Promise<PublicProfile> {
    const data = await apiRequest(`/profiles/${id}`);
    return data.data;
}

// ─── Admin — Profiles ────────────────────────────────────────

type ListProfilesOptions = {
    page?: number;
    limit?: number;
    search?: string;
    role?: UserRole;
};

export async function adminListProfiles(options: ListProfilesOptions = {}): Promise<PaginatedResponse<Profile>> {
    const params = new URLSearchParams();
    if (options.page)   params.append('page',   String(options.page));
    if (options.limit)  params.append('limit',  String(options.limit));
    if (options.search) params.append('search', options.search);
    if (options.role)   params.append('role',   options.role);
    const query = params.toString();
    return await apiRequest(`/profiles${query ? `?${query}` : ''}`);
}

export async function adminCreateUser(userData: AdminCreateUserData): Promise<Profile> {
    const data = await apiRequest('/profiles/admin/users', { method: 'POST', body: JSON.stringify(userData) });
    return data.data;
}

export async function adminUpdateRole(
    userId: string,
    role: UserRole
): Promise<Pick<Profile, 'id' | 'role' | 'email' | 'first_name'>> {
    const data = await apiRequest(`/profiles/${userId}/role`, { method: 'PUT', body: JSON.stringify({ role }) });
    return data.data;
}

export async function adminUpdateProfile(userId: string, updates: UpdateProfileData): Promise<Profile> {
    const data = await apiRequest(`/profiles/${userId}`, { method: 'PUT', body: JSON.stringify(updates) });
    return data.data;
}

export async function adminDeleteUser(userId: string): Promise<void> {
    await apiRequest(`/profiles/${userId}`, { method: 'DELETE' });
}

// ─── Admin — Create Creator (username + password, no email) ───

export type AdminCreateCreatorData = {
    username: string;
    password: string;
    first_name: string;
    last_name: string;
    star_name: string;
    category: 'Actor' | 'Athlete' | 'Creator' | 'Musician';
    price: number;
    image_url?: string;
};

export type AdminCreateCreatorResult = {
    username: string;
    profile_id: string;
    star_id: string;
};

export async function adminCreateCreator(data: AdminCreateCreatorData): Promise<AdminCreateCreatorResult> {
    const res = await apiRequest('/profiles/admin/create-creator', {
        method: 'POST',
        body: JSON.stringify(data),
    });
    return { username: res.username, profile_id: res.profile_id, star_id: res.star_id };
}

export async function adminResetPassword(userId: string, newPassword: string): Promise<void> {
    await apiRequest(`/profiles/${userId}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ new_password: newPassword }),
    });
}

// ─── Admin — Stars ────────────────────────────────────────────

export async function adminCreateStar(starData: Partial<Star>): Promise<Star> {
    const data = await apiRequest('/stars', { method: 'POST', body: JSON.stringify(starData) });
    return data.data;
}

export async function adminUpdateStar(starId: string, updates: Partial<Star>): Promise<Star> {
    const data = await apiRequest(`/stars/${starId}`, { method: 'PUT', body: JSON.stringify(updates) });
    return data.data;
}

export async function adminDeleteStar(starId: string): Promise<void> {
    await apiRequest(`/stars/${starId}`, { method: 'DELETE' });
}

// ─── Admin — Stats & Audit Logs ──────────────────────────────

export async function getAdminStats(): Promise<AdminStats> {
    const data = await apiRequest('/admin/stats');
    return data.data;
}

type ListAuditLogsOptions = {
    page?: number;
    limit?: number;
    action?: AuditLog['action'];
    actor_id?: string;
};

export async function getAuditLogs(options: ListAuditLogsOptions = {}): Promise<PaginatedResponse<AuditLog>> {
    const params = new URLSearchParams();
    if (options.page)     params.append('page',     String(options.page));
    if (options.limit)    params.append('limit',    String(options.limit));
    if (options.action)   params.append('action',   options.action);
    if (options.actor_id) params.append('actor_id', options.actor_id);
    const query = params.toString();
    return await apiRequest(`/admin/audit-logs${query ? `?${query}` : ''}`);
}

export type UpdateAuditLogData = {
    action?: AuditLog['action'];
    target_email?: string | null;
    metadata?: Record<string, unknown>;
};

/** Edit an audit log entry. Admin + super admin. */
export async function updateAuditLog(id: string, updates: UpdateAuditLogData): Promise<AuditLog> {
    const data = await apiRequest(`/admin/audit-logs/${id}`, { method: 'PUT', body: JSON.stringify(updates) });
    return data.data;
}

/** Delete an audit log entry. Admin + super admin. */
export async function deleteAuditLog(id: string): Promise<void> {
    await apiRequest(`/admin/audit-logs/${id}`, { method: 'DELETE' });
}

// ─── Public — Browse Creators ─────────────────────────────────

type BrowseUsersOptions = {
    page?: number;
    limit?: number;
    search?: string;
    sort?: 'created_at' | 'first_name';
    order?: 'asc' | 'desc';
};

export async function browseCreators(options: BrowseUsersOptions = {}): Promise<PaginatedResponse<PublicProfile>> {
    const params = new URLSearchParams();
    if (options.page)   params.append('page',  String(options.page));
    if (options.limit)  params.append('limit', String(options.limit));
    if (options.search) params.append('search', options.search);
    if (options.sort)   params.append('sort',  options.sort);
    if (options.order)  params.append('order', options.order);
    const query = params.toString();
    return await apiRequest(`/users${query ? `?${query}` : ''}`);
}

// ─── Admin — Applications ────────────────────────────────────

export type CreatorApplication = {
    id: string;
    full_name: string;
    email: string;
    category: string;
    social_links: string;
    followers_count: string;
    bio: string;
    why_join: string;
    status: 'pending' | 'reviewing' | 'approved' | 'rejected';
    created_at: string;
};

type ListApplicationsOptions = {
    page?: number;
    limit?: number;
    status?: CreatorApplication['status'];
};

export async function adminListApplications(options: ListApplicationsOptions = {}): Promise<PaginatedResponse<CreatorApplication>> {
    const params = new URLSearchParams();
    if (options.page)   params.append('page',   String(options.page));
    if (options.limit)  params.append('limit',  String(options.limit));
    if (options.status) params.append('status', options.status);
    const query = params.toString();
    return await apiRequest(`/applications${query ? `?${query}` : ''}`);
}

export async function adminUpdateApplicationStatus(
    applicationId: string,
    status: CreatorApplication['status']
): Promise<CreatorApplication> {
    const data = await apiRequest(`/applications/${applicationId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
    });
    return data.data;
}

// ─── Admin — Creator Verification ────────────────────────────

export type PendingVerification = {
    id: string;
    name: string;
    category: string;
    image_url: string;
    owner_id: string | null;
    platform: 'instagram' | 'youtube' | 'tiktok' | 'twitter' | null;
    follower_count: number | null;
    instagram_url: string | null;
    twitter_url: string | null;
    youtube_url: string | null;
    tiktok_url: string | null;
    identity_proof_url: string | null;
    identity_proof_type: 'aadhaar' | 'pan' | 'passport' | 'driving_license' | 'voter_id' | 'other' | null;
    ownership_code: string | null;
    ownership_method: 'bio' | 'story' | 'email' | null;
    is_verified: boolean;
    verification_status: 'unverified' | 'pending' | 'approved' | 'rejected';
    verification_notes: string | null;
    verified_at: string | null;
    owner_email: string | null;
    owner_first_name: string | null;
    owner_last_name: string | null;
};

export async function adminListPendingVerifications(): Promise<PendingVerification[]> {
    const data = await apiRequest('/verification/pending');
    return data.data;
}

export async function adminApproveVerification(starId: string): Promise<PendingVerification> {
    const data = await apiRequest(`/verification/${starId}/approve`, { method: 'PATCH' });
    return data.data;
}

export async function adminRejectVerification(starId: string, notes?: string): Promise<PendingVerification> {
    const data = await apiRequest(`/verification/${starId}/reject`, {
        method: 'PATCH',
        body: JSON.stringify({ notes: notes || '' }),
    });
    return data.data;
}

// ─── Admin — Creator Profile Enrichment (TMDB / Wikidata / Wikipedia + AI) ──

export type EnrichmentPreview = {
    name: string;
    bio: string;
    photo_url: string | null;
    known_for: string[];
    occupation: string | null;
    tmdb_id: number | null;
    wikidata_found: boolean;
};

export type VerificationScore = {
    score: number;
    verdict: 'auto_verified' | 'review_queue' | 'not_verified';
    breakdown: { signal: string; score: number }[];
};

export type EnrichmentResult = {
    preview: EnrichmentPreview;
    verification_score: VerificationScore;
    sources: string[];
    bio_source: 'groq' | 'template';
    tmdb_configured: boolean;
    message: string;
};

export async function adminEnrichCreator(
    starId: string,
    name: string,
    tmdbUrl?: string,
): Promise<EnrichmentResult> {
    return await apiRequest(`/admin/creators/${starId}/enrich`, {
        method: 'POST',
        body: JSON.stringify({ name, ...(tmdbUrl ? { tmdbUrl } : {}) }),
    });
}

export async function adminConfirmEnrichment(
    starId: string,
    preview: EnrichmentPreview,
    verificationScore: VerificationScore,
): Promise<{ data: Record<string, unknown>; auto_verified: boolean; message: string }> {
    return await apiRequest(`/admin/creators/${starId}/enrich/confirm`, {
        method: 'POST',
        body: JSON.stringify({ preview, verificationScore }),
    });
}

// ─── Creator Onboarding ──────────────────────────────────────

export type OnboardingStatus = {
    onboarding_completed: boolean;
    current_step: number; // 0=Profile, 1=Pricing, 2=Availability, 3=Done
    star_id: string;
};

export type OnboardingProfile = {
    username: string;
    bio: string;
    category: string;
    languages: string[];
};

export type PricingTierInput = {
    tier_name: string;
    description?: string;
    price: number;
    delivery_days: number;
};

export async function getOnboardingStatus(): Promise<OnboardingStatus> {
    return await apiRequest('/creator/onboarding-status');
}

export async function saveOnboardingProfile(payload: OnboardingProfile): Promise<void> {
    await apiRequest('/creator/onboarding/profile', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export async function saveOnboardingPricing(tiers: PricingTierInput[]): Promise<void> {
    await apiRequest('/creator/onboarding/pricing', {
        method: 'POST',
        body: JSON.stringify({ tiers }),
    });
}

export async function saveOnboardingAvailability(
    turnaround_days: number,
    accepting_bookings: boolean,
): Promise<void> {
    await apiRequest('/creator/onboarding/availability', {
        method: 'POST',
        body: JSON.stringify({ turnaround_days, accepting_bookings }),
    });
}

export async function completeOnboarding(): Promise<void> {
    await apiRequest('/creator/onboarding/complete', { method: 'POST' });
}

// ─── Creator Dashboard ───────────────────────────────────────

export type CreatorDashboardStats = {
    total_earnings: number;
    pending_count: number;
    accepted_count: number;
    in_progress_count: number;
    delivered_count: number;
    this_month_earnings: number;
    this_month_bookings: number;
    profile_completion: number;
};

export type BookingStatus = 'pending' | 'accepted' | 'in_progress' | 'delivered' | 'cancelled';

export type Booking = {
    id: string;
    fan_name: string | null;
    fan_message: string | null;
    tier_name: string | null;
    tier_price: number | null;
    status: BookingStatus;
    creator_note: string | null;
    video_url: string | null;
    created_at: string;
    updated_at: string;
};

export type BookingsPage = {
    bookings: Booking[];
    total: number;
    page: number;
    total_pages: number;
};

export async function getDashboardStats(): Promise<CreatorDashboardStats> {
    return await apiRequest('/creator/dashboard/stats');
}

export async function getDashboardBookings(
    opts: { status?: BookingStatus; page?: number; limit?: number } = {},
): Promise<BookingsPage> {
    const params = new URLSearchParams();
    if (opts.status) params.append('status', opts.status);
    if (opts.page) params.append('page', String(opts.page));
    if (opts.limit) params.append('limit', String(opts.limit));
    const q = params.toString();
    return await apiRequest(`/creator/dashboard/bookings${q ? `?${q}` : ''}`);
}

export async function updateBookingStatus(bookingId: string, status: BookingStatus): Promise<Booking> {
    return await apiRequest(`/creator/dashboard/bookings/${bookingId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
    });
}

export async function updateBookingNote(bookingId: string, creator_note: string): Promise<Booking> {
    return await apiRequest(`/creator/dashboard/bookings/${bookingId}/note`, {
        method: 'PATCH',
        body: JSON.stringify({ creator_note }),
    });
}

// ─── Video delivery ──────────────────────────────────────────

/** Deliver a video by external link. (File upload is not enabled yet.) */
export async function deliverVideoByLink(bookingId: string, video_url: string): Promise<Booking> {
    return await apiRequest(`/creator/dashboard/bookings/${bookingId}/deliver`, {
        method: 'POST',
        body: JSON.stringify({ delivery_method: 'link', video_url }),
    });
}

export type VideoUrlResponse = {
    url: string;
    filename: string | null;
    delivery_method: 'upload' | 'link';
};

export async function getBookingVideoUrl(bookingId: string): Promise<VideoUrlResponse> {
    return await apiRequest(`/creator/dashboard/bookings/${bookingId}/video-url`);
}

export type FanBooking = {
    id: string;
    creator_name: string | null;
    tier_name: string | null;
    tier_price: number | null;
    status: BookingStatus;
    fan_name: string | null;
    has_video: boolean;
    delivery_method: 'upload' | 'link' | null;
    video_delivered_at: string | null;
    created_at: string;
};

/** Fetch a single booking the logged-in user is party to (fan or creator). */
export async function getBookingForFan(bookingId: string): Promise<FanBooking> {
    return await apiRequest(`/creator/dashboard/bookings/${bookingId}`);
}

// ─── Creator Settings ────────────────────────────────────────

export type SettingsPricingTier = {
    id: string;
    tier_name: string;
    description: string | null;
    price: number;
    delivery_days: number;
    is_active: boolean;
};

export type CreatorSettings = {
    accepting_bookings: boolean;
    turnaround_days: number;
    bio: string | null;
    category: string | null;
    languages: string[];
    username: string | null;
    profile_picture_url: string | null;
    cover_image_url: string | null;
    pricing_tiers: SettingsPricingTier[];
    gallery: GalleryItem[];
};

export type CreatorSettingsPatch = Partial<{
    accepting_bookings: boolean;
    turnaround_days: number;
    bio: string;
    category: string;
    languages: string[];
}>;

export async function getCreatorSettings(): Promise<CreatorSettings> {
    return await apiRequest('/creator/dashboard/settings');
}

export async function updateCreatorSettings(patch: CreatorSettingsPatch): Promise<CreatorSettings> {
    return await apiRequest('/creator/dashboard/settings', {
        method: 'PATCH',
        body: JSON.stringify(patch),
    });
}

export async function toggleTierActive(tierId: string): Promise<{ id: string; is_active: boolean }> {
    return await apiRequest(`/creator/dashboard/settings/tiers/${tierId}/toggle`, {
        method: 'PATCH',
    });
}

// ─── Username ────────────────────────────────────────────────

export const USERNAME_RE = /^[a-z0-9_]{3,50}$/;

export async function checkUsername(username: string): Promise<{ available: boolean; reason?: string }> {
    return await apiRequest(`/creator/check-username?username=${encodeURIComponent(username)}`);
}

// ─── Media uploads (XHR for progress) ────────────────────────

export type GalleryItem = {
    id: string;
    media_url: string;
    media_type: 'image' | 'video';
    caption: string | null;
    sort_order: number;
    created_at: string;
};

/**
 * Upload a single file via XMLHttpRequest so callers get progress events.
 * Attaches the Firebase token; resolves with the parsed JSON body.
 */
async function uploadWithProgress<T>(
    path: string,
    field: string,
    file: File,
    onProgress?: (pct: number) => void,
): Promise<T> {
    const user = auth.currentUser;
    const token = user ? await user.getIdToken() : null;

    return new Promise<T>((resolve, reject) => {
        const form = new FormData();
        form.append(field, file);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API_BASE_URL}${path}`);
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        if (onProgress) {
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
            };
        }
        xhr.onload = () => {
            let body: unknown = {};
            try { body = JSON.parse(xhr.responseText); } catch { /* ignore */ }
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(body as T);
            } else {
                const msg = (body as { error?: string; message?: string })?.error
                    || (body as { message?: string })?.message
                    || 'Upload failed';
                reject(new Error(msg));
            }
        };
        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.send(form);
    });
}

export function uploadAvatar(file: File, onProgress?: (pct: number) => void): Promise<{ url: string }> {
    return uploadWithProgress('/creator/dashboard/upload-avatar', 'avatar', file, onProgress);
}

/**
 * Profile-picture upload for ANY logged-in account (fan/creator/admin) —
 * saved to profiles.avatar_url. (uploadAvatar above is creator-star-scoped.)
 */
export function uploadProfileAvatar(file: File, onProgress?: (pct: number) => void): Promise<{ url: string }> {
    return uploadWithProgress('/profiles/me/avatar', 'avatar', file, onProgress);
}

export function uploadCover(file: File, onProgress?: (pct: number) => void): Promise<{ url: string }> {
    return uploadWithProgress('/creator/dashboard/upload-cover', 'cover', file, onProgress);
}

export function uploadGalleryItem(file: File, onProgress?: (pct: number) => void): Promise<GalleryItem> {
    return uploadWithProgress('/creator/dashboard/gallery', 'media', file, onProgress);
}

export async function deleteGalleryItem(itemId: string): Promise<{ success: boolean }> {
    return await apiRequest(`/creator/dashboard/gallery/${itemId}`, { method: 'DELETE' });
}

// ─── Admin: booking management ───────────────────────────────

export type AdminBookingStatus = 'pending' | 'accepted' | 'in_progress' | 'delivered' | 'cancelled';

export type AdminBookingRow = {
    id: string;
    status: AdminBookingStatus;
    tier_name: string | null;
    tier_price: number | null;
    occasion: string | null;
    is_gift: boolean | null;
    gift_recipient_name: string | null;
    created_at: string;
    updated_at: string;
    fan_name: string | null;
    fan_email: string | null;
    fan_first_name: string | null;
    fan_last_name: string | null;
    creator_id: string | null;
    creator_name: string | null;
};

export type AdminBookingDetail = AdminBookingRow & {
    fan_id: string | null;
    tier_id: string | null;
    fan_message: string | null;
    creator_note: string | null;
    instructions: string | null;
    video_url: string | null;
    video_delivered_at: string | null;
    gift_recipient_email: string | null;
    creator_username: string | null;
    creator_category: string | null;
};

export async function adminListBookings(
    opts: { page?: number; limit?: number; status?: AdminBookingStatus; search?: string } = {},
): Promise<{ data: AdminBookingRow[]; pagination: { page: number; limit: number; total: number; total_pages: number } }> {
    const params = new URLSearchParams();
    if (opts.page) params.set('page', String(opts.page));
    if (opts.limit) params.set('limit', String(opts.limit));
    if (opts.status) params.set('status', opts.status);
    if (opts.search) params.set('search', opts.search);
    const q = params.toString();
    return await apiRequest(`/admin/bookings${q ? `?${q}` : ''}`);
}

export async function adminGetBooking(id: string): Promise<AdminBookingDetail> {
    const res = await apiRequest(`/admin/bookings/${id}`);
    return res.data;
}

export async function adminUpdateBookingStatus(id: string, status: AdminBookingStatus): Promise<void> {
    await apiRequest(`/admin/bookings/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
}

// ─── Booking reviews ─────────────────────────────────────────

export type BookingReview = {
    id: string;
    booking_id: string;
    rating: number;
    review_text: string | null;
    created_at: string;
};

export type PublicReview = {
    id: string;
    rating: number;
    review_text: string | null;
    created_at: string;
    fan_name: string | null;
};

export async function submitBookingReview(
    booking_id: string,
    rating: number,
    review_text?: string,
): Promise<BookingReview> {
    return await apiRequest('/booking-reviews', {
        method: 'POST',
        body: JSON.stringify({ booking_id, rating, review_text }),
    });
}

export async function getMyBookingReview(bookingId: string): Promise<BookingReview | null> {
    const data = await apiRequest(`/booking-reviews/booking/${bookingId}`);
    return data.review;
}

export async function getStarReviews(
    starId: string,
    page = 1,
    limit = 5,
): Promise<{ data: PublicReview[]; pagination: { page: number; total: number; totalPages: number } }> {
    return await apiRequest(`/stars/${starId}/reviews?page=${page}&limit=${limit}`);
}

// ─── Create booking ──────────────────────────────────────────

export type CreateBookingPayload = {
    creator_id: string;
    tier_id: string;
    fan_name: string;
    video_for: 'myself' | 'someone_else';
    occasion?: string;
    instructions?: string;
    is_gift?: boolean;
    gift_recipient_name?: string;
    gift_recipient_email?: string;
};

export type CreatedBooking = {
    id: string;
    status: BookingStatus;
    tier_name: string | null;
    tier_price: number | null;
    created_at: string;
};

export async function createBooking(payload: CreateBookingPayload): Promise<CreatedBooking> {
    return await apiRequest('/bookings', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

// ─── Fan Dashboard ───────────────────────────────────────────

export type FanDashboardStats = {
    total_bookings: number;
    pending_count: number;
    delivered_count: number;
    reviews_left: number;
    videos_received: number;
};

export type FanBookingCreator = {
    id: string | null;
    display_name: string | null;
    profile_picture_url: string | null;
    username: string | null;
    category: string | null;
};

export type FanBookingRow = {
    id: string;
    status: BookingStatus;
    tier_name: string | null;
    tier_price: number | null;
    occasion: string | null;
    is_gift: boolean;
    gift_recipient_name: string | null;
    fan_message: string | null;
    instructions: string | null;
    video_url: string | null;
    video_delivered_at: string | null;
    created_at: string;
    updated_at: string;
    has_review: boolean;
    creator: FanBookingCreator;
};

export type FanReview = {
    id: string;
    rating: number;
    review_text: string | null;
    created_at: string;
    creator: { id: string | null; display_name: string | null; profile_picture_url: string | null };
};

export async function getFanStats(): Promise<FanDashboardStats> {
    return await apiRequest('/fan/dashboard/stats');
}

export async function getFanBookings(
    opts: { status?: BookingStatus; page?: number; limit?: number } = {},
): Promise<{ bookings: FanBookingRow[]; total: number; page: number; total_pages: number }> {
    const params = new URLSearchParams();
    if (opts.status) params.append('status', opts.status);
    if (opts.page) params.append('page', String(opts.page));
    if (opts.limit) params.append('limit', String(opts.limit));
    const q = params.toString();
    return await apiRequest(`/fan/dashboard/bookings${q ? `?${q}` : ''}`);
}

export async function getFanVideos(): Promise<{ videos: FanBookingRow[] }> {
    return await apiRequest('/fan/dashboard/videos');
}

export async function getFanReviews(): Promise<{ reviews: FanReview[] }> {
    return await apiRequest('/fan/dashboard/reviews');
}

export async function updateFanSettings(
    patch: { display_name?: string; phone?: string },
): Promise<{ display_name: string; phone: string | null; email: string | null }> {
    return await apiRequest('/fan/dashboard/settings', {
        method: 'PATCH',
        body: JSON.stringify(patch),
    });
}

// ─── Explore (public discovery) ──────────────────────────────

export type ExploreSort = 'popular' | 'rating' | 'price_low' | 'price_high' | 'newest';

export type ExploreCreator = {
    id: string;
    display_name: string | null;
    username: string | null;
    profile_picture_url: string | null;
    cover_image_url: string | null;
    category: string | null;
    bio: string | null;
    avg_rating: number;
    review_count: number;
    languages: string[];
    starting_price: number;
    min_delivery_days: number;
    verified: boolean;
    bookings_count: number;
};

export type ExploreQuery = {
    q?: string;
    category?: string;
    min_price?: number;
    max_price?: number;
    rating?: number;
    language?: string;
    sort?: ExploreSort;
    page?: number;
    limit?: number;
};

export type ExploreFilters = {
    categories: string[];
    languages: string[];
    price_range: { min: number; max: number };
    max_rating: number;
};

export async function getExplore(
    query: ExploreQuery = {},
): Promise<{ creators: ExploreCreator[]; total: number; page: number; total_pages: number }> {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
        if (v !== undefined && v !== '' && v !== null) params.append(k, String(v));
    });
    const qs = params.toString();
    return await apiRequest(`/explore${qs ? `?${qs}` : ''}`);
}

export async function getExploreFilters(): Promise<ExploreFilters> {
    return await apiRequest('/explore/filters');
}

// ─── Admin — Feedback ────────────────────────────────────────

export type FeedbackItem = {
    id: string;
    type: 'Bug Report' | 'Feature Request' | 'General Feedback' | 'Other';
    subject: string;
    message: string;
    email: string;
    created_at: string;
};

type ListFeedbackOptions = {
    page?: number;
    limit?: number;
    type?: FeedbackItem['type'];
};

export async function adminListFeedback(options: ListFeedbackOptions = {}): Promise<PaginatedResponse<FeedbackItem>> {
    const params = new URLSearchParams();
    if (options.page)  params.append('page',  String(options.page));
    if (options.limit) params.append('limit', String(options.limit));
    if (options.type)  params.append('type',  options.type);
    const query = params.toString();
    return await apiRequest(`/feedback${query ? `?${query}` : ''}`);
}
