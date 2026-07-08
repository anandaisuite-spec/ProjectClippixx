import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Search, LogOut, User, ShieldCheck, Shield, FolderClosed, Workflow, Bell, Settings, HelpCircle, ArrowRight, LayoutDashboard, Users, Building2, MessageSquare, Video, Package, ChevronDown } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import Button from '@/components/ui/Button';
import ThemeSwitcher from '@/components/ui/ThemeSwitcher';
import { useAuth } from "@/providers/AuthProvider";
import { useRole } from "@/hooks/useRole";
import { useMyProfile } from "@/hooks/useMyProfile";
import { useModals } from "@/providers/ModalProvider";
import type { UserRole } from "@/services/api";

// Categories mega-menu. Each routes to /explore?category=<slug> (lowercase,
// hyphenated). Displayed as a 2-column × 5-row grid in the dropdown panel.
const CATEGORIES = [
  'Influencer',
  'YouTuber',
  'Actor',
  'Comedian',
  'Singer',
  'Gamer',
  'Athlete',
  'Fitness Coach',
  'Educator',
  'Entrepreneur',
] as const;

const categorySlug = (name: string) => name.toLowerCase().replace(/\s+/g, '-');

// Role-specific menu items — one entry per role, no overlap.
// Regular users get no extra dashboard entry (just My Profile + Sign Out).
const ROLE_MENU: Record<UserRole, { label: string; path: string; icon: React.ElementType } | null> = {
  user:        null,
  admin:       { label: 'Admin Dashboard',      path: '/admin',       icon: ShieldCheck },
  super_admin: { label: 'Super Admin Dashboard', path: '/superadmin', icon: Shield },
};

// Base menu shown to all regular users (fan + creator).
const ACCOUNT_MENU_BASE = [
  { label: 'My Profile',     path: '/my-profile', icon: User },
  { label: 'My Orders',      path: '/my-orders',  icon: Package },
  { label: 'My Collections', path: '/collections', icon: FolderClosed },
  { label: 'My Workflows',   path: '/workflows',   icon: Workflow },
  { label: 'Notifications',  path: '/notifications', icon: Bell },
];

// Extra entry injected after "My Orders" for creators only.
const CREATOR_DASHBOARD_ITEM = { label: 'Creator Dashboard', path: '/creator-dashboard', icon: Video };

// Secondary group for regular users (settings / support)
const SETTINGS_MENU = [
  { label: 'Account Settings', path: '/settings', icon: Settings },
  { label: 'Help & Support',   path: '/help',     icon: HelpCircle },
];

// Admin dropdown — admin-focused shortcuts. Sub-sections live inside the
// dashboard sidebar, so they route to /admin for now.
const ADMIN_MENU = [
  { label: 'My Profile',    path: '/my-profile', icon: User },
  { label: 'Dashboard',     path: '/admin',      icon: LayoutDashboard },
  { label: 'Users',         path: '/admin',      icon: Users },
  { label: 'Organizations', path: '/admin',      icon: Building2 },
  { label: 'Feedback',      path: '/admin',      icon: MessageSquare },
  { label: 'Settings',      path: '/settings',   icon: Settings },
];

