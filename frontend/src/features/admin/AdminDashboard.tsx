import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    getAdminStats, getAuditLogs, adminListProfiles, fetchStars, adminListFeedback,
    adminUpdateProfile, adminDeleteUser, updateAuditLog, deleteAuditLog,
    adminUpdateStar, adminDeleteStar,
    adminListBookings, adminGetBooking, adminUpdateBookingStatus,
} from "@/services/api";
import type {
    AdminStats, AuditLog, Profile, Star, FeedbackItem,
    AdminBookingRow, AdminBookingDetail, AdminBookingStatus,
} from "@/services/api";
import { useAuth } from "@/providers/AuthProvider";
import { useModals } from "@/providers/ModalProvider";
import ThemeSwitcher from "@/components/ui/ThemeSwitcher";
import {
    LayoutDashboard, Users, MessageSquare,
    ClipboardList, BadgeCheck, BarChart3, Settings, User, LogOut, Search, ArrowRight,
    Users2, UserCheck, TrendingUp, TrendingDown, Video, X, Pencil, Trash2, ScrollText, Sparkles,
    CalendarCheck, Eye, Loader2, Menu,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import EnrichProfileModal from "@/components/admin/EnrichProfileModal";
import CreateCreatorForm from "@/components/admin/CreateCreatorForm";
import PendingApplicationsPanel from "@/components/admin/PendingApplicationsPanel";
import CreatorVerificationPanel from "@/components/admin/CreatorVerificationPanel";

type SectionName = 'Dashboard' | 'Users' | 'Creators' | 'Bookings' | 'Feedback' | 'Creator Applications' | 'Verification Requests' | 'Audit Logs' | 'Analytics' | 'Platform Settings';

// ─── Sidebar nav config ──────────────────────────────────────────────────────
const NAV_ITEMS: { label: SectionName; icon: LucideIcon; path?: string }[] = [
    { label: 'Dashboard',             icon: LayoutDashboard, path: '/admin' },
    { label: 'Users',                 icon: Users },
    { label: 'Creators',              icon: UserCheck },
    { label: 'Bookings',              icon: CalendarCheck },
    { label: 'Feedback',              icon: MessageSquare },
    { label: 'Creator Applications',  icon: ClipboardList },
    { label: 'Verification Requests', icon: BadgeCheck },
    { label: 'Audit Logs',            icon: ScrollText },
    { label: 'Analytics',             icon: BarChart3 },
    { label: 'Platform Settings',     icon: Settings },
];

// ─── Quick action config ─────────────────────────────────────────────────────
type QuickAction =
    | { kind: 'create-creator' }
    | { kind: 'view'; view: SectionName }
    | { kind: 'soon' };

const QUICK_ACTIONS: { title: string; desc: string; icon: LucideIcon; color: string; action: QuickAction }[] = [
    { title: 'Create Creator',        desc: 'Onboard a creator with a username & password.', icon: UserCheck,     color: 'from-emerald-500 to-green-600',  action: { kind: 'create-creator' } },
    { title: 'Creator Applications',  desc: 'Review people applying to become creators.',     icon: ClipboardList, color: 'from-pink-500 to-rose-600',      action: { kind: 'view', view: 'Creator Applications' } },
    { title: 'Verification Requests', desc: 'Review creators submitting proof for the badge.', icon: BadgeCheck,   color: 'from-cyan-500 to-sky-600',       action: { kind: 'view', view: 'Verification Requests' } },
    { title: 'Manage Users',          desc: 'View, edit and manage all users.',              icon: Users,         color: 'from-purple-500 to-purple-700',  action: { kind: 'view', view: 'Users' } },
    { title: 'Review Feedback',       desc: 'Review feedback and suggestions.',               icon: MessageSquare, color: 'from-orange-500 to-amber-600',   action: { kind: 'view', view: 'Feedback' } },
    { title: 'View Analytics',        desc: 'View platform analytics and reports.',          icon: BarChart3,     color: 'from-violet-500 to-indigo-600',  action: { kind: 'view', view: 'Analytics' } },
];

const SYSTEM_OVERVIEW = [
    { label: 'Users Growth',      icon: Users2,        up: true  },
    { label: 'Creator Growth',    icon: UserCheck,      up: true  },
    { label: 'Feedback Received', icon: MessageSquare,  up: false },
];

function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}

const ACTION_LABELS: Record<AuditLog['action'], string> = {
    role_change: 'Role changed',
    user_delete: 'User deleted',
    admin_create_user: 'New user created',
    profile_update_by_admin: 'Profile updated',
    application_status_change: 'Application reviewed',
    admin_create_creator: 'Creator created',
    admin_reset_password: 'Password reset',
    audit_log_edited: 'Audit log edited',
    audit_log_deleted: 'Audit log deleted',
};

// Actions that can be set when editing an audit entry.
const EDITABLE_ACTIONS: AuditLog['action'][] = [
    'role_change', 'user_delete', 'admin_create_user', 'profile_update_by_admin',
    'application_status_change', 'admin_create_creator', 'admin_reset_password',
    'audit_log_edited', 'audit_log_deleted',
];

const FEEDBACK_TYPE_COLOR: Record<FeedbackItem['type'], string> = {
    'Bug Report':       'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
    'Feature Request':  'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
    'General Feedback': 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300',
    'Other':            'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300',
};

// ─── Booking status config ───────────────────────────────────────────────────
// Valid statuses only — the bookings DB CHECK has no 'rejected'; declines are
// modelled as 'cancelled'.
const BOOKING_STATUSES: AdminBookingStatus[] = ['pending', 'accepted', 'in_progress', 'delivered', 'cancelled'];

const BOOKING_STATUS_LABEL: Record<AdminBookingStatus, string> = {
    pending: 'Pending',
    accepted: 'Accepted',
    in_progress: 'In Progress',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
};

const BOOKING_STATUS_COLOR: Record<AdminBookingStatus, string> = {
    pending:     'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
    accepted:    'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300',
    in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
    delivered:   'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300',
    cancelled:   'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
};

const fmtINR = (v: number | string | null) => `₹${Number(v ?? 0).toLocaleString('en-IN')}`;

