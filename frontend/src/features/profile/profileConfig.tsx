import type { LucideIcon } from 'lucide-react';
import {
    LayoutGrid, Activity, FileText, Star, MessageSquare, Trophy, Settings,
    CalendarCheck, Wallet, BarChart3, ScrollText, Users,
    UserPlus, Search, Server, ShieldCheck, Image as ImageIcon,
} from 'lucide-react';
import type { UserRole } from '@/services/api';

/**
 * Per-role profile configuration. ProfileLayout renders the SAME visual design
 * for every role; only the data here changes what each role sees:
 *   - `nav`            → left sidebar menu items
 *   - `activity`       → "Your Activity" card action rows (keys resolved to
 *                        real handlers/counts inside UserProfilePage)
 *   - `stats`          → the 4 stat cards under the header banner
 *   - `accountFields`  → rows in the "Account Details" card
 *   - `quickLinks`     → right-column shortcut card (admin / super_admin)
 */

export type NavKey =
    | 'overview' | 'activity' | 'applications' | 'suggestions' | 'feedback'
    | 'badges' | 'settings' | 'bookings' | 'reviews' | 'earnings' | 'analytics'
    | 'admins' | 'audit';

export type NavItem = { key: NavKey; label: string; icon: LucideIcon };

/** Stat-card slots; UserProfilePage maps each key to a real/placeholder value. */
export type StatKey =
    | 'member_since' | 'last_updated' | 'profile_views' | 'account_status'
    | 'total_bookings' | 'total_earnings' | 'completed_bookings' | 'verification_status';

export type StatItem = { key: StatKey; label: string; icon: LucideIcon };

/** Activity rows; UserProfilePage maps each key to count + CTA + navigation. */
export type ActivityKey =
    | 'applications' | 'suggestions' | 'feedback'          // admin / user
    | 'my_bookings' | 'my_reviews' | 'browse_creators'      // user
    | 'manage_bookings' | 'view_earnings' | 'analytics'     // creator
    | 'creator_reviews' | 'creator_portfolio'               // creator
    | 'system_overview' | 'manage_admins';                  // super_admin

export type ActivityItem = { key: ActivityKey; icon: LucideIcon; title: string; cta: string };

/** Account-detail rows shown in the "Account Details" card. */
export type AccountFieldKey = 'id' | 'account_type' | 'category' | 'member_since';
export type AccountField = { key: AccountFieldKey; label: string };

/** Right-column shortcut links (admin / super_admin). */
export type QuickLink = { label: string; icon: LucideIcon; to: string };

export type ProfileRoleConfig = {
    /** Label shown on the role badge / account-type. */
    accountTypeLabel: string;
    idLabel: string;
    nav: NavItem[];
    stats: StatItem[];
    activity: ActivityItem[];
    accountFields: AccountField[];
    quickLinks?: QuickLink[];
};

const SETTINGS: NavItem = { key: 'settings', label: 'Settings', icon: Settings };

// ─── USER (fan) ────────────────────────────────────────────────────────────
const userConfig: ProfileRoleConfig = {
    accountTypeLabel: 'Fan',
    idLabel: 'User ID',
    nav: [
        { key: 'overview', label: 'Overview', icon: LayoutGrid },
        { key: 'activity', label: 'Activity', icon: Activity },
        { key: 'bookings', label: 'My Bookings', icon: CalendarCheck },
        { key: 'reviews', label: 'Reviews', icon: Star },
        SETTINGS,
    ],
    stats: [
        { key: 'member_since', label: 'Member Since', icon: CalendarCheck },
        { key: 'total_bookings', label: 'Total Bookings', icon: CalendarCheck },
        { key: 'profile_views', label: 'Profile Views', icon: BarChart3 },
        { key: 'account_status', label: 'Account Status', icon: Activity },
    ],
    activity: [
        { key: 'my_bookings', icon: CalendarCheck, title: 'My Bookings', cta: 'View Bookings' },
        { key: 'my_reviews', icon: Star, title: 'My Reviews', cta: 'View Reviews' },
        { key: 'browse_creators', icon: Search, title: 'Browse Creators', cta: 'Explore' },
    ],
    accountFields: [
        { key: 'id', label: 'User ID' },
        { key: 'account_type', label: 'Account Type' },
        { key: 'member_since', label: 'Member Since' },
    ],
};

