import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    getMyProfile, updateProfile, getMyActivity,
    getDashboardStats, getFanStats,
    type Profile, type UserActivity,
    type CreatorDashboardStats, type FanDashboardStats,
} from '@/services/api';
import { useAuth } from '@/providers/AuthProvider';
import { useRole } from '@/hooks/useRole';
import { useModals } from '@/providers/ModalProvider';
import { updateMyProfileCache } from '@/hooks/useMyProfile';
import ProfileLayout, {
    BADGE_PRESETS, formatDate,
    type ResolvedStat, type ResolvedActivity, type ResolvedAccountField, type BadgeItem,
} from '@/features/profile/ProfileLayout';
import { getProfileConfig, type NavKey, type StatKey, type ActivityKey } from '@/features/profile/profileConfig';

const ROLE_LABELS: Record<string, string> = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    user: 'User',
};

export default function UserProfilePage() {
    const { user } = useAuth();
    const { role, isCreator } = useRole();
    const navigate = useNavigate();
    const { openFeedback } = useModals();

    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);

    const [activity, setActivity] = useState<UserActivity | null>(null);
    const [creatorStats, setCreatorStats] = useState<CreatorDashboardStats | null>(null);
    const [fanStats, setFanStats] = useState<FanDashboardStats | null>(null);
    const [dataLoading, setDataLoading] = useState(true);

    const [form, setForm] = useState({ first_name: '', last_name: '', phone: '', bio: '' });

    const config = getProfileConfig(role, isCreator);
    const roleLabel = ROLE_LABELS[role] || 'User';

    const loadProfile = useCallback(() => {
        setLoading(true);
        setError(null);
        let cancelled = false;
        getMyProfile()
            .then((p) => {
                if (cancelled) return;
                setProfile(p);
                setForm({ first_name: p.first_name, last_name: p.last_name, phone: p.phone || '', bio: p.bio || '' });
            })
            .catch((err: Error) => { if (!cancelled) setError(err.message); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    useEffect(() => { if (user) loadProfile(); }, [user, loadProfile]);

    // Role-specific data. All roles get activity; creators/fans also get stats.
    // Each call is independent and failure-tolerant (stats are non-critical).
    useEffect(() => {
        let cancelled = false;
        setDataLoading(true);

        const jobs: Promise<void>[] = [
            getMyActivity().then((a) => { if (!cancelled) setActivity(a); }).catch(() => {}),
        ];
        if (isCreator) {
            jobs.push(getDashboardStats().then((s) => { if (!cancelled) setCreatorStats(s); }).catch(() => {}));
        } else if (role === 'user') {
            jobs.push(getFanStats().then((s) => { if (!cancelled) setFanStats(s); }).catch(() => {}));
        }

        Promise.allSettled(jobs).finally(() => { if (!cancelled) setDataLoading(false); });
        return () => { cancelled = true; };
    }, [role, isCreator]);

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        try {
            const updated = await updateProfile({
                first_name: form.first_name || undefined,
                last_name: form.last_name || undefined,
                phone: form.phone || undefined,
                bio: form.bio || undefined,
            });
            setProfile(updated);
            updateMyProfileCache(updated); // navbar/sidebar stay in sync
            setIsEditing(false);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        if (profile) setForm({ first_name: profile.first_name, last_name: profile.last_name, phone: profile.phone || '', bio: profile.bio || '' });
        setIsEditing(false);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (error && !profile) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8">
                <p className="text-red-500">{error}</p>
                <button onClick={loadProfile} className="text-purple-600 dark:text-purple-400 hover:underline text-sm">Try Again</button>
            </div>
        );
    }
    if (!profile) return null;

    // ── Real counts (with zero fallbacks) ──────────────────────────────────────
    const applicationsCount = activity?.applications.length ?? 0;
    const suggestionsCount = activity?.suggestions.length ?? 0;
    const feedbackCount = activity?.feedback.length ?? 0;
    const totalActivity = applicationsCount + suggestionsCount + feedbackCount;

    // Profile views: deterministic placeholder from the id (stable per user) until
    // a real metric exists.
    const profileViews = (Array.from(profile.id).reduce((acc, c) => acc + c.charCodeAt(0), 0) % 400) + 50;
    const fmtMoney = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

    // ── Resolve stat cards from config keys → real/placeholder values ──────────
    const statValue = (key: StatKey): React.ReactNode => {
        switch (key) {
            case 'member_since':        return formatDate(profile.created_at);
            case 'last_updated':        return formatDate(profile.updated_at);
            case 'profile_views':       return String(profileViews);
            case 'account_status':      return <span className="text-emerald-500 dark:text-emerald-400">Active</span>;
            case 'total_bookings':      return String(fanStats?.total_bookings ?? 0);
            case 'total_earnings':      return fmtMoney(creatorStats?.total_earnings ?? 0);
            case 'completed_bookings':  return String(creatorStats?.delivered_count ?? 0);
            case 'verification_status': return profile.account_type === 'creator'
                ? <span className="text-emerald-500 dark:text-emerald-400">Verified</span>
                : <span className="text-amber-500 dark:text-amber-400">Pending</span>;
            default: return '—';
        }
    };
    const stats: ResolvedStat[] = config.stats.map((s) => ({ label: s.label, icon: s.icon, value: statValue(s.key) }));

    // ── Resolve activity rows from config keys → count + subtitle + handler ────
    const activityMeta = (key: ActivityKey): { count: number; subtitle: string; onClick: () => void } => {
        switch (key) {
            case 'applications':
                return { count: applicationsCount, subtitle: applicationsCount > 0 ? `${applicationsCount} submitted` : 'No creator applications yet.', onClick: () => navigate('/creators') };
            case 'suggestions':
                return { count: suggestionsCount, subtitle: suggestionsCount > 0 ? `${suggestionsCount} submitted` : 'No star suggestions yet.', onClick: () => navigate('/suggeststars') };
            case 'feedback':
                return { count: feedbackCount, subtitle: feedbackCount > 0 ? `${feedbackCount} submitted` : 'No feedback yet.', onClick: () => openFeedback() };
            case 'my_bookings':
                return { count: fanStats?.total_bookings ?? 0, subtitle: `${fanStats?.total_bookings ?? 0} total`, onClick: () => navigate('/my-orders') };
            case 'my_reviews':
                return { count: fanStats?.reviews_left ?? 0, subtitle: `${fanStats?.reviews_left ?? 0} left`, onClick: () => navigate('/my-orders') };
            case 'browse_creators':
                return { count: 0, subtitle: 'Find your favourite creators.', onClick: () => navigate('/explore') };
            case 'manage_bookings':
                return { count: (creatorStats?.pending_count ?? 0) + (creatorStats?.accepted_count ?? 0), subtitle: `${creatorStats?.pending_count ?? 0} pending`, onClick: () => navigate('/creator-dashboard?tab=orders') };
            case 'view_earnings':
                return { count: 0, subtitle: fmtMoney(creatorStats?.total_earnings ?? 0), onClick: () => navigate('/creator-dashboard?tab=earnings') };
            case 'analytics':
                return { count: 0, subtitle: 'Views, ratings, and trends.', onClick: () => navigate('/creator-dashboard?tab=analytics') };
            case 'creator_reviews':
                return { count: 0, subtitle: 'Ratings from delivered orders.', onClick: () => navigate('/creator-dashboard?tab=reviews') };
            case 'creator_portfolio':
                return { count: 0, subtitle: 'Showcase your best work.', onClick: () => navigate('/creator-dashboard?tab=portfolio') };
            case 'system_overview':
                return { count: 0, subtitle: 'Platform-wide metrics.', onClick: () => navigate('/superadmin') };
            case 'manage_admins':
                return { count: 0, subtitle: 'Add or remove admins.', onClick: () => navigate('/superadmin') };
            default:
                return { count: 0, subtitle: '', onClick: () => {} };
        }
    };
    const resolvedActivity: ResolvedActivity[] = config.activity.map((a) => {
        const meta = activityMeta(a.key);
        return { key: a.key, icon: a.icon, title: a.title, cta: a.cta, ...meta };
    });

    // ── Resolve account-detail rows ────────────────────────────────────────────
    const accountFields: ResolvedAccountField[] = config.accountFields.map((f) => {
        switch (f.key) {
            case 'id':           return { key: f.key, label: config.idLabel, value: profile.id, copyable: true };
            case 'account_type': return { key: f.key, label: f.label, value: config.accountTypeLabel };
            case 'category':     return { key: f.key, label: f.label, value: profile.account_type === 'creator' ? 'Creator' : '—' };
            case 'member_since': return { key: f.key, label: f.label, value: formatDate(profile.created_at) };
            default:             return { key: f.key, label: f.label, value: '—' };
        }
    });

    // ── Badges (real, derived) ─────────────────────────────────────────────────
    const badges: BadgeItem[] = [
        BADGE_PRESETS.earlyUser(new Date(profile.created_at).toLocaleDateString()),
        ...(totalActivity > 0 ? [BADGE_PRESETS.active(new Date(profile.updated_at).toLocaleDateString())] : []),
        ...(profile.account_type === 'creator' ? [BADGE_PRESETS.creator()] : []),
    ];

    // ── Sidebar nav → route where a full page exists, else no-op (stays on tab) ─
    const onNav = (key: NavKey) => {
        const routes: Partial<Record<NavKey, string>> = {
            bookings: isCreator ? '/creator-dashboard?tab=orders' : '/my-orders',
            reviews: isCreator ? '/creator-dashboard?tab=reviews' : '/my-orders',
            earnings: '/creator-dashboard?tab=earnings',
            analytics: '/creator-dashboard?tab=analytics',
            settings: '/settings',
            applications: role === 'admin' || role === 'super_admin' ? '/admin' : '/creators',
            admins: '/superadmin',
            audit: '/superadmin',
        };
        const to = routes[key];
        if (to) navigate(to);
    };

    // ── New-design extras ──────────────────────────────────────────────────────
    // Profile completion from the 3 optional fields (bio, phone, avatar) —
    // shown as a progress bar for creators only.
    const optionalFilled = [profile.bio, profile.phone, profile.avatar_url].filter(Boolean).length;
    const completion = isCreator ? Math.round((optionalFilled / 3) * 100) : null;

    // Creator quick stats (right column).
    const quickStats = isCreator
        ? [
            { label: 'Total Earnings', value: fmtMoney(creatorStats?.total_earnings ?? 0) },
            { label: 'Pending Orders', value: String(creatorStats?.pending_count ?? 0) },
        ]
        : null;

    // Admin / super_admin shortcuts (right column), from config.
    const quickLinks = config.quickLinks
        ? config.quickLinks.map((l) => ({ label: l.label, icon: l.icon, onClick: () => navigate(l.to) }))
        : null;

    return (
        <>
            {error && profile && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 rounded-xl text-sm shadow-lg">
                    {error}
                </div>
            )}
            <ProfileLayout
                profile={profile}
                email={user?.email || profile.email}
                config={config}
                roleLabel={roleLabel}
                accountTypeLabel={profile.account_type === 'creator' ? 'Creator' : 'Fan'}
                stats={stats}
                activity={resolvedActivity}
                accountFields={accountFields}
                badges={badges}
                activityLoading={dataLoading}
                completion={completion}
                quickStats={quickStats}
                quickLinks={quickLinks}
                isEditing={isEditing}
                form={form}
                saving={saving}
                onEdit={() => setIsEditing(true)}
                onCancel={handleCancel}
                onSave={handleSave}
                onFormChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
                onNav={onNav}
                onContactSupport={() => openFeedback()}
            />
        </>
    );
}