export default function Navigation() {
  const { user, logout } = useAuth();
  const { role, accountType } = useRole();
  const { openSignup, openSearch, openLogin } = useModals();
  const navigate = useNavigate();
  const location = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const categoriesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setShowUserMenu(false);
    setShowCategories(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
      if (categoriesRef.current && !categoriesRef.current.contains(e.target as Node)) {
        setShowCategories(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setShowUserMenu(false);
    await logout();
    navigate('/');
    openLogin();
  };

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate('/');
  };

  const goToCategory = (name: string) => {
    setShowCategories(false);
    setIsMobileMenuOpen(false);
    navigate(`/explore?category=${categorySlug(name)}`);
  };

  // The single dashboard entry for the current role
  const dashboardItem = user ? ROLE_MENU[role] : null;
  const userInitial = user?.email?.charAt(0).toUpperCase() || 'U';
  // Shared profile cache — updates live when the avatar is uploaded elsewhere.
  const myProfile = useMyProfile();
  const avatarUrl = myProfile?.avatar_url || null;

  // Admins/super_admins get the admin dropdown; regular users get the standard one.
  const isStaff = role === 'admin' || role === 'super_admin';

  // For regular users, inject Creator Dashboard between My Orders and My Collections
  // only when the user is actually a creator. A creator's "My Orders" opens the
  // creator dashboard's Orders section (incoming bookings), not the fan
  // purchases page — fans keep /my-orders.
  const regularMenu = accountType === 'creator'
    ? [
        ACCOUNT_MENU_BASE[0], // My Profile
        { ...ACCOUNT_MENU_BASE[1], path: '/creator-dashboard?tab=orders' }, // My Orders → dashboard Orders
        CREATOR_DASHBOARD_ITEM,
        ...ACCOUNT_MENU_BASE.slice(2), // My Collections, Workflows, Notifications
      ]
    : ACCOUNT_MENU_BASE;

  const accountMenu = isStaff ? ADMIN_MENU : regularMenu;
  const settingsMenu = isStaff ? [] : SETTINGS_MENU;
  // Admins already have a Dashboard entry in ADMIN_MENU, so don't duplicate it.
  const showDashboardItem = !isStaff && dashboardItem;

  return (
    <>
      <div className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-500 ${isScrolled ? 'py-3' : 'py-4'}`}>
        <div className="mx-4 lg:mx-6">
          <motion.nav
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className={`transition-all duration-500 rounded-full px-6 py-3 ${isScrolled
              ? 'bg-white/40 dark:bg-white/15 backdrop-blur-2xl border border-black/5 dark:border-white/20 shadow-lg shadow-black/5 dark:shadow-black/30'
              : 'bg-transparent border border-transparent'
            }`}
          >
            <div className="flex items-center justify-between">
              <motion.a
                href="/"
                onClick={handleLogoClick}
                className="flex items-center gap-2"
                whileHover={{ scale: 1.02 }}
              >
                {/* Icon logo — dark icon on light bg, light icon on dark bg. */}
                <img src="/logo-dark.png" alt="Clippixx" className="h-8 w-auto block dark:hidden" />
                <img src="/logo-light.png" alt="Clippixx" className="h-8 w-auto hidden dark:block" />

                {/* Text logo — dark text on light bg, light text on dark bg. */}
                <img src="/clippixx-dark.png" alt="Clippixx" className="h-8 w-auto block dark:hidden" />
                <img src="/clippixx-light.png" alt="Clippixx" className="h-8 w-auto hidden dark:block" />
              </motion.a>

              <div className="hidden lg:flex items-center gap-10">
                {/* Categories mega-menu */}
                <div className="relative" ref={categoriesRef}>
                  <button
                    onClick={() => setShowCategories((v) => !v)}
                    className="flex items-center gap-1 text-gray-700 dark:text-white/80 hover:text-gray-900 dark:hover:text-white transition-colors text-sm font-medium"
                    aria-expanded={showCategories}
                    aria-haspopup="true"
                  >
                    Categories
                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showCategories ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {showCategories && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.97 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-0 mt-3 w-[420px] rounded-2xl bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 shadow-2xl shadow-black/10 dark:shadow-black/40 overflow-hidden"
                      >
                        <div className="grid grid-cols-2 gap-1 p-3">
                          {CATEGORIES.map((name) => (
                            <button
                              key={name}
                              onClick={() => goToCategory(name)}
                              className="text-left px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-white/80 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white transition-colors"
                            >
                              {name}
                            </button>
                          ))}
                        </div>
                        <div className="flex justify-end px-4 py-3 border-t border-gray-100 dark:border-white/10">
                          <button
                            onClick={() => { setShowCategories(false); navigate('/explore'); }}
                            className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 dark:text-primary-400 hover:gap-2 transition-all"
                          >
                            View all <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <motion.a
                  href="/for-business"
                  onClick={(e) => { e.preventDefault(); navigate('/for-business'); }}
                  className="text-gray-700 dark:text-white/80 hover:text-gray-900 dark:hover:text-white transition-colors text-sm font-medium"
                  whileHover={{ scale: 1.05 }}
                >
                  For Business
                </motion.a>
                <motion.a
                  href="/creator"
                  onClick={(e) => { e.preventDefault(); navigate('/creator'); }}
                  className="text-gray-700 dark:text-white/80 hover:text-gray-900 dark:hover:text-white transition-colors text-sm font-medium"
                  whileHover={{ scale: 1.05 }}
                >
                  Join as Creator
                </motion.a>
              </div>

              <div className="hidden lg:flex items-center gap-3">
                <button
                  onClick={openSearch}
                  className="relative flex items-center w-28 pl-9 pr-4 py-2 text-sm rounded-full bg-gray-100 dark:bg-white/10 border border-gray-200 dark:border-white/20 text-gray-500 dark:text-white/50 hover:bg-gray-200 dark:hover:bg-white/20 transition-all cursor-pointer"
                >
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" />
                  <span className="text-xs">Search</span>
                </button>
                <ThemeSwitcher />

                {user ? (
                  <div className="relative" ref={userMenuRef}>
                    <button
                      onClick={() => setShowUserMenu(!showUserMenu)}
                      className="w-9 h-9 rounded-full overflow-hidden bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-semibold text-sm hover:shadow-lg hover:shadow-primary-500/30 transition-all"
                    >
                      {avatarUrl
                        ? <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                        : userInitial}
                    </button>
                    <AnimatePresence>
                      {showUserMenu && (
                        <motion.div
                          initial={{ opacity: 0, y: 8, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 8, scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                          className="absolute right-0 mt-2 w-72 rounded-2xl bg-white dark:bg-dark-900 border border-gray-200 dark:border-white/10 shadow-xl overflow-hidden"
                        >
                          {/* Header: avatar + name + email */}
                          <div className="px-4 py-4 border-b border-gray-100 dark:border-white/5">
                            <div className="flex items-center gap-3">
                              <div className="w-11 h-11 rounded-full overflow-hidden bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-semibold">
                                {avatarUrl
                                  ? <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                                  : userInitial}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                  {user.displayName || user.email?.split('@')[0]}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                              </div>
                            </div>
                          </div>

                          {/* Primary account items */}
                          <div className="py-1">
                            {accountMenu.map((item) => (
                              <button
                                key={item.label}
                                onClick={() => { setShowUserMenu(false); navigate(item.path); }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                              >
                                <item.icon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                                {item.label}
                              </button>
                            ))}

                            {/* Role-specific dashboard — regular users redirected here are
                                handled elsewhere; admins have Dashboard in their menu already */}
                            {showDashboardItem && dashboardItem && (
                              <button
                                onClick={() => { setShowUserMenu(false); navigate(dashboardItem.path); }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                              >
                                <dashboardItem.icon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                                {dashboardItem.label}
                              </button>
                            )}
                          </div>

                          {/* Settings / support (regular users only) */}
                          {settingsMenu.length > 0 && (
                            <div className="py-1 border-t border-gray-100 dark:border-white/5">
                              {settingsMenu.map((item) => (
                                <button
                                  key={item.label}
                                  onClick={() => { setShowUserMenu(false); navigate(item.path); }}
                                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                                >
                                  <item.icon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                                  {item.label}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Sign out */}
                          <div className="py-1 border-t border-gray-100 dark:border-white/5">
                            <button
                              onClick={handleLogout}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                            >
                              <LogOut className="w-4 h-4" />
                              Sign Out
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <Button size="sm" onClick={openSignup}>
                    Find a Star
                  </Button>
                )}
              </div>

              <div className="flex lg:hidden items-center gap-2">
                <button
                  className="text-gray-900 dark:text-white"
                  onClick={() => setIsMobileMenuOpen(true)}
                  aria-label="Open menu"
                >
                  <Menu className="w-6 h-6" />
                </button>
              </div>
            </div>
          </motion.nav>
        </div>
      </div>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] lg:hidden"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-dark-950/95 backdrop-blur-xl"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute right-0 top-0 bottom-0 w-80 bg-dark-900 p-8"
            >
              <div className="flex justify-between items-center mb-12">
                {/* Mobile drawer is always dark (bg-dark-900) → always the light (white) logo. */}
                <a href="/" onClick={(e) => { e.preventDefault(); setIsMobileMenuOpen(false); navigate('/'); }}>
                  <img src="/logo-light.png" alt="Clippixx" className="h-8 w-auto" />
                </a>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-white/60 hover:text-white"
                  aria-label="Close menu"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="flex flex-col gap-6">
                {/* Categories — collapsible list on mobile */}
                <div>
                  <button
                    onClick={() => setShowCategories((v) => !v)}
                    className="flex items-center gap-1 text-lg text-white/80 hover:text-white transition-colors"
                    aria-expanded={showCategories}
                  >
                    Categories
                    <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${showCategories ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {showCategories && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="grid grid-cols-2 gap-1 mt-3 pl-1">
                          {CATEGORIES.map((name) => (
                            <button
                              key={name}
                              onClick={() => goToCategory(name)}
                              className="text-left px-3 py-2 rounded-lg text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                            >
                              {name}
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() => { setShowCategories(false); setIsMobileMenuOpen(false); navigate('/explore'); }}
                          className="mt-3 ml-1 inline-flex items-center gap-1 text-sm font-medium text-primary-400 hover:gap-2 transition-all"
                        >
                          View all <ArrowRight className="w-4 h-4" />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <motion.a
                  href="/for-business"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-lg text-white/80 hover:text-white transition-colors"
                  onClick={(e) => { e.preventDefault(); setIsMobileMenuOpen(false); navigate('/for-business'); }}
                >
                  For Business
                </motion.a>
                <motion.a
                  href="/creator"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-lg text-white/80 hover:text-white transition-colors"
                  onClick={(e) => { e.preventDefault(); setIsMobileMenuOpen(false); navigate('/creator'); }}
                >
                  Join as Creator
                </motion.a>
                <div className="pt-6 border-t border-gray-200 dark:border-white/10 space-y-3 flex flex-col items-center">
                  <div className="mb-2">
                    <ThemeSwitcher />
                  </div>
                  {user ? (
                    <>
                      <div className="w-full text-center mb-2">
                        <p className="text-sm text-white/60 truncate">{user.email}</p>
                      </div>
                      {accountMenu.map((item) => (
                        <Button
                          key={item.label}
                          variant="outline"
                          className="w-full mb-2"
                          onClick={() => { setIsMobileMenuOpen(false); navigate(item.path); }}
                        >
                          {item.label}
                        </Button>
                      ))}
                      {showDashboardItem && dashboardItem && (
                        <Button
                          variant="outline"
                          className="w-full mb-2"
                          onClick={() => { setIsMobileMenuOpen(false); navigate(dashboardItem.path); }}
                        >
                          {dashboardItem.label}
                        </Button>
                      )}
                      {settingsMenu.map((item) => (
                        <Button
                          key={item.label}
                          variant="outline"
                          className="w-full mb-2"
                          onClick={() => { setIsMobileMenuOpen(false); navigate(item.path); }}
                        >
                          {item.label}
                        </Button>
                      ))}
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => { setIsMobileMenuOpen(false); handleLogout(); }}
                      >
                        Sign Out
                      </Button>
                    </>
                  ) : (
                    <Button
                      className="w-full"
                      onClick={() => { setIsMobileMenuOpen(false); openSignup(); }}
                    >
                      Find a Star
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