// ─── CREATOR ───────────────────────────────────────────────────────────────
const creatorConfig: ProfileRoleConfig = {
    accountTypeLabel: 'Creator',
    idLabel: 'Creator ID',
    nav: [
        { key: 'overview', label: 'Overview', icon: LayoutGrid },
        { key: 'activity', label: 'Activity', icon: Activity },
        { key: 'bookings', label: 'Bookings', icon: CalendarCheck },
        { key: 'earnings', label: 'Earnings', icon: Wallet },
        { key: 'analytics', label: 'Analytics', icon: BarChart3 },
        SETTINGS,
    ],
    stats: [
        { key: 'member_since', label: 'Member Since', icon: CalendarCheck },
        { key: 'total_earnings', label: 'Total Earnings', icon: Wallet },
        { key: 'completed_bookings', label: 'Completed Bookings', icon: CalendarCheck },
        { key: 'verification_status', label: 'Verification Status', icon: ShieldCheck },
    ],
    activity: [
        { key: 'manage_bookings', icon: CalendarCheck, title: 'Orders', cta: 'Manage' },
        { key: 'view_earnings', icon: Wallet, title: 'Earnings', cta: 'View' },
        { key: 'creator_reviews', icon: Star, title: 'Reviews', cta: 'Open' },
        { key: 'creator_portfolio', icon: ImageIcon, title: 'Portfolio', cta: 'Open' },
    ],
    accountFields: [
        { key: 'id', label: 'Creator ID' },
        { key: 'account_type', label: 'Account Type' },
        { key: 'category', label: 'Category' },
        { key: 'member_since', label: 'Member Since' },
    ],
};

// ─── ADMIN ─────────────────────────────────────────────────────────────────
const adminNav: NavItem[] = [
    { key: 'overview', label: 'Overview', icon: LayoutGrid },
    { key: 'activity', label: 'Activity', icon: Activity },
    { key: 'applications', label: 'Applications', icon: FileText },
    { key: 'suggestions', label: 'Suggestions', icon: Star },
    { key: 'feedback', label: 'Feedback', icon: MessageSquare },
    { key: 'badges', label: 'Badges', icon: Trophy },
    SETTINGS,
];

const adminStats: StatItem[] = [
    { key: 'member_since', label: 'Member Since', icon: CalendarCheck },
    { key: 'last_updated', label: 'Last Updated', icon: CalendarCheck },
    { key: 'profile_views', label: 'Profile Views', icon: BarChart3 },
    { key: 'account_status', label: 'Account Status', icon: Activity },
];

const adminActivity: ActivityItem[] = [
    { key: 'applications', icon: UserPlus, title: 'Creator Applications', cta: 'Browse Categories' },
    { key: 'suggestions', icon: Star, title: 'Star Suggestions', cta: 'Suggest a Star' },
    { key: 'feedback', icon: MessageSquare, title: 'Feedback Submissions', cta: 'Give Feedback' },
];

const adminConfig: ProfileRoleConfig = {
    accountTypeLabel: 'Admin',
    idLabel: 'User ID',
    nav: adminNav,
    stats: adminStats,
    activity: adminActivity,
    accountFields: [
        { key: 'id', label: 'User ID' },
        { key: 'account_type', label: 'Account Type' },
        { key: 'member_since', label: 'Member Since' },
    ],
    quickLinks: [
        { label: 'Admin Panel', icon: ShieldCheck, to: '/admin' },
        { label: 'User Management', icon: Users, to: '/admin' },
    ],
};

// ─── SUPER ADMIN (admin + extra nav/activity/links) ──────────────────────────
const superAdminConfig: ProfileRoleConfig = {
    ...adminConfig,
    accountTypeLabel: 'Super Admin',
    nav: [
        ...adminNav.slice(0, -1), // everything except Settings
        { key: 'admins', label: 'Admin Management', icon: Users },
        { key: 'audit', label: 'Audit Logs', icon: ScrollText },
        SETTINGS,
    ],
    activity: [
        { key: 'system_overview', icon: Server, title: 'System Overview', cta: 'Open' },
        { key: 'manage_admins', icon: Users, title: 'Manage Admins', cta: 'Manage' },
        ...adminActivity,
    ],
    quickLinks: [
        { label: 'Super Admin Panel', icon: ShieldCheck, to: '/superadmin' },
        { label: 'Admin Management', icon: Users, to: '/superadmin' },
        { label: 'System Overview', icon: Server, to: '/superadmin' },
    ],
};

export const PROFILE_CONFIG: Record<UserRole, ProfileRoleConfig> = {
    user: userConfig,
    admin: adminConfig,
    super_admin: superAdminConfig,
};

/**
 * Resolve the config for a user. Creators are role === 'user' with
 * account_type === 'creator', so they need an explicit branch.
 */
export function getProfileConfig(role: UserRole, isCreator: boolean): ProfileRoleConfig {
    if (role === 'user' && isCreator) return creatorConfig;
    return PROFILE_CONFIG[role] ?? userConfig;
}