export default function AdminDashboard() {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { openLogin } = useModals();
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [active, setActive] = useState<SectionName>('Dashboard');
    const [showMobileNav, setShowMobileNav] = useState(false);
    const [showCreateCreator, setShowCreateCreator] = useState(false);

    // Users section state
    const [users, setUsers] = useState<Profile[]>([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [usersError, setUsersError] = useState<string | null>(null);

    // Edit user modal
    const [editTarget, setEditTarget] = useState<Profile | null>(null);
    const [editForm, setEditForm] = useState({ first_name: '', last_name: '', phone: '', bio: '' });
    const [editSaving, setEditSaving] = useState(false);
    const [editError, setEditError] = useState<string | null>(null);

    // Delete confirmation
    const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    // Creators section state
    const [creators, setCreators] = useState<Star[]>([]);
    const [creatorsLoading, setCreatorsLoading] = useState(false);
    const [creatorsError, setCreatorsError] = useState<string | null>(null);

    // Creator (Star) edit / delete
    const [starEditTarget, setStarEditTarget] = useState<Star | null>(null);
    const [starEditForm, setStarEditForm] = useState({ name: '', category: 'Actor', image_url: '', price: 0, rating: 0, is_featured: false, bio: '' });
    const [starEditSaving, setStarEditSaving] = useState(false);
    const [starEditError, setStarEditError] = useState<string | null>(null);
    const [starDeleteTarget, setStarDeleteTarget] = useState<Star | null>(null);
    const [enrichTarget, setEnrichTarget] = useState<Star | null>(null);
    const [starDeleting, setStarDeleting] = useState(false);

    // Bookings section state
    const [bookings, setBookings] = useState<AdminBookingRow[]>([]);
    const [bookingsLoading, setBookingsLoading] = useState(false);
    const [bookingsError, setBookingsError] = useState<string | null>(null);
    const [bookingStatusFilter, setBookingStatusFilter] = useState<AdminBookingStatus | ''>('');
    const [bookingSearch, setBookingSearch] = useState('');
    const [bookingPage, setBookingPage] = useState(1);
    const [bookingTotalPages, setBookingTotalPages] = useState(1);
    const [bookingTotal, setBookingTotal] = useState(0);

    // Booking detail modal
    const [bookingDetail, setBookingDetail] = useState<AdminBookingDetail | null>(null);
    const [bookingDetailLoading, setBookingDetailLoading] = useState(false);
    const [bookingNewStatus, setBookingNewStatus] = useState<AdminBookingStatus>('pending');
    const [bookingStatusSaving, setBookingStatusSaving] = useState(false);
    const [bookingStatusError, setBookingStatusError] = useState<string | null>(null);

    // Feedback section state
    const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
    const [feedbackLoading, setFeedbackLoading] = useState(false);
    const [feedbackError, setFeedbackError] = useState<string | null>(null);
    const [feedbackTypeFilter, setFeedbackTypeFilter] = useState<FeedbackItem['type'] | ''>('');

    // Audit Logs section state
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [auditLoading, setAuditLoading] = useState(false);
    const [auditError, setAuditError] = useState<string | null>(null);
    const [auditPage, setAuditPage] = useState(1);
    const [auditTotalPages, setAuditTotalPages] = useState(1);
    const [auditEditTarget, setAuditEditTarget] = useState<AuditLog | null>(null);
    const [auditEditForm, setAuditEditForm] = useState({ action: '' as AuditLog['action'], target_email: '', metadata: '' });
    const [auditEditSaving, setAuditEditSaving] = useState(false);
    const [auditEditError, setAuditEditError] = useState<string | null>(null);
    const [auditDeleteTarget, setAuditDeleteTarget] = useState<AuditLog | null>(null);
    const [auditDeleting, setAuditDeleting] = useState(false);

    const runQuickAction = (action: QuickAction) => {
        if (action.kind === 'create-creator') { setShowCreateCreator(true); return; }
        if (action.kind === 'view') { setActive(action.view); return; }
    };

    const load = useCallback(() => {
        setLoading(true);
        setError(null);
        let cancelled = false;

        Promise.all([
            getAdminStats(),
            getAuditLogs({ limit: 5 }).catch(() => ({ data: [] as AuditLog[] })),
        ])
            .then(([s, l]) => {
                if (cancelled) return;
                setStats(s);
                setLogs((l as { data: AuditLog[] }).data ?? []);
            })
            .catch((err: Error) => { if (!cancelled) setError(err.message); })
            .finally(() => { if (!cancelled) setLoading(false); });

        return () => { cancelled = true; };
    }, []);

    const loadUsers = useCallback(async () => {
        setUsersLoading(true);
        setUsersError(null);
        try {
            const res = await adminListProfiles({ limit: 100 });
            setUsers(res.data);
        } catch (err) {
            setUsersError(err instanceof Error ? err.message : 'Failed to load users');
        } finally {
            setUsersLoading(false);
        }
    }, []);

    const openEditUser = (u: Profile) => {
        setEditTarget(u);
        setEditForm({ first_name: u.first_name, last_name: u.last_name, phone: u.phone ?? '', bio: u.bio ?? '' });
        setEditError(null);
    };

    const handleEditSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editTarget) return;
        setEditSaving(true);
        setEditError(null);
        try {
            const updated = await adminUpdateProfile(editTarget.id, {
                first_name: editForm.first_name,
                last_name: editForm.last_name,
                phone: editForm.phone || undefined,
                bio: editForm.bio || undefined,
            });
            setUsers((prev) => prev.map((u) => u.id === updated.id ? updated : u));
            setEditTarget(null);
        } catch (err) {
            setEditError(err instanceof Error ? err.message : 'Failed to save changes');
        } finally {
            setEditSaving(false);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        setDeleteLoading(true);
        try {
            await adminDeleteUser(deleteTarget.id);
            setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
            setDeleteTarget(null);
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to delete user');
        } finally {
            setDeleteLoading(false);
        }
    };

    const loadCreators = useCallback(async () => {
        setCreatorsLoading(true);
        setCreatorsError(null);
        try {
            const data = await fetchStars({ limit: 100 });
            setCreators(data);
        } catch (err) {
            setCreatorsError(err instanceof Error ? err.message : 'Failed to load creators');
        } finally {
            setCreatorsLoading(false);
        }
    }, []);

    const openStarEdit = (s: Star) => {
        setStarEditTarget(s);
        setStarEditForm({
            name: s.name,
            category: s.category,
            image_url: s.image_url,
            price: Number(s.price),
            rating: Number(s.rating),
            is_featured: s.is_featured,
            bio: s.bio ?? '',
        });
        setStarEditError(null);
    };

    const handleStarEditSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!starEditTarget) return;
        setStarEditSaving(true);
        setStarEditError(null);
        try {
            const updated = await adminUpdateStar(starEditTarget.id, {
                name: starEditForm.name,
                category: starEditForm.category,
                image_url: starEditForm.image_url,
                price: starEditForm.price,
                rating: starEditForm.rating,
                is_featured: starEditForm.is_featured,
                bio: starEditForm.bio,
            });
            setCreators((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
            setStarEditTarget(null);
        } catch (err) {
            setStarEditError(err instanceof Error ? err.message : 'Failed to save changes');
        } finally {
            setStarEditSaving(false);
        }
    };

    const handleStarDeleteConfirm = async () => {
        if (!starDeleteTarget) return;
        setStarDeleting(true);
        try {
            await adminDeleteStar(starDeleteTarget.id);
            setCreators((prev) => prev.filter((c) => c.id !== starDeleteTarget.id));
            setStarDeleteTarget(null);
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to delete creator');
        } finally {
            setStarDeleting(false);
        }
    };

    const loadFeedback = useCallback(async (typeFilter?: FeedbackItem['type'] | '') => {
        setFeedbackLoading(true);
        setFeedbackError(null);
        try {
            const res = await adminListFeedback({
                limit: 50,
                ...(typeFilter ? { type: typeFilter as FeedbackItem['type'] } : {}),
            });
            setFeedbackItems(res.data);
        } catch (err) {
            setFeedbackError(err instanceof Error ? err.message : 'Failed to load feedback');
        } finally {
            setFeedbackLoading(false);
        }
    }, []);

    const loadAuditLogs = useCallback(async (page = 1) => {
        setAuditLoading(true);
        setAuditError(null);
        try {
            const res = await getAuditLogs({ page, limit: 50 });
            setAuditLogs(res.data);
            setAuditTotalPages(res.pagination.totalPages);
            setAuditPage(page);
        } catch (err) {
            setAuditError(err instanceof Error ? err.message : 'Failed to load audit logs');
        } finally {
            setAuditLoading(false);
        }
    }, []);

    const openAuditEdit = (log: AuditLog) => {
        setAuditEditTarget(log);
        setAuditEditForm({
            action: log.action,
            target_email: log.target_email ?? '',
            metadata: JSON.stringify(log.metadata ?? {}, null, 2),
        });
        setAuditEditError(null);
    };

    const handleAuditEditSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!auditEditTarget) return;
        let parsedMeta: Record<string, unknown>;
        try {
            parsedMeta = auditEditForm.metadata.trim() ? JSON.parse(auditEditForm.metadata) : {};
        } catch {
            setAuditEditError('Details must be valid JSON.');
            return;
        }
        setAuditEditSaving(true);
        setAuditEditError(null);
        try {
            await updateAuditLog(auditEditTarget.id, {
                action: auditEditForm.action,
                target_email: auditEditForm.target_email || null,
                metadata: parsedMeta,
            });
            setAuditEditTarget(null);
            await loadAuditLogs(auditPage);
        } catch (err) {
            setAuditEditError(err instanceof Error ? err.message : 'Failed to save changes');
        } finally {
            setAuditEditSaving(false);
        }
    };

    const handleAuditDeleteConfirm = async () => {
        if (!auditDeleteTarget) return;
        setAuditDeleting(true);
        try {
            await deleteAuditLog(auditDeleteTarget.id);
            setAuditDeleteTarget(null);
            await loadAuditLogs(auditPage);
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to delete audit log');
        } finally {
            setAuditDeleting(false);
        }
    };

    // ── Bookings section ────────────────────────────────────────────────────
    const loadBookings = useCallback(async (page = 1) => {
        setBookingsLoading(true);
        setBookingsError(null);
        try {
            const res = await adminListBookings({
                page,
                limit: 20,
                ...(bookingStatusFilter ? { status: bookingStatusFilter } : {}),
                ...(bookingSearch.trim() ? { search: bookingSearch.trim() } : {}),
            });
            setBookings(res.data);
            setBookingPage(res.pagination.page);
            setBookingTotalPages(res.pagination.total_pages);
            setBookingTotal(res.pagination.total);
        } catch (err) {
            setBookingsError(err instanceof Error ? err.message : 'Failed to load bookings');
        } finally {
            setBookingsLoading(false);
        }
    }, [bookingStatusFilter, bookingSearch]);

    const openBookingDetail = async (id: string) => {
        setBookingDetailLoading(true);
        setBookingStatusError(null);
        try {
            const detail = await adminGetBooking(id);
            setBookingDetail(detail);
            setBookingNewStatus(detail.status);
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to load booking');
        } finally {
            setBookingDetailLoading(false);
        }
    };

    const handleBookingStatusSave = async () => {
        if (!bookingDetail) return;
        setBookingStatusSaving(true);
        setBookingStatusError(null);
        try {
            await adminUpdateBookingStatus(bookingDetail.id, bookingNewStatus);
            setBookingDetail((d) => (d ? { ...d, status: bookingNewStatus } : d));
            setBookings((prev) => prev.map((b) => (b.id === bookingDetail.id ? { ...b, status: bookingNewStatus } : b)));
        } catch (err) {
            setBookingStatusError(err instanceof Error ? err.message : 'Failed to update status');
        } finally {
            setBookingStatusSaving(false);
        }
    };

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (active === 'Users' && users.length === 0)         loadUsers();
        if (active === 'Creators' && creators.length === 0)   loadCreators();
        if (active === 'Feedback' && feedbackItems.length === 0) loadFeedback(feedbackTypeFilter);
        if (active === 'Audit Logs')                          loadAuditLogs(1);
        if (active === 'Bookings' && bookings.length === 0)   loadBookings(1);
    }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

    // Bookings: refetch (page 1) when the filter/search changes, debounced for typing.
    useEffect(() => {
        if (active !== 'Bookings') return;
        const t = setTimeout(() => loadBookings(1), 350);
        return () => clearTimeout(t);
    }, [bookingStatusFilter, bookingSearch]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleFeedbackFilter = (t: FeedbackItem['type'] | '') => {
        setFeedbackTypeFilter(t);
        loadFeedback(t);
    };

    const handleLogout = async () => { await logout(); navigate('/'); openLogin(); };

    const statCards = [
        { label: 'Total Users',           value: stats?.totalUsers,           delta: 'Platform total',       up: true,  icon: Users,         color: 'from-purple-500 to-purple-700' },
        { label: 'Total Creators',        value: stats?.totalCreators,        delta: 'Platform total',       up: true,  icon: UserCheck,      color: 'from-blue-500 to-blue-700' },
        { label: 'Feedback Items',        value: stats?.pendingFeedback,      delta: 'Awaiting review',      up: false, icon: MessageSquare, color: 'from-emerald-500 to-green-600' },
        { label: 'Creator Applications',  value: stats?.pendingApplications,  delta: 'Pending applications', up: false, icon: ClipboardList, color: 'from-pink-500 to-rose-600' },
        { label: 'Verification Requests', value: stats?.pendingVerifications, delta: 'Pending badge review', up: false, icon: BadgeCheck,    color: 'from-cyan-500 to-sky-600' },
    ];

    const userInitial = user?.email?.charAt(0).toUpperCase() || 'A';

    return (
        <div className="min-h-screen flex bg-gray-50 dark:bg-dark-950 text-gray-900 dark:text-white">

            {/* ── Sidebar (desktop, fixed) ───────────────────────────── */}
            <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-gray-200 dark:border-white/10 bg-white dark:bg-[#0a0e24] fixed inset-y-0 left-0">
                <SidebarContent
                    active={active} setActive={setActive} navigate={navigate}
                    userInitial={userInitial} userEmail={user?.email}
                    onProfile={() => navigate('/my-profile')} onLogout={handleLogout}
                />
            </aside>

            {/* ── Sidebar (mobile, slide-in drawer) ──────────────────── */}
            <AnimatePresence>
                {showMobileNav && (
                    <div className="lg:hidden fixed inset-0 z-[110]">
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                            onClick={() => setShowMobileNav(false)}
                        />
                        <motion.aside
                            initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
                            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
                            className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] flex flex-col bg-white dark:bg-[#0a0e24] shadow-2xl"
                        >
                            <div className="flex items-center justify-between px-4 pt-4">
                                <span className="text-xs font-semibold text-gray-400 dark:text-gray-600 uppercase tracking-wider">Menu</span>
                                <button
                                    onClick={() => setShowMobileNav(false)}
                                    aria-label="Close menu"
                                    className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <SidebarContent
                                active={active}
                                setActive={(s) => { setActive(s); setShowMobileNav(false); }}
                                navigate={(p) => { navigate(p); setShowMobileNav(false); }}
                                userInitial={userInitial} userEmail={user?.email}
                                onProfile={() => { navigate('/my-profile'); setShowMobileNav(false); }}
                                onLogout={() => { setShowMobileNav(false); handleLogout(); }}
                            />
                        </motion.aside>
                    </div>
                )}
            </AnimatePresence>

            {/* ── Main content ────────────────────────────────────────── */}
            <main className="flex-1 lg:ml-64 min-w-0">
                {/* Top bar */}
                <header className="flex items-center justify-between lg:justify-end gap-3 px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-white/10">
                    <button
                        onClick={() => setShowMobileNav(true)}
                        aria-label="Open menu"
                        className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 shrink-0"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                    <div className="relative hidden sm:block">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            placeholder="Search anything..."
                            className="w-64 pl-9 pr-4 py-2 text-sm rounded-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 outline-none focus:ring-2 focus:ring-purple-500/40"
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <ThemeSwitcher />
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-semibold text-sm shrink-0">
                            {userInitial}
                        </div>
                    </div>
                </header>

                <div className="p-6 lg:p-8 space-y-6">
                    {/* Title */}
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold">
                                {active === 'Dashboard' ? 'Admin Dashboard' : active}
                            </h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {active === 'Dashboard' ? "Welcome back! Here's what's happening on Clippixx." : ''}
                            </p>
                        </div>
                        <button
                            onClick={() => setShowCreateCreator(true)}
                            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl transition-colors text-sm font-medium shrink-0"
                        >
                            <Video className="w-4 h-4" /> Create Creator
                        </button>
                    </div>

                    {/* ── DASHBOARD ───────────────────────────────────────── */}
                    {active === 'Dashboard' && (
                    <>
                        {error && (
                            <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 rounded-xl flex items-center justify-between">
                                <span>Failed to load stats: {error}</span>
                                <button onClick={load} className="ml-4 text-sm underline hover:no-underline shrink-0">Retry</button>
                            </div>
                        )}

                        {/* Stat cards */}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                            {statCards.map((c) => (
                                <div key={c.label} className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d1230] p-5">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center`}>
                                            <c.icon className="w-5 h-5 text-white" />
                                        </div>
                                        <span className="text-xs text-gray-400 text-right leading-tight max-w-[80px]">{c.label}</span>
                                    </div>
                                    {loading ? (
                                        <div className="h-8 w-16 bg-gray-200 dark:bg-white/10 rounded animate-pulse" />
                                    ) : (
                                        <p className="text-3xl font-bold">{c.value ?? '—'}</p>
                                    )}
                                    <p className={`mt-2 text-xs font-medium ${c.up ? 'text-emerald-500' : 'text-orange-400'}`}>{c.delta}</p>
                                </div>
                            ))}
                        </div>

                        {/* Quick Actions */}
                        <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d1230] p-6">
                            <h2 className="text-lg font-semibold mb-5">Quick Actions</h2>
                            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                                {QUICK_ACTIONS.map((a) => (
                                    <button
                                        key={a.title}
                                        onClick={() => runQuickAction(a.action)}
                                        className="text-left rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-4 hover:border-purple-300 dark:hover:border-purple-500/40 transition group"
                                    >
                                        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${a.color} flex items-center justify-center mb-3`}>
                                            <a.icon className="w-5 h-5 text-white" />
                                        </div>
                                        <p className="text-sm font-semibold">{a.title}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{a.desc}</p>
                                        <ArrowRight className="w-4 h-4 text-purple-500 mt-3 group-hover:translate-x-1 transition-transform" />
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Bottom panels */}
                        <div className="grid lg:grid-cols-2 gap-6">
                            {/* Recent Activity */}
                            <Panel title="Recent Activity">
                                {loading ? (
                                    <SkeletonList />
                                ) : logs.length === 0 ? (
                                    <p className="text-sm text-gray-400 py-6 text-center">No recent activity.</p>
                                ) : (
                                    <div className="space-y-1">
                                        {logs.map((l) => (
                                            <div key={l.id} className="flex items-center gap-3 py-2.5">
                                                <div className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-500/15 flex items-center justify-center shrink-0">
                                                    <ClipboardList className="w-4 h-4 text-purple-500" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate">{ACTION_LABELS[l.action] || l.action}</p>
                                                    <p className="text-xs text-gray-400 truncate">{l.actor_email}{l.target_email ? ` → ${l.target_email}` : ''}</p>
                                                </div>
                                                <span className="text-xs text-gray-400 shrink-0">{timeAgo(l.created_at)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </Panel>

                            {/* System Overview — real metrics only, no fake percentages */}
                            <Panel title="Platform Summary">
                                <div className="space-y-1">
                                    {SYSTEM_OVERVIEW.map((s) => (
                                        <div key={s.label} className="flex items-center gap-3 py-2.5">
                                            <s.icon className="w-4 h-4 text-gray-400 shrink-0" />
                                            <span className="flex-1 text-sm truncate">{s.label}</span>
                                            {loading ? (
                                                <div className="h-4 w-16 bg-gray-200 dark:bg-white/10 rounded animate-pulse" />
                                            ) : (
                                                <span className={`flex items-center gap-1 text-xs font-medium ${s.up ? 'text-emerald-500' : 'text-orange-400'}`}>
                                                    {s.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                                    {s.label === 'Users Growth'   && (stats?.totalUsers    ?? '—')}
                                                    {s.label === 'Creator Growth' && (stats?.totalCreators ?? '—')}
                                                    {s.label === 'Feedback Received' && (stats?.pendingFeedback ?? '—')}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </Panel>
                        </div>
                    </>
                    )}

                    {/* ── USERS ───────────────────────────────────────────── */}
                    {active === 'Users' && (
                        <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d1230] overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10 flex justify-between items-center">
                                <h2 className="font-semibold text-lg">All Users</h2>
                                <button onClick={loadUsers} className="text-sm text-purple-500 hover:text-purple-400">Refresh</button>
                            </div>
                            {usersLoading ? (
                                <div className="p-12 text-center text-gray-500">Loading users…</div>
                            ) : usersError ? (
                                <div className="p-6 text-red-500 text-sm">{usersError} <button onClick={loadUsers} className="underline ml-2">Retry</button></div>
                            ) : (
                                <div className="overflow-auto max-h-[65vh] hscroll-shadow">
                                    <table className="w-full text-left text-sm">
                                        <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-[#161b38] text-gray-500 dark:text-gray-400">
                                            <tr>
                                                <th className="px-6 py-3 font-medium">Name</th>
                                                <th className="px-6 py-3 font-medium hidden md:table-cell">Email</th>
                                                <th className="px-6 py-3 font-medium">Role</th>
                                                <th className="px-6 py-3 font-medium hidden md:table-cell">Type</th>
                                                <th className="px-6 py-3 font-medium hidden md:table-cell">Joined</th>
                                                <th className="px-6 py-3 font-medium">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                            {users.map((u) => (
                                                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition">
                                                    <td className="px-6 py-3 font-medium">{u.first_name} {u.last_name}</td>
                                                    <td className="px-6 py-3 text-gray-500 hidden md:table-cell">{u.email}</td>
                                                    <td className="px-6 py-3">
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                                            u.role === 'super_admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300' :
                                                            u.role === 'admin'       ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300' :
                                                                                        'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300'
                                                        }`}>{u.role}</span>
                                                    </td>
                                                    <td className="px-6 py-3 text-gray-500 capitalize hidden md:table-cell">{u.account_type}</td>
                                                    <td className="px-6 py-3 text-gray-400 hidden md:table-cell">{new Date(u.created_at).toLocaleDateString()}</td>
                                                    <td className="px-6 py-3">
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                onClick={() => openEditUser(u)}
                                                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
                                                            >
                                                                <Pencil className="w-3 h-3" /> Edit
                                                            </button>
                                                            <button
                                                                onClick={() => setDeleteTarget(u)}
                                                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                                            >
                                                                <Trash2 className="w-3 h-3" /> Delete
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {users.length === 0 && (
                                                <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400">No users found.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── CREATORS ────────────────────────────────────────── */}
                    {active === 'Creators' && (
                        <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d1230] overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10 flex justify-between items-center">
                                <h2 className="font-semibold text-lg">Stars / Creators</h2>
                                <button onClick={loadCreators} className="text-sm text-purple-500 hover:text-purple-400">Refresh</button>
                            </div>
                            {creatorsLoading ? (
                                <div className="p-12 text-center text-gray-500">Loading creators…</div>
                            ) : creatorsError ? (
                                <div className="p-6 text-red-500 text-sm">{creatorsError} <button onClick={loadCreators} className="underline ml-2">Retry</button></div>
                            ) : (
                                <div className="overflow-auto max-h-[65vh] hscroll-shadow">
                                    <table className="w-full text-left text-sm">
                                        <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-[#161b38] text-gray-500 dark:text-gray-400">
                                            <tr>
                                                <th className="px-6 py-3 font-medium">Name</th>
                                                <th className="px-6 py-3 font-medium hidden md:table-cell">Category</th>
                                                <th className="px-6 py-3 font-medium">Price</th>
                                                <th className="px-6 py-3 font-medium hidden md:table-cell">Rating</th>
                                                <th className="px-6 py-3 font-medium hidden md:table-cell">Reviews</th>
                                                <th className="px-6 py-3 font-medium hidden md:table-cell">Featured</th>
                                                <th className="px-6 py-3 font-medium text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                            {creators.map((s) => (
                                                <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition">
                                                    <td className="px-6 py-3">
                                                        <div className="flex items-center gap-3">
                                                            <img src={s.image_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                                                            <span className="font-medium">{s.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-3 hidden md:table-cell">
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300">{s.category}</span>
                                                    </td>
                                                    <td className="px-6 py-3 text-gray-500">₹{Number(s.price).toLocaleString('en-IN')}</td>
                                                    <td className="px-6 py-3 text-gray-500 hidden md:table-cell">{Number(s.rating).toFixed(1)}</td>
                                                    <td className="px-6 py-3 text-gray-500 hidden md:table-cell">{s.reviews_count}</td>
                                                    <td className="px-6 py-3 hidden md:table-cell">
                                                        {s.is_featured && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">Featured</span>}
                                                    </td>
                                                    <td className="px-6 py-3">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <button
                                                                onClick={() => setEnrichTarget(s)}
                                                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors"
                                                            >
                                                                <Sparkles className="w-3 h-3" /> Enrich
                                                            </button>
                                                            <button
                                                                onClick={() => openStarEdit(s)}
                                                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
                                                            >
                                                                <Pencil className="w-3 h-3" /> Edit
                                                            </button>
                                                            <button
                                                                onClick={() => setStarDeleteTarget(s)}
                                                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                                            >
                                                                <Trash2 className="w-3 h-3" /> Delete
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {creators.length === 0 && (
                                                <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400">No creators yet.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── FEEDBACK ────────────────────────────────────────── */}
                    {active === 'Feedback' && (
                        <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d1230] overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10 flex flex-wrap gap-3 items-center justify-between">
                                <h2 className="font-semibold text-lg">User Feedback</h2>
                                <div className="flex items-center gap-2 flex-wrap">
                                    {(['', 'Bug Report', 'Feature Request', 'General Feedback', 'Other'] as const).map((t) => (
                                        <button
                                            key={t || 'all'}
                                            onClick={() => handleFeedbackFilter(t)}
                                            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                                feedbackTypeFilter === t
                                                    ? 'bg-purple-600 text-white'
                                                    : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/15'
                                            }`}
                                        >
                                            {t || 'All'}
                                        </button>
                                    ))}
                                    <button onClick={() => loadFeedback(feedbackTypeFilter)} className="text-sm text-purple-500 hover:text-purple-400 ml-1">Refresh</button>
                                </div>
                            </div>
                            {feedbackLoading ? (
                                <div className="p-12 text-center text-gray-500">Loading feedback…</div>
                            ) : feedbackError ? (
                                <div className="p-6 text-red-500 text-sm">{feedbackError} <button onClick={() => loadFeedback(feedbackTypeFilter)} className="underline ml-2">Retry</button></div>
                            ) : feedbackItems.length === 0 ? (
                                <p className="p-12 text-center text-gray-400 text-sm">No feedback yet.</p>
                            ) : (
                                <div className="divide-y divide-gray-100 dark:divide-white/5">
                                    {feedbackItems.map((f) => (
                                        <div key={f.id} className="px-6 py-4">
                                            <div className="flex flex-wrap gap-2 items-start justify-between mb-1">
                                                <div className="flex items-center gap-2">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${FEEDBACK_TYPE_COLOR[f.type]}`}>{f.type}</span>
                                                    <span className="text-sm font-medium">{f.subject}</span>
                                                </div>
                                                <span className="text-xs text-gray-400 shrink-0">{new Date(f.created_at).toLocaleDateString()}</span>
                                            </div>
                                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{f.message}</p>
                                            {f.email && <p className="text-xs text-gray-400 mt-1">From: {f.email}</p>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── CREATOR APPLICATIONS ────────────────────────────── */}
                    {active === 'Creator Applications' && (
                        <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d1230] p-6">
                            <PendingApplicationsPanel onStatusChange={load} />
                        </div>
                    )}

                    {/* ── VERIFICATION REQUESTS ───────────────────────────── */}
                    {active === 'Verification Requests' && (
                        <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d1230] p-6">
                            <CreatorVerificationPanel onStatusChange={load} />
                        </div>
                    )}

                    {/* ── BOOKINGS ────────────────────────────────────────── */}
                    {active === 'Bookings' && (
                        <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d1230] overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10 flex flex-wrap gap-3 justify-between items-center">
                                <div>
                                    <h2 className="font-semibold text-lg">Bookings</h2>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{bookingTotal} total across all creators</p>
                                </div>
                                <div className="flex items-center gap-3 flex-wrap">
                                    <div className="relative">
                                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            value={bookingSearch}
                                            onChange={(e) => setBookingSearch(e.target.value)}
                                            placeholder="Search fan email or creator…"
                                            className="w-64 pl-9 pr-3 py-2 rounded-lg text-sm bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 outline-none focus:ring-2 focus:ring-purple-500"
                                        />
                                    </div>
                                    <button onClick={() => loadBookings(bookingPage)} className="text-sm text-purple-500 hover:text-purple-400">Refresh</button>
                                </div>
                            </div>

                            {/* Status filter tabs */}
                            <div className="px-6 py-3 border-b border-gray-200 dark:border-white/10 flex flex-wrap gap-2">
                                {([['', 'All'], ...BOOKING_STATUSES.map((s) => [s, BOOKING_STATUS_LABEL[s]] as const)] as [AdminBookingStatus | '', string][]).map(([value, label]) => (
                                    <button
                                        key={label}
                                        onClick={() => setBookingStatusFilter(value)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                                            bookingStatusFilter === value
                                                ? 'bg-purple-600 text-white'
                                                : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10'
                                        }`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>

                            {bookingsLoading ? (
                                <div className="p-12 text-center text-gray-500">Loading bookings…</div>
                            ) : bookingsError ? (
                                <div className="p-6 text-red-500 text-sm">{bookingsError} <button onClick={() => loadBookings(1)} className="underline ml-2">Retry</button></div>
                            ) : (
                                <>
                                    <div className="overflow-auto max-h-[65vh] hscroll-shadow">
                                        <table className="w-full text-left text-sm">
                                            <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-[#161b38] text-gray-500 dark:text-gray-400">
                                                <tr>
                                                    <th className="px-6 py-3 font-medium hidden md:table-cell">Booking</th>
                                                    <th className="px-6 py-3 font-medium">Fan</th>
                                                    <th className="px-6 py-3 font-medium hidden md:table-cell">Creator</th>
                                                    <th className="px-6 py-3 font-medium hidden md:table-cell">Service</th>
                                                    <th className="px-6 py-3 font-medium">Amount</th>
                                                    <th className="px-6 py-3 font-medium">Status</th>
                                                    <th className="px-6 py-3 font-medium hidden md:table-cell">Date</th>
                                                    <th className="px-6 py-3 font-medium text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                                {bookings.map((b) => (
                                                    <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition">
                                                        <td className="px-6 py-3 font-mono text-xs text-gray-400 hidden md:table-cell">{b.id.slice(0, 8)}…</td>
                                                        <td className="px-6 py-3">
                                                            <p className="font-medium">{b.fan_name || `${b.fan_first_name ?? ''} ${b.fan_last_name ?? ''}`.trim() || '—'}</p>
                                                            <p className="text-xs text-gray-500">{b.fan_email || '—'}</p>
                                                        </td>
                                                        <td className="px-6 py-3 hidden md:table-cell">{b.creator_name || '—'}</td>
                                                        <td className="px-6 py-3 text-gray-500 hidden md:table-cell">{b.tier_name || 'Personalized Video'}</td>
                                                        <td className="px-6 py-3 font-medium">{fmtINR(b.tier_price)}</td>
                                                        <td className="px-6 py-3">
                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${BOOKING_STATUS_COLOR[b.status]}`}>
                                                                {BOOKING_STATUS_LABEL[b.status]}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-3 text-gray-400 hidden md:table-cell">{new Date(b.created_at).toLocaleDateString()}</td>
                                                        <td className="px-6 py-3 text-right">
                                                            <button
                                                                onClick={() => openBookingDetail(b.id)}
                                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors"
                                                            >
                                                                <Eye className="w-3 h-3" /> View
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {bookings.length === 0 && (
                                                    <tr><td colSpan={8} className="px-6 py-12 text-center text-gray-400">No bookings found.</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                    {/* Pagination */}
                                    <div className="px-6 py-3 border-t border-gray-200 dark:border-white/10 flex items-center justify-between text-sm">
                                        <span className="text-gray-500 dark:text-gray-400">Page {bookingPage} of {bookingTotalPages}</span>
                                        <div className="flex gap-2">
                                            <button
                                                disabled={bookingPage <= 1}
                                                onClick={() => loadBookings(bookingPage - 1)}
                                                className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-white/5 transition"
                                            >
                                                Previous
                                            </button>
                                            <button
                                                disabled={bookingPage >= bookingTotalPages}
                                                onClick={() => loadBookings(bookingPage + 1)}
                                                className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-white/5 transition"
                                            >
                                                Next
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* ── AUDIT LOGS ──────────────────────────────────────── */}
                    {active === 'Audit Logs' && (
                        <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d1230] overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10 flex justify-between items-center">
                                <div>
                                    <h2 className="font-semibold text-lg">Audit Log</h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">All privileged actions performed by admins.</p>
                                </div>
                                <button onClick={() => loadAuditLogs(auditPage)} className="text-sm text-purple-500 hover:text-purple-400">Refresh</button>
                            </div>
                            {auditError && (
                                <div className="mx-6 mt-4 p-3 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg text-sm">{auditError}</div>
                            )}
                            {auditLoading ? (
                                <div className="p-12 text-center text-gray-500">Loading audit logs…</div>
                            ) : (
                                <div className="overflow-auto max-h-[65vh] hscroll-shadow">
                                    <table className="w-full text-left text-sm">
                                        <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-[#161b38] text-gray-500 dark:text-gray-400">
                                            <tr>
                                                <th className="px-6 py-3 font-medium hidden md:table-cell">Time</th>
                                                <th className="px-6 py-3 font-medium">Actor</th>
                                                <th className="px-6 py-3 font-medium">Action</th>
                                                <th className="px-6 py-3 font-medium hidden md:table-cell">Target</th>
                                                <th className="px-6 py-3 font-medium hidden md:table-cell">Details</th>
                                                <th className="px-6 py-3 font-medium text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                            {auditLogs.map((log) => (
                                                <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition">
                                                    <td className="px-6 py-3 text-gray-500 whitespace-nowrap hidden md:table-cell">{new Date(log.created_at).toLocaleString()}</td>
                                                    <td className="px-6 py-3 text-gray-700 dark:text-gray-300">{log.actor_email}</td>
                                                    <td className="px-6 py-3">
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300">{ACTION_LABELS[log.action] ?? log.action}</span>
                                                    </td>
                                                    <td className="px-6 py-3 text-gray-500 hidden md:table-cell">{log.target_email ?? '—'}</td>
                                                    <td className="px-6 py-3 text-gray-400 font-mono text-xs max-w-xs truncate hidden md:table-cell">{JSON.stringify(log.metadata)}</td>
                                                    <td className="px-6 py-3">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <button onClick={() => openAuditEdit(log)} className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors" title="Edit entry">
                                                                <Pencil className="w-4 h-4" />
                                                            </button>
                                                            <button onClick={() => setAuditDeleteTarget(log)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors" title="Delete entry">
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {auditLogs.length === 0 && (
                                                <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400">No audit logs yet.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                    {auditTotalPages > 1 && (
                                        <div className="flex justify-center items-center gap-3 p-4 border-t border-gray-100 dark:border-white/5">
                                            <button onClick={() => loadAuditLogs(auditPage - 1)} disabled={auditPage === 1} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 disabled:opacity-40 text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition">Previous</button>
                                            <span className="text-sm text-gray-500">Page {auditPage} of {auditTotalPages}</span>
                                            <button onClick={() => loadAuditLogs(auditPage + 1)} disabled={auditPage === auditTotalPages} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 disabled:opacity-40 text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition">Next</button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── ANALYTICS ───────────────────────────────────────── */}
                    {active === 'Analytics' && (
                        <ComingSoon title="Analytics" description="Platform analytics and reporting dashboards are in development." />
                    )}

                    {/* ── PLATFORM SETTINGS ───────────────────────────────── */}
                    {active === 'Platform Settings' && (
                        <ComingSoon title="Platform Settings" description="Global configuration options will be available here." />
                    )}
                </div>

                {/* ── BOOKING DETAIL MODAL ──────────────────── */}
                {(bookingDetail || bookingDetailLoading) && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl w-full max-w-lg relative max-h-[85vh] overflow-y-auto">
                            <button
                                onClick={() => { setBookingDetail(null); setBookingStatusError(null); }}
                                className="absolute top-4 right-4 text-gray-500 hover:text-gray-900 dark:hover:text-white"
                                aria-label="Close"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            {bookingDetailLoading || !bookingDetail ? (
                                <div className="p-16 flex items-center justify-center">
                                    <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
                                </div>
                            ) : (
                                <div className="p-6">
                                    <div className="flex items-center gap-3 mb-1">
                                        <h3 className="text-lg font-bold">Booking Detail</h3>
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${BOOKING_STATUS_COLOR[bookingDetail.status]}`}>
                                            {BOOKING_STATUS_LABEL[bookingDetail.status]}
                                        </span>
                                    </div>
                                    <p className="font-mono text-xs text-gray-400 mb-5">{bookingDetail.id}</p>

                                    <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                                        <DetailField label="Fan" value={bookingDetail.fan_name || `${bookingDetail.fan_first_name ?? ''} ${bookingDetail.fan_last_name ?? ''}`.trim() || '—'} />
                                        <DetailField label="Fan Email" value={bookingDetail.fan_email || '—'} />
                                        <DetailField label="Creator" value={bookingDetail.creator_name || '—'} />
                                        <DetailField label="Category" value={bookingDetail.creator_category || '—'} />
                                        <DetailField label="Service" value={bookingDetail.tier_name || 'Personalized Video'} />
                                        <DetailField label="Amount" value={fmtINR(bookingDetail.tier_price)} />
                                        <DetailField label="Occasion" value={bookingDetail.occasion || '—'} />
                                        <DetailField
                                            label="Recipient"
                                            value={bookingDetail.is_gift ? `${bookingDetail.gift_recipient_name || '—'} (gift)` : (bookingDetail.fan_name || '—')}
                                        />
                                        <DetailField label="Created" value={new Date(bookingDetail.created_at).toLocaleString()} />
                                        <DetailField
                                            label="Delivered"
                                            value={bookingDetail.video_delivered_at ? new Date(bookingDetail.video_delivered_at).toLocaleString() : 'Not delivered yet'}
                                        />
                                    </div>

                                    {bookingDetail.instructions && (
                                        <div className="mt-4 p-3 rounded-xl bg-gray-50 dark:bg-white/5 text-sm">
                                            <p className="text-xs font-medium text-gray-400 mb-1">Instructions</p>
                                            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{bookingDetail.instructions}</p>
                                        </div>
                                    )}
                                    {bookingDetail.fan_message && (
                                        <div className="mt-3 p-3 rounded-xl bg-gray-50 dark:bg-white/5 text-sm">
                                            <p className="text-xs font-medium text-gray-400 mb-1">Fan Message</p>
                                            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{bookingDetail.fan_message}</p>
                                        </div>
                                    )}
                                    {bookingDetail.video_url && (
                                        <a
                                            href={bookingDetail.video_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-purple-600 dark:text-purple-400 hover:underline"
                                        >
                                            <Video className="w-4 h-4" /> View delivered video
                                        </a>
                                    )}

                                    {/* Status update */}
                                    <div className="mt-6 pt-4 border-t border-gray-200 dark:border-white/10">
                                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5">Change Status</label>
                                        <div className="flex items-center gap-2">
                                            <select
                                                value={bookingNewStatus}
                                                onChange={(e) => setBookingNewStatus(e.target.value as AdminBookingStatus)}
                                                className="flex-1 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500 [color-scheme:dark]"
                                            >
                                                {BOOKING_STATUSES.map((s) => (
                                                    <option key={s} value={s}>{BOOKING_STATUS_LABEL[s]}</option>
                                                ))}
                                            </select>
                                            <button
                                                onClick={handleBookingStatusSave}
                                                disabled={bookingStatusSaving || bookingNewStatus === bookingDetail.status}
                                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
                                            >
                                                {bookingStatusSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                                                {bookingStatusSaving ? 'Updating…' : 'Update Status'}
                                            </button>
                                        </div>
                                        {bookingStatusError && <p className="mt-2 text-sm text-red-500">{bookingStatusError}</p>}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── EDIT USER MODAL ───────────────────────── */}
                {editTarget && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl w-full max-w-md relative">
                            <button onClick={() => setEditTarget(null)} className="absolute top-4 right-4 text-gray-500 hover:text-gray-900 dark:hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                            <div className="p-6 border-b border-gray-100 dark:border-dark-700">
                                <h3 className="text-xl font-bold">Edit User</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{editTarget.email}</p>
                            </div>
                            <form onSubmit={handleEditSave} className="p-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First Name</label>
                                        <input
                                            required
                                            type="text"
                                            value={editForm.first_name}
                                            onChange={(e) => setEditForm((f) => ({ ...f, first_name: e.target.value }))}
                                            className="w-full rounded-lg border border-gray-300 dark:border-dark-600 p-2 text-sm dark:bg-dark-700"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Name</label>
                                        <input
                                            type="text"
                                            value={editForm.last_name}
                                            onChange={(e) => setEditForm((f) => ({ ...f, last_name: e.target.value }))}
                                            className="w-full rounded-lg border border-gray-300 dark:border-dark-600 p-2 text-sm dark:bg-dark-700"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                                    <input
                                        type="tel"
                                        value={editForm.phone}
                                        onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                                        placeholder="Optional"
                                        className="w-full rounded-lg border border-gray-300 dark:border-dark-600 p-2 text-sm dark:bg-dark-700"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bio</label>
                                    <textarea
                                        rows={3}
                                        value={editForm.bio}
                                        onChange={(e) => setEditForm((f) => ({ ...f, bio: e.target.value }))}
                                        placeholder="Optional"
                                        className="w-full rounded-lg border border-gray-300 dark:border-dark-600 p-2 text-sm dark:bg-dark-700 resize-none"
                                    />
                                </div>
                                {editError && (
                                    <p className="text-sm text-red-500">{editError}</p>
                                )}
                                <div className="flex justify-end gap-3 pt-2">
                                    <button type="button" onClick={() => setEditTarget(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition dark:text-gray-300 dark:hover:bg-dark-700">
                                        Cancel
                                    </button>
                                    <button type="submit" disabled={editSaving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition">
                                        {editSaving ? 'Saving…' : 'Save Changes'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* ── DELETE CONFIRMATION ───────────────────── */}
                {deleteTarget && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl w-full max-w-sm p-6">
                            <h3 className="text-lg font-bold mb-2">Delete User?</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                                <span className="font-medium text-gray-900 dark:text-white">{deleteTarget.first_name} {deleteTarget.last_name}</span>
                                {' '}({deleteTarget.email}) will be permanently deleted. This cannot be undone.
                            </p>
                            <div className="flex justify-end gap-3">
                                <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition dark:text-gray-300 dark:hover:bg-dark-700">
                                    Cancel
                                </button>
                                <button onClick={handleDeleteConfirm} disabled={deleteLoading} className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition">
                                    {deleteLoading ? 'Deleting…' : 'Delete'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── CREATE CREATOR MODAL ──────────────────── */}
                {showCreateCreator && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl w-full max-w-lg relative max-h-[90vh] overflow-y-auto">
                            <button onClick={() => setShowCreateCreator(false)} className="absolute top-4 right-4 text-gray-500 hover:text-gray-900 dark:hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                            <div className="p-6 border-b border-gray-100 dark:border-dark-700">
                                <h3 className="text-xl font-bold">Create Creator</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Username + password only — no email needed.</p>
                            </div>
                            <div className="p-6">
                                <CreateCreatorForm onCreated={load} />
                            </div>
                        </div>
                    </div>
                )}

                {/* ── EDIT AUDIT LOG MODAL ──────────────────── */}
                {auditEditTarget && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl w-full max-w-lg relative max-h-[90vh] overflow-y-auto">
                            <button onClick={() => setAuditEditTarget(null)} className="absolute top-4 right-4 text-gray-500 hover:text-gray-900 dark:hover:text-white"><X className="w-5 h-5" /></button>
                            <div className="p-6 border-b border-gray-100 dark:border-dark-700">
                                <h3 className="text-xl font-bold">Edit Audit Log Entry</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">By {auditEditTarget.actor_email} · {new Date(auditEditTarget.created_at).toLocaleString()}</p>
                            </div>
                            <form onSubmit={handleAuditEditSave} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Action</label>
                                    <select
                                        value={auditEditForm.action}
                                        onChange={(e) => setAuditEditForm((f) => ({ ...f, action: e.target.value as AuditLog['action'] }))}
                                        className="w-full rounded-lg border border-gray-300 dark:border-dark-600 p-2 text-sm dark:bg-dark-700"
                                    >
                                        {EDITABLE_ACTIONS.map((a) => (
                                            <option key={a} value={a}>{ACTION_LABELS[a] ?? a}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Email</label>
                                    <input
                                        type="text"
                                        value={auditEditForm.target_email}
                                        onChange={(e) => setAuditEditForm((f) => ({ ...f, target_email: e.target.value }))}
                                        placeholder="Optional"
                                        className="w-full rounded-lg border border-gray-300 dark:border-dark-600 p-2 text-sm dark:bg-dark-700"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Details (JSON)</label>
                                    <textarea
                                        rows={6}
                                        value={auditEditForm.metadata}
                                        onChange={(e) => setAuditEditForm((f) => ({ ...f, metadata: e.target.value }))}
                                        className="w-full rounded-lg border border-gray-300 dark:border-dark-600 p-2 text-xs font-mono dark:bg-dark-700 resize-none"
                                    />
                                </div>
                                {auditEditError && <p className="text-sm text-red-500">{auditEditError}</p>}
                                <div className="flex justify-end gap-3 pt-2 border-t border-gray-100 dark:border-dark-700">
                                    <button type="button" onClick={() => setAuditEditTarget(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition dark:text-gray-300 dark:hover:bg-dark-700">Cancel</button>
                                    <button type="submit" disabled={auditEditSaving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition">{auditEditSaving ? 'Saving…' : 'Save Changes'}</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* ── DELETE AUDIT LOG CONFIRMATION ─────────── */}
                {auditDeleteTarget && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl w-full max-w-sm p-6">
                            <h3 className="text-lg font-bold mb-2">Delete Audit Entry?</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                                This permanently removes this <span className="font-medium text-gray-900 dark:text-white">{ACTION_LABELS[auditDeleteTarget.action] ?? auditDeleteTarget.action}</span> audit log entry. This cannot be undone.
                            </p>
                            <div className="flex justify-end gap-3">
                                <button onClick={() => setAuditDeleteTarget(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition dark:text-gray-300 dark:hover:bg-dark-700">Cancel</button>
                                <button onClick={handleAuditDeleteConfirm} disabled={auditDeleting} className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition">{auditDeleting ? 'Deleting…' : 'Delete'}</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── EDIT CREATOR MODAL ────────────────────── */}
                {starEditTarget && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl w-full max-w-lg relative max-h-[90vh] overflow-y-auto">
                            <button onClick={() => setStarEditTarget(null)} className="absolute top-4 right-4 text-gray-500 hover:text-gray-900 dark:hover:text-white"><X className="w-5 h-5" /></button>
                            <div className="p-6 border-b border-gray-100 dark:border-dark-700">
                                <h3 className="text-xl font-bold">Edit Creator</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{starEditTarget.name}</p>
                            </div>
                            <form onSubmit={handleStarEditSave} className="p-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                                        <input required type="text" value={starEditForm.name} onChange={(e) => setStarEditForm((f) => ({ ...f, name: e.target.value }))} className="w-full rounded-lg border border-gray-300 dark:border-dark-600 p-2 text-sm dark:bg-dark-700" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                                        <select value={starEditForm.category} onChange={(e) => setStarEditForm((f) => ({ ...f, category: e.target.value }))} className="w-full rounded-lg border border-gray-300 dark:border-dark-600 p-2 text-sm dark:bg-dark-700">
                                            <option value="Actor">Actor</option>
                                            <option value="Athlete">Athlete</option>
                                            <option value="Creator">Creator</option>
                                            <option value="Musician">Musician</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Image URL</label>
                                    <input required type="url" value={starEditForm.image_url} onChange={(e) => setStarEditForm((f) => ({ ...f, image_url: e.target.value }))} className="w-full rounded-lg border border-gray-300 dark:border-dark-600 p-2 text-sm dark:bg-dark-700" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Price ($)</label>
                                        <input required type="number" min="1" value={starEditForm.price} onChange={(e) => setStarEditForm((f) => ({ ...f, price: Number(e.target.value) }))} className="w-full rounded-lg border border-gray-300 dark:border-dark-600 p-2 text-sm dark:bg-dark-700" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rating</label>
                                        <input type="number" step="0.1" min="0" max="5" value={starEditForm.rating} onChange={(e) => setStarEditForm((f) => ({ ...f, rating: Number(e.target.value) }))} className="w-full rounded-lg border border-gray-300 dark:border-dark-600 p-2 text-sm dark:bg-dark-700" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Biography</label>
                                    <textarea rows={3} value={starEditForm.bio} onChange={(e) => setStarEditForm((f) => ({ ...f, bio: e.target.value }))} className="w-full rounded-lg border border-gray-300 dark:border-dark-600 p-2 text-sm dark:bg-dark-700 resize-none" />
                                </div>
                                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                                    <input type="checkbox" checked={starEditForm.is_featured} onChange={(e) => setStarEditForm((f) => ({ ...f, is_featured: e.target.checked }))} className="rounded text-purple-600" />
                                    Feature on homepage
                                </label>
                                {starEditError && <p className="text-sm text-red-500">{starEditError}</p>}
                                <div className="flex justify-end gap-3 pt-2 border-t border-gray-100 dark:border-dark-700">
                                    <button type="button" onClick={() => setStarEditTarget(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition dark:text-gray-300 dark:hover:bg-dark-700">Cancel</button>
                                    <button type="submit" disabled={starEditSaving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition">{starEditSaving ? 'Saving…' : 'Save Changes'}</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* ── DELETE CREATOR CONFIRMATION ───────────── */}
                {starDeleteTarget && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl w-full max-w-sm p-6">
                            <h3 className="text-lg font-bold mb-2">Delete Creator?</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                                <span className="font-medium text-gray-900 dark:text-white">{starDeleteTarget.name}</span> will be permanently removed from the catalogue. This cannot be undone.
                            </p>
                            <div className="flex justify-end gap-3">
                                <button onClick={() => setStarDeleteTarget(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition dark:text-gray-300 dark:hover:bg-dark-700">Cancel</button>
                                <button onClick={handleStarDeleteConfirm} disabled={starDeleting} className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition">{starDeleting ? 'Deleting…' : 'Delete'}</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Enrich Profile modal */}
                {enrichTarget && (
                    <EnrichProfileModal
                        starId={enrichTarget.id}
                        initialName={enrichTarget.name}
                        onClose={() => setEnrichTarget(null)}
                        onSaved={() => loadCreators()}
                    />
                )}
            </main>
        </div>
    );
}

// ─── Sidebar (shared by desktop-fixed and mobile-drawer renders) ────────────

function SidebarContent({
    active, setActive, navigate, userInitial, userEmail, onProfile, onLogout,
}: {
    active: SectionName;
    setActive: (s: SectionName) => void;
    navigate: (path: string) => void;
    userInitial: string;
    userEmail?: string | null;
    onProfile: () => void;
    onLogout: () => void;
}) {
    return (
        <>
            <div className="px-6 py-5">
                <a href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }} className="inline-block">
                    <img src="/logo-dark.png" alt="Clippixx" className="h-8 w-auto block dark:hidden" />
                    <img src="/logo-light.png" alt="Clippixx" className="h-8 w-auto hidden dark:block" />
                </a>
            </div>

            {/* User card */}
            <div className="mx-4 mb-4 p-3 rounded-xl bg-gray-50 dark:bg-white/5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-semibold">
                    {userInitial}
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{userEmail}</p>
                    <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300">Admin</span>
                </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
                {NAV_ITEMS.map((item) => {
                    const isActive = active === item.label;
                    return (
                        <button
                            key={item.label}
                            onClick={() => { setActive(item.label); if (item.path) navigate(item.path); }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                                isActive
                                    ? 'bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300'
                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'
                            }`}
                        >
                            <item.icon className="w-4 h-4" />
                            {item.label}
                        </button>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="px-3 py-4 border-t border-gray-200 dark:border-white/10 space-y-1">
                <button onClick={onProfile} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
                    <User className="w-4 h-4" /> My Profile
                </button>
                <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                    <LogOut className="w-4 h-4" /> Sign Out
                </button>
                <p className="px-3 pt-2 text-[11px] text-gray-400 dark:text-gray-600">© 2026 Clippixx. All rights reserved.</p>
            </div>
        </>
    );
}

// ─── Reusable pieces ─────────────────────────────────────────────────────────

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d1230] p-6 flex flex-col">
            <h3 className="font-semibold mb-3">{title}</h3>
            <div className="flex-1">{children}</div>
        </div>
    );
}

function ComingSoon({ title, description }: { title: string; description: string }) {
    return (
        <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d1230] p-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-purple-100 dark:bg-purple-500/15 flex items-center justify-center mx-auto mb-4">
                <Settings className="w-8 h-8 text-purple-500" />
            </div>
            <h3 className="text-xl font-bold mb-2">{title}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">{description}</p>
        </div>
    );
}

function SkeletonList() {
    return (
        <div className="space-y-3 py-2">
            {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-gray-200 dark:bg-white/10 animate-pulse" />
                    <div className="flex-1 space-y-1.5">
                        <div className="h-3 w-2/3 bg-gray-200 dark:bg-white/10 rounded animate-pulse" />
                        <div className="h-2.5 w-1/3 bg-gray-200 dark:bg-white/10 rounded animate-pulse" />
                    </div>
                </div>
            ))}
        </div>
    );
}

function DetailField({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
            <p className="font-medium text-gray-900 dark:text-white break-words">{value}</p>
        </div>
    );
}
