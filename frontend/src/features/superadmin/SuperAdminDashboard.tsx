import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    getAdminStats, getAuditLogs, adminListProfiles, adminUpdateRole,
    adminDeleteUser, adminCreateUser, fetchStars, adminCreateStar, adminDeleteStar,
    updateAuditLog, deleteAuditLog,
} from "@/services/api";
import type { AdminStats, AuditLog, Profile, Star, UserRole, PaginationMeta } from "@/services/api";
import { useAuth } from "@/providers/AuthProvider";
import { useModals } from "@/providers/ModalProvider";
import { invalidateRoleClientCache } from "@/hooks/useRole";
import ThemeSwitcher from "@/components/ui/ThemeSwitcher";
import {
    LayoutDashboard, Users, Building2, MessageSquare, FolderClosed, BarChart3,
    ScrollText, Settings, ShieldCheck, User, LogOut, Search, ArrowRight,
    Users2, UserCog, Monitor, TrendingUp, TrendingDown, Plus, Video, X,
    KeyRound, Trash2, Pencil, Menu,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import CreateCreatorForm from "@/components/admin/CreateCreatorForm";
import ResetPasswordModal from "@/components/admin/ResetPasswordModal";
import PendingApplicationsPanel from "@/components/admin/PendingApplicationsPanel";
import CreatorVerificationPanel from "@/components/admin/CreatorVerificationPanel";

type SectionName =
    | 'Dashboard' | 'Users' | 'Organizations' | 'Feedback' | 'Content'
    | 'Analytics' | 'Audit Logs' | 'Platform Settings' | 'Security'
    | 'Creator Applications' | 'Verification Requests' | 'Stars';

// ─── Sidebar nav config ──────────────────────────────────────────────────────
const NAV_ITEMS: { label: SectionName; icon: LucideIcon }[] = [
    { label: 'Dashboard',         icon: LayoutDashboard },
    { label: 'Users',             icon: Users },
    { label: 'Organizations',     icon: Building2 },
    { label: 'Feedback',          icon: MessageSquare },
    { label: 'Content',           icon: FolderClosed },
    { label: 'Analytics',         icon: BarChart3 },
    { label: 'Audit Logs',        icon: ScrollText },
    { label: 'Platform Settings', icon: Settings },
    { label: 'Security',          icon: ShieldCheck },
];

// ─── Public site links (shown in the dashboard topbar) ───────────────────────
const PUBLIC_LINKS: { label: string; to: string }[] = [
    { label: 'Categories',      to: '/browse' },
    { label: 'For Business',    to: '/for-business' },
    { label: 'Join as Creator', to: '/creator' },
];

// ─── Quick action config ─────────────────────────────────────────────────────
type QuickAction =
    | { kind: 'add-user' }
    | { kind: 'create-creator' }
    | { kind: 'view'; view: SectionName };

const QUICK_ACTIONS: { title: string; desc: string; icon: LucideIcon; color: string; action: QuickAction }[] = [
    { title: 'Add User',          desc: 'Create a new user account.',              icon: Users,         color: 'from-purple-500 to-purple-700', action: { kind: 'add-user' } },
    { title: 'Create Creator',    desc: 'Onboard a creator with username & password.', icon: Video,    color: 'from-emerald-500 to-green-600', action: { kind: 'create-creator' } },
    { title: 'Platform Settings', desc: 'Configure platform preferences.',         icon: Settings,      color: 'from-blue-500 to-indigo-600',   action: { kind: 'view', view: 'Platform Settings' } },
    { title: 'View Analytics',    desc: 'View platform analytics.',                icon: BarChart3,     color: 'from-violet-500 to-indigo-600', action: { kind: 'view', view: 'Analytics' } },
    { title: 'Audit Logs',        desc: 'View system logs.',                       icon: ScrollText,    color: 'from-orange-500 to-amber-600',  action: { kind: 'view', view: 'Audit Logs' } },
];

const SYSTEM_OVERVIEW: { label: string; icon: LucideIcon; key: keyof AdminStats; up: boolean }[] = [
    { label: 'Total Users',       icon: Users2,        key: 'totalUsers',          up: true  },
    { label: 'Total Admins',      icon: UserCog,       key: 'totalAdmins',         up: true  },
    { label: 'Total Creators',    icon: Video,         key: 'totalCreators',       up: true  },
    { label: 'Pending Feedback',  icon: MessageSquare, key: 'pendingFeedback',     up: false },
    { label: 'Pending Verifications', icon: ShieldCheck, key: 'pendingVerifications', up: false },
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

const ROLE_BADGE: Record<string, string> = {
    super_admin: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300',
    admin:       'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
    user:        'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300',
};

const PAGE_SIZE = 10;

export default function SuperAdminDashboard() {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { openLogin } = useModals();

    const [active, setActive] = useState<SectionName>('Dashboard');
    const [showMobileNav, setShowMobileNav] = useState(false);

    // Content Hub sub-tab (persists while inside the Content section)
    const [contentTab, setContentTab] = useState<'stars' | 'applications' | 'verification'>('stars');

    // Dashboard stats + recent activity
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Users section
    const [users, setUsers] = useState<Profile[]>([]);
    const [usersPagination, setUsersPagination] = useState<PaginationMeta | null>(null);
    const [usersLoading, setUsersLoading] = useState(false);
    const [usersError, setUsersError] = useState<string | null>(null);
    const [userPage, setUserPage] = useState(1);
    const [searchInput, setSearchInput] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');

    // Stars section
    const [stars, setStars] = useState<Star[]>([]);
    const [starsLoading, setStarsLoading] = useState(false);
    const [starsError, setStarsError] = useState<string | null>(null);

    // Audit logs section (full, paginated)
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [auditLoading, setAuditLoading] = useState(false);
    const [auditError, setAuditError] = useState<string | null>(null);
    const [auditPage, setAuditPage] = useState(1);
    const [auditTotalPages, setAuditTotalPages] = useState(1);

    // Audit log edit / delete
    const [auditEditTarget, setAuditEditTarget] = useState<AuditLog | null>(null);
    const [auditEditForm, setAuditEditForm] = useState({ action: '' as AuditLog['action'], target_email: '', metadata: '' });
    const [auditEditSaving, setAuditEditSaving] = useState(false);
    const [auditEditError, setAuditEditError] = useState<string | null>(null);
    const [auditDeleteTarget, setAuditDeleteTarget] = useState<AuditLog | null>(null);
    const [auditDeleting, setAuditDeleting] = useState(false);

    // Modals
    const [showAddUser, setShowAddUser] = useState(false);
    const [newUserForm, setNewUserForm] = useState({ email: '', password: '', first_name: '', last_name: '', role: 'user' as UserRole });
    const [isAddingUser, setIsAddingUser] = useState(false);
    const [addUserError, setAddUserError] = useState<string | null>(null);

    const [showCreateCreator, setShowCreateCreator] = useState(false);
    const [resetTarget, setResetTarget] = useState<{ id: string; label: string } | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const [showAddStar, setShowAddStar] = useState(false);
    const [newStarForm, setNewStarForm] = useState({ name: '', category: 'Actor', image_url: '', rating: 5.0, reviews_count: 0, price: 100, is_featured: false, bio: '' });
    const [isAddingStar, setIsAddingStar] = useState(false);

    // ── Loaders ──────────────────────────────────────────────────────────────
    const loadDashboard = useCallback(() => {
        setLoading(true);
        setError(null);
        let cancelled = false;
        Promise.all([
            getAdminStats(),
            getAuditLogs({ limit: 6 }).catch(() => ({ data: [] as AuditLog[] })),
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

    const loadUsers = useCallback(async (page: number, search: string, role: UserRole | '') => {
        setUsersLoading(true);
        setUsersError(null);
        try {
            const res = await adminListProfiles({
                page, limit: PAGE_SIZE,
                ...(search ? { search } : {}),
                ...(role ? { role } : {}),
            });
            setUsers(res.data);
            setUsersPagination(res.pagination);
        } catch (err) {
            setUsersError(err instanceof Error ? err.message : 'Failed to load users');
        } finally {
            setUsersLoading(false);
        }
    }, []);

    const loadStars = useCallback(async () => {
        setStarsLoading(true);
        setStarsError(null);
        try {
            setStars(await fetchStars({ limit: 100 }));
        } catch (err) {
            setStarsError(err instanceof Error ? err.message : 'Failed to load stars');
        } finally {
            setStarsLoading(false);
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
        // Validate JSON before sending so the user gets a clear message.
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

    useEffect(() => { loadDashboard(); }, [loadDashboard]);

    // Lazy-load each section's data the first time it's opened / when its filters change.
    useEffect(() => {
        if (active === 'Users')      loadUsers(userPage, searchTerm, roleFilter);
        if (active === 'Stars' && stars.length === 0)       loadStars();
        if (active === 'Content' && contentTab === 'stars' && stars.length === 0) loadStars();
        if (active === 'Audit Logs') loadAuditLogs(1);
    }, [active, contentTab, userPage, searchTerm, roleFilter]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Handlers ─────────────────────────────────────────────────────────────
    const runQuickAction = (action: QuickAction) => {
        if (action.kind === 'add-user') { setShowAddUser(true); return; }
        if (action.kind === 'create-creator') { setShowCreateCreator(true); return; }
        if (action.kind === 'view') { setActive(action.view); return; }
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setUserPage(1);
        setSearchTerm(searchInput.trim());
    };

    const handleRoleFilter = (r: UserRole | '') => {
        setUserPage(1);
        setRoleFilter(r);
    };

    const handleRoleChange = async (userId: string, newRole: string) => {
        try {
            await adminUpdateRole(userId, newRole as UserRole);
            invalidateRoleClientCache(userId);
            await loadUsers(userPage, searchTerm, roleFilter);
            loadDashboard();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to update role');
        }
    };

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsAddingUser(true);
        setAddUserError(null);
        try {
            await adminCreateUser(newUserForm);
            setShowAddUser(false);
            setNewUserForm({ email: '', password: '', first_name: '', last_name: '', role: 'user' });
            await loadUsers(1, searchTerm, roleFilter);
            setUserPage(1);
            loadDashboard();
        } catch (err) {
            setAddUserError(err instanceof Error ? err.message : 'Failed to create user');
        } finally {
            setIsAddingUser(false);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        setDeleteLoading(true);
        try {
            await adminDeleteUser(deleteTarget.id);
            setDeleteTarget(null);
            await loadUsers(userPage, searchTerm, roleFilter);
            loadDashboard();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to delete user');
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleAddStar = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsAddingStar(true);
        try {
            await adminCreateStar(newStarForm);
            setShowAddStar(false);
            setNewStarForm({ name: '', category: 'Actor', image_url: '', rating: 5.0, reviews_count: 0, price: 100, is_featured: false, bio: '' });
            await loadStars();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to create star');
        } finally {
            setIsAddingStar(false);
        }
    };

    const handleDeleteStar = async (starId: string) => {
        if (!window.confirm('Delete this star permanently? This cannot be undone.')) return;
        try {
            await adminDeleteStar(starId);
            await loadStars();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to delete star');
        }
    };

    const handleLogout = async () => { await logout(); navigate('/'); openLogin(); };

    // ── Derived ──────────────────────────────────────────────────────────────
    const statCards = [
        { label: 'Total Users',     value: stats?.totalUsers,          icon: Users,         color: 'from-purple-500 to-purple-700', note: 'Platform total' },
        { label: 'Total Admins',    value: stats?.totalAdmins,         icon: ShieldCheck,    color: 'from-blue-500 to-blue-700',     note: 'Admins + super admins' },
        { label: 'Total Creators',  value: stats?.totalCreators,       icon: Video,          color: 'from-emerald-500 to-green-600', note: 'Verified + listed' },
        { label: 'Total Stars',     value: stats?.totalStars,          icon: FolderClosed,   color: 'from-orange-500 to-amber-600',  note: 'In catalogue' },
        { label: 'Feedback Items',  value: stats?.pendingFeedback,     icon: MessageSquare,  color: 'from-pink-500 to-rose-600',     note: 'Awaiting review' },
        { label: 'Pending Verifs',  value: stats?.pendingVerifications, icon: Monitor,       color: 'from-cyan-500 to-sky-600',      note: 'Badge requests' },
    ];

    const userInitial = user?.email?.charAt(0).toUpperCase() || 'S';

    // ── Reusable content panels (shared by standalone sections + Content Hub) ──
    const starsPanel = (
        <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d1230] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10 flex justify-between items-center">
                <h2 className="font-semibold text-lg">Stars Database</h2>
                <button onClick={() => setShowAddStar(true)} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium">
                    <Plus className="w-4 h-4" /> Add Star
                </button>
            </div>
            {starsLoading ? (
                <div className="p-12 text-center text-gray-500">Loading stars…</div>
            ) : starsError ? (
                <div className="p-6 text-red-500 text-sm">{starsError} <button onClick={loadStars} className="underline ml-2">Retry</button></div>
            ) : (
                <div className="overflow-auto max-h-[65vh] hscroll-shadow">
                    <table className="w-full text-left text-sm">
                        <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-[#161b38] text-gray-500 dark:text-gray-400">
                            <tr>
                                <th className="px-6 py-3 font-medium">Name</th>
                                <th className="px-6 py-3 font-medium hidden md:table-cell">Category</th>
                                <th className="px-6 py-3 font-medium">Price</th>
                                <th className="px-6 py-3 font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                            {stars.map((s) => (
                                <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition">
                                    <td className="px-6 py-3 font-medium">
                                        <div className="flex items-center gap-3">
                                            <img src={s.image_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                                            {s.name}
                                        </div>
                                    </td>
                                    <td className="px-6 py-3 hidden md:table-cell">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300">{s.category}</span>
                                    </td>
                                    <td className="px-6 py-3 text-gray-500">₹{Number(s.price).toLocaleString('en-IN')}</td>
                                    <td className="px-6 py-3">
                                        <button onClick={() => handleDeleteStar(s.id)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors" title="Delete Star">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {stars.length === 0 && (
                                <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-400">No stars yet.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );

    const applicationsPanel = (
        <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d1230] p-6">
            <PendingApplicationsPanel onStatusChange={loadDashboard} />
        </div>
    );

    const verificationPanel = (
        <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d1230] p-6">
            <CreatorVerificationPanel onStatusChange={loadDashboard} />
        </div>
    );

    return (
        <div className="min-h-screen flex bg-gray-50 dark:bg-dark-950 text-gray-900 dark:text-white">

            {/* ── Sidebar (desktop, fixed) ───────────────────────────── */}
            <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-gray-200 dark:border-white/10 bg-white dark:bg-[#0a0e24] fixed inset-y-0 left-0">
                <SuperAdminSidebarContent
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
                            <SuperAdminSidebarContent
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
                <header className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-white/10">
                    <button
                        onClick={() => setShowMobileNav(true)}
                        aria-label="Open menu"
                        className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 shrink-0"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                    {/* Public site links */}
                    <nav className="hidden md:flex items-center gap-6">
                        {PUBLIC_LINKS.map((link) => (
                            <button
                                key={link.label}
                                onClick={() => navigate(link.to)}
                                className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                            >
                                {link.label}
                            </button>
                        ))}
                    </nav>

                    {/* Right: search + theme + avatar */}
                    <div className="flex items-center gap-3">
                        <div className="relative hidden sm:block">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                placeholder="Search anything..."
                                className="w-64 pl-9 pr-4 py-2 text-sm rounded-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 outline-none focus:ring-2 focus:ring-purple-500/40"
                            />
                        </div>
                        <ThemeSwitcher />
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-semibold text-sm">
                            {userInitial}
                        </div>
                    </div>
                </header>

                <div className="p-6 lg:p-8 space-y-6">
                    {/* Title */}
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold">
                                {active === 'Dashboard' ? 'Super Admin Dashboard' : active}
                            </h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {active === 'Dashboard' ? "Welcome back! Here's what's happening on Clippixx." : ''}
                            </p>
                        </div>
                        <button
                            onClick={() => setShowAddUser(true)}
                            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl transition-colors text-sm font-medium shrink-0"
                        >
                            <Plus className="w-4 h-4" /> Add User
                        </button>
                    </div>

                    {/* ── DASHBOARD ───────────────────────────────────────── */}
                    {active === 'Dashboard' && (
                    <>
                        {error && (
                            <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 rounded-xl flex items-center justify-between">
                                <span>Failed to load stats: {error}</span>
                                <button onClick={loadDashboard} className="ml-4 text-sm underline hover:no-underline shrink-0">Retry</button>
                            </div>
                        )}

                        {/* Stat cards */}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
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
                                    <p className="mt-2 text-xs font-medium text-gray-400">{c.note}</p>
                                </div>
                            ))}
                        </div>

                        {/* Quick Actions */}
                        <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d1230] p-6">
                            <h2 className="text-lg font-semibold mb-5">Quick Actions</h2>
                            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
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
                            <Panel title="Recent Activity" action={<button onClick={() => setActive('Audit Logs')} className="text-sm text-purple-500 hover:text-purple-400">View all</button>}>
                                {loading ? (
                                    <SkeletonList />
                                ) : logs.length === 0 ? (
                                    <p className="text-sm text-gray-400 py-6 text-center">No recent activity.</p>
                                ) : (
                                    <div className="space-y-1">
                                        {logs.map((l) => (
                                            <div key={l.id} className="flex items-center gap-3 py-2.5">
                                                <div className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-500/15 flex items-center justify-center shrink-0">
                                                    <ScrollText className="w-4 h-4 text-purple-500" />
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

                            {/* System Overview — real metrics only */}
                            <Panel title="System Overview">
                                <div className="space-y-1">
                                    {SYSTEM_OVERVIEW.map((s) => (
                                        <div key={s.label} className="flex items-center gap-3 py-2.5">
                                            <s.icon className="w-4 h-4 text-gray-400 shrink-0" />
                                            <span className="flex-1 text-sm truncate">{s.label}</span>
                                            {loading ? (
                                                <div className="h-4 w-12 bg-gray-200 dark:bg-white/10 rounded animate-pulse" />
                                            ) : (
                                                <span className={`flex items-center gap-1 text-sm font-semibold ${s.up ? 'text-emerald-500' : 'text-orange-400'}`}>
                                                    {s.up ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                                                    {stats?.[s.key] ?? '—'}
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
                            <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-3">
                                <h2 className="font-semibold text-lg">Platform Users {usersPagination && <span className="text-sm font-normal text-gray-400">({usersPagination.total})</span>}</h2>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setShowCreateCreator(true)} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium">
                                        <Video className="w-4 h-4" /> Create Creator
                                    </button>
                                    <button onClick={() => setShowAddUser(true)} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium">
                                        <Plus className="w-4 h-4" /> Add User
                                    </button>
                                </div>
                            </div>

                            {/* Filters */}
                            <div className="px-6 py-3 border-b border-gray-100 dark:border-white/5 flex flex-wrap items-center gap-3">
                                <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-[200px]">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        value={searchInput}
                                        onChange={(e) => setSearchInput(e.target.value)}
                                        placeholder="Search users by name or email…"
                                        className="w-full pl-9 pr-4 py-2 text-sm rounded-lg bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 outline-none focus:ring-2 focus:ring-purple-500/40"
                                    />
                                </form>
                                <select
                                    value={roleFilter}
                                    onChange={(e) => handleRoleFilter(e.target.value as UserRole | '')}
                                    className="rounded-lg border border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-white/5 text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500/40"
                                >
                                    <option value="">All Roles</option>
                                    <option value="user">User</option>
                                    <option value="admin">Admin</option>
                                    <option value="super_admin">Super Admin</option>
                                </select>
                            </div>

                            {usersLoading ? (
                                <div className="p-12 text-center text-gray-500">Loading users…</div>
                            ) : usersError ? (
                                <div className="p-6 text-red-500 text-sm">{usersError} <button onClick={() => loadUsers(userPage, searchTerm, roleFilter)} className="underline ml-2">Retry</button></div>
                            ) : (
                                <div className="overflow-auto max-h-[65vh] hscroll-shadow">
                                    <table className="w-full text-left text-sm">
                                        <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-[#161b38] text-gray-500 dark:text-gray-400">
                                            <tr>
                                                <th className="px-6 py-3 font-medium">User</th>
                                                <th className="px-6 py-3 font-medium hidden md:table-cell">Email</th>
                                                <th className="px-6 py-3 font-medium">Role</th>
                                                <th className="px-6 py-3 font-medium hidden md:table-cell">Joined On</th>
                                                <th className="px-6 py-3 font-medium">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                            {users.map((u) => (
                                                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition">
                                                    <td className="px-6 py-3">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                                                                {(u.first_name?.[0] || u.email[0] || 'U').toUpperCase()}
                                                            </div>
                                                            <span className="font-medium">{u.first_name} {u.last_name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-3 text-gray-500 hidden md:table-cell">{u.email}</td>
                                                    <td className="px-6 py-3">
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[u.role] ?? ROLE_BADGE.user}`}>{u.role}</span>
                                                    </td>
                                                    <td className="px-6 py-3 text-gray-400 hidden md:table-cell">{new Date(u.created_at).toLocaleDateString()}</td>
                                                    <td className="px-6 py-3">
                                                        <div className="flex items-center gap-1.5">
                                                            <select
                                                                value={u.role}
                                                                onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                                                className="bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded-lg p-1.5 dark:bg-dark-700 dark:border-dark-600 dark:text-white outline-none focus:ring-2 focus:ring-purple-500/40"
                                                                title="Edit Role"
                                                            >
                                                                <option value="user">User</option>
                                                                <option value="admin">Admin</option>
                                                                <option value="super_admin">Super Admin</option>
                                                            </select>
                                                            <button
                                                                onClick={() => setResetTarget({ id: u.id, label: `${u.first_name} ${u.last_name}`.trim() || u.email })}
                                                                className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                                                                title="Reset Password"
                                                            >
                                                                <KeyRound className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => setDeleteTarget(u)}
                                                                className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                                                                title="Delete User"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {users.length === 0 && (
                                                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">No users found.</td></tr>
                                            )}
                                        </tbody>
                                    </table>

                                    {/* Pagination */}
                                    {usersPagination && usersPagination.totalPages > 1 && (
                                        <div className="flex items-center justify-between gap-3 p-4 border-t border-gray-100 dark:border-white/5">
                                            <span className="text-sm text-gray-500">
                                                Page {usersPagination.page} of {usersPagination.totalPages}
                                            </span>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                                                    disabled={userPage === 1}
                                                    className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 disabled:opacity-40 text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition"
                                                >Previous</button>
                                                <button
                                                    onClick={() => setUserPage((p) => Math.min(usersPagination.totalPages, p + 1))}
                                                    disabled={userPage >= usersPagination.totalPages}
                                                    className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 disabled:opacity-40 text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition"
                                                >Next</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── STARS (standalone, via Quick Actions) ───────────── */}
                    {active === 'Stars' && starsPanel}

                    {/* ── FEEDBACK ────────────────────────────────────────── */}
                    {active === 'Feedback' && (
                        <ComingSoon icon={MessageSquare} title="Feedback" description="Use the Admin dashboard's Feedback section to review submissions. A consolidated super-admin view is in development." />
                    )}

                    {/* ── CONTENT HUB — persistent tabs + active panel ────── */}
                    {active === 'Content' && (
                        <div className="space-y-6">
                            {/* Tabs always render, regardless of which sub-view is active */}
                            <div className="flex flex-wrap gap-2">
                                {([
                                    { key: 'stars',        label: 'Manage Stars' },
                                    { key: 'applications', label: 'Creator Applications' },
                                    { key: 'verification', label: 'Verification Requests' },
                                ] as const).map((t) => (
                                    <button
                                        key={t.key}
                                        onClick={() => setContentTab(t.key)}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                                            contentTab === t.key
                                                ? 'bg-purple-600 text-white'
                                                : 'bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/15'
                                        }`}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>

                            {/* Only this part changes based on the selected tab */}
                            {contentTab === 'stars'        && starsPanel}
                            {contentTab === 'applications' && applicationsPanel}
                            {contentTab === 'verification' && verificationPanel}
                        </div>
                    )}

                    {/* ── CREATOR APPLICATIONS (standalone) ───────────────── */}
                    {active === 'Creator Applications' && applicationsPanel}

                    {/* ── VERIFICATION REQUESTS (standalone) ──────────────── */}
                    {active === 'Verification Requests' && verificationPanel}

                    {/* ── AUDIT LOGS ──────────────────────────────────────── */}
                    {active === 'Audit Logs' && (
                        <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d1230] overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10">
                                <h2 className="font-semibold text-lg">Audit Log</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">All privileged actions performed by admins.</p>
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
                                                            <button
                                                                onClick={() => openAuditEdit(log)}
                                                                className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"
                                                                title="Edit entry"
                                                            >
                                                                <Pencil className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => setAuditDeleteTarget(log)}
                                                                className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                                                                title="Delete entry"
                                                            >
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

                    {/* ── COMING SOON sections ────────────────────────────── */}
                    {active === 'Organizations' && (
                        <ComingSoon icon={Building2} title="Organizations" description="Organization management is in development. This will let you create and manage teams across the platform." />
                    )}
                    {active === 'Analytics' && (
                        <ComingSoon icon={BarChart3} title="Analytics" description="Platform analytics and reporting dashboards are in development." />
                    )}
                    {active === 'Platform Settings' && (
                        <ComingSoon icon={Settings} title="Platform Settings" description="Global configuration options will be available here." />
                    )}
                    {active === 'Security' && (
                        <ComingSoon icon={ShieldCheck} title="Security" description="Security controls (sessions, 2FA enforcement, access policies) are in development." />
                    )}
                </div>

                {/* ── ADD USER MODAL ────────────────────────── */}
                {showAddUser && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl w-full max-w-md relative">
                            <button onClick={() => setShowAddUser(false)} className="absolute top-4 right-4 text-gray-500 hover:text-gray-900 dark:hover:text-white"><X className="w-5 h-5" /></button>
                            <div className="p-6 border-b border-gray-100 dark:border-dark-700"><h3 className="text-xl font-bold">Add New User</h3></div>
                            <form onSubmit={handleAddUser} className="p-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First Name</label>
                                        <input required type="text" value={newUserForm.first_name} onChange={(e) => setNewUserForm({ ...newUserForm, first_name: e.target.value })} className="w-full rounded-lg border border-gray-300 dark:border-dark-600 p-2 text-sm dark:bg-dark-700" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Name</label>
                                        <input type="text" value={newUserForm.last_name} onChange={(e) => setNewUserForm({ ...newUserForm, last_name: e.target.value })} className="w-full rounded-lg border border-gray-300 dark:border-dark-600 p-2 text-sm dark:bg-dark-700" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                                    <input required type="email" value={newUserForm.email} onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })} className="w-full rounded-lg border border-gray-300 dark:border-dark-600 p-2 text-sm dark:bg-dark-700" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Temporary Password</label>
                                    <input required minLength={8} type="password" value={newUserForm.password} onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })} className="w-full rounded-lg border border-gray-300 dark:border-dark-600 p-2 text-sm dark:bg-dark-700" />
                                    <p className="text-xs text-gray-500 mt-1">Must be at least 8 characters</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
                                    <select value={newUserForm.role} onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value as UserRole })} className="w-full rounded-lg border border-gray-300 dark:border-dark-600 p-2 text-sm dark:bg-dark-700">
                                        <option value="user">User</option>
                                        <option value="admin">Admin</option>
                                        <option value="super_admin">Super Admin</option>
                                    </select>
                                </div>
                                {addUserError && <p className="text-sm text-red-500">{addUserError}</p>}
                                <div className="flex justify-end gap-3 pt-2">
                                    <button type="button" onClick={() => setShowAddUser(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition dark:text-gray-300 dark:hover:bg-dark-700">Cancel</button>
                                    <button type="submit" disabled={isAddingUser} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition">{isAddingUser ? 'Creating…' : 'Create User'}</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* ── CREATE CREATOR MODAL ──────────────────── */}
                {showCreateCreator && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl w-full max-w-lg relative max-h-[90vh] overflow-y-auto">
                            <button onClick={() => setShowCreateCreator(false)} className="absolute top-4 right-4 text-gray-500 hover:text-gray-900 dark:hover:text-white"><X className="w-5 h-5" /></button>
                            <div className="p-6 border-b border-gray-100 dark:border-dark-700">
                                <h3 className="text-xl font-bold">Create Creator</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Username + password only — no email needed.</p>
                            </div>
                            <div className="p-6">
                                <CreateCreatorForm onCreated={() => { loadDashboard(); if (active === 'Users') loadUsers(userPage, searchTerm, roleFilter); }} />
                            </div>
                        </div>
                    </div>
                )}

                {/* ── RESET PASSWORD MODAL ──────────────────── */}
                {resetTarget && (
                    <ResetPasswordModal userId={resetTarget.id} label={resetTarget.label} onClose={() => setResetTarget(null)} />
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
                                <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition dark:text-gray-300 dark:hover:bg-dark-700">Cancel</button>
                                <button onClick={handleDeleteConfirm} disabled={deleteLoading} className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition">{deleteLoading ? 'Deleting…' : 'Delete'}</button>
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

                {/* ── ADD STAR MODAL ────────────────────────── */}
                {showAddStar && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl w-full max-w-lg relative max-h-[90vh] overflow-y-auto">
                            <button onClick={() => setShowAddStar(false)} className="absolute top-4 right-4 text-gray-500 hover:text-gray-900 dark:hover:text-white"><X className="w-5 h-5" /></button>
                            <div className="p-6 border-b border-gray-100 dark:border-dark-700"><h3 className="text-xl font-bold">Add New Star</h3></div>
                            <form onSubmit={handleAddStar} className="p-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Star Name</label>
                                        <input required type="text" value={newStarForm.name} onChange={(e) => setNewStarForm({ ...newStarForm, name: e.target.value })} className="w-full rounded-lg border border-gray-300 dark:border-dark-600 p-2 text-sm dark:bg-dark-700" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                                        <select required value={newStarForm.category} onChange={(e) => setNewStarForm({ ...newStarForm, category: e.target.value })} className="w-full rounded-lg border border-gray-300 dark:border-dark-600 p-2 text-sm dark:bg-dark-700">
                                            <option value="Actor">Actor</option>
                                            <option value="Athlete">Athlete</option>
                                            <option value="Creator">Creator</option>
                                            <option value="Musician">Musician</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Image URL</label>
                                    <input required type="url" value={newStarForm.image_url} onChange={(e) => setNewStarForm({ ...newStarForm, image_url: e.target.value })} placeholder="https://..." className="w-full rounded-lg border border-gray-300 dark:border-dark-600 p-2 text-sm dark:bg-dark-700" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Price ($)</label>
                                        <input required type="number" min="1" value={newStarForm.price} onChange={(e) => setNewStarForm({ ...newStarForm, price: Number(e.target.value) })} className="w-full rounded-lg border border-gray-300 dark:border-dark-600 p-2 text-sm dark:bg-dark-700" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Initial Rating</label>
                                        <input type="number" step="0.1" min="0" max="5" value={newStarForm.rating} onChange={(e) => setNewStarForm({ ...newStarForm, rating: Number(e.target.value) })} className="w-full rounded-lg border border-gray-300 dark:border-dark-600 p-2 text-sm dark:bg-dark-700" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Biography</label>
                                    <textarea rows={3} value={newStarForm.bio} onChange={(e) => setNewStarForm({ ...newStarForm, bio: e.target.value })} className="w-full rounded-lg border border-gray-300 dark:border-dark-600 p-2 text-sm dark:bg-dark-700" />
                                </div>
                                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                                    <input type="checkbox" checked={newStarForm.is_featured} onChange={(e) => setNewStarForm({ ...newStarForm, is_featured: e.target.checked })} className="rounded text-purple-600" />
                                    Feature on homepage
                                </label>
                                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-dark-700">
                                    <button type="button" onClick={() => setShowAddStar(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition dark:text-gray-300 dark:hover:bg-dark-700">Cancel</button>
                                    <button type="submit" disabled={isAddingStar} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition">{isAddingStar ? 'Adding…' : 'Add Star'}</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

// ─── Sidebar (shared by desktop-fixed and mobile-drawer renders) ────────────

function SuperAdminSidebarContent({
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
                    <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300">Super Admin</span>
                </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
                {NAV_ITEMS.map((item) => {
                    const isActive = active === item.label;
                    return (
                        <button
                            key={item.label}
                            onClick={() => setActive(item.label)}
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
                <button onClick={() => setActive('Platform Settings')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
                    <Settings className="w-4 h-4" /> Platform Settings
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

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d1230] p-6 flex flex-col">
            <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">{title}</h3>
                {action}
            </div>
            <div className="flex-1">{children}</div>
        </div>
    );
}

function ComingSoon({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
    return (
        <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d1230] p-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-purple-100 dark:bg-purple-500/15 flex items-center justify-center mx-auto mb-4">
                <Icon className="w-8 h-8 text-purple-500" />
            </div>
            <h3 className="text-xl font-bold mb-2">{title}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">{description}</p>
        </div>
    );
}

function SkeletonList() {
    return (
        <div className="space-y-3 py-2">
            {Array.from({ length: 5 }).map((_, i) => (
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
