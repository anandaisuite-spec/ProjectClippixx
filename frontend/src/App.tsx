import React, { lazy, Suspense, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { FolderClosed, Workflow, Bell, HelpCircle } from 'lucide-react';
import { ThemeProvider } from "@/providers/ThemeProvider";
import ModalProvider from "@/providers/ModalProvider";
import MainLayout from "@/layouts/MainLayout";
import HomePage from "@/pages/HomePage";
import ProtectedRoute from "@/guards/ProtectedRoute";
import RoleProtectedRoute from "@/guards/RoleProtectedRoute";
import UserRoute from "@/guards/UserRoute";
import OnboardingGate from "@/guards/OnboardingGate";
import ErrorBoundary from "@/components/ErrorBoundary";
import TurnstileGate, { isSessionVerified } from "@/components/TurnstileGate";

const AdminDashboard = lazy(() => import("@/features/admin/AdminDashboard"));
const SuperAdminDashboard = lazy(() => import("@/features/superadmin/SuperAdminDashboard"));
const Browse = lazy(() => import("@/pages/Browse"));
const CreatorsPage = lazy(() => import("@/pages/CreatorsPage"));
const CreatorDetailPage = lazy(() => import("@/pages/CreatorDetailPage"));
const ForBusinessPage = lazy(() => import("@/pages/ForBusinessPage"));
const CreatorPage = lazy(() => import("@/pages/CreatorPage"));
const SuggestStarPage = lazy(() => import("@/pages/SuggestStarPage"));
const FeedbackPage = lazy(() => import("@/pages/FeedbackPage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const UserProfilePage = lazy(() => import("@/pages/UserProfilePage"));
const FanDashboard = lazy(() => import("@/pages/fan/FanDashboard"));
const CreatorDashboardPage = lazy(() => import("@/pages/creator/CreatorDashboard"));
const CreatorOnboarding = lazy(() => import("@/pages/creator/CreatorOnboarding"));
const FanBookingPage = lazy(() => import("@/pages/fan/FanBookingPage"));
const BookFlow = lazy(() => import("@/pages/fan/BookFlow"));
const Explore = lazy(() => import("@/pages/Explore"));
const TermsPage = lazy(() => import("@/pages/policy/TermsPage"));
const PrivacyPage = lazy(() => import("@/pages/policy/PrivacyPage"));
const RefundPage = lazy(() => import("@/pages/policy/RefundPage"));
const MyOrdersPage = lazy(() => import("@/pages/MyOrdersPage"));
const AccountSettings = lazy(() => import("@/pages/AccountSettings"));
const ComingSoon = lazy(() => import("@/pages/ComingSoon"));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"));

function SectionLoader() {
  return (
    <div className="min-h-[400px] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<SectionLoader />}>{children}</Suspense>
    </ErrorBoundary>
  );
}

export default function App() {
  // Full-screen Cloudflare Turnstile gate — shown once per browser session
  // (sessionStorage), before any part of the site is accessible.
  const [verified, setVerified] = useState(() => isSessionVerified());

  if (!verified) {
    return (
      <ThemeProvider>
        <TurnstileGate onVerified={() => setVerified(true)} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <ModalProvider>
        <OnboardingGate />
        <Routes>
          <Route element={<MainLayout />}>
            {/* Public routes */}
            <Route index element={<HomePage />} />
            <Route path="explore" element={<Wrap><Explore /></Wrap>} />
            <Route path="terms" element={<Wrap><TermsPage /></Wrap>} />
            <Route path="privacy" element={<Wrap><PrivacyPage /></Wrap>} />
            <Route path="refunds" element={<Wrap><RefundPage /></Wrap>} />
            <Route path="browse" element={<Wrap><Browse /></Wrap>} />
            <Route path="creators" element={<Wrap><CreatorsPage /></Wrap>} />
            <Route path="creator/:id" element={<Wrap><CreatorDetailPage /></Wrap>} />
            <Route path="for-business" element={<Wrap><ForBusinessPage /></Wrap>} />
            <Route path="suggeststars" element={<Wrap><SuggestStarPage /></Wrap>} />
            <Route path="feedback" element={<Wrap><FeedbackPage /></Wrap>} />
            <Route path="profile/:userId" element={<Wrap><ProfilePage /></Wrap>} />
            <Route path="creator" element={<Wrap><CreatorPage /></Wrap>} />

            {/* Auth required — any authenticated user */}
            <Route element={<ProtectedRoute />}>
              <Route path="my-profile" element={<Wrap><UserProfilePage /></Wrap>} />
              <Route path="fan/bookings/:bookingId" element={<Wrap><FanBookingPage /></Wrap>} />
              <Route path="book/:creatorId" element={<Wrap><BookFlow /></Wrap>} />
              <Route path="my-orders" element={<Wrap><MyOrdersPage /></Wrap>} />
              <Route path="settings" element={<Wrap><AccountSettings /></Wrap>} />
              <Route path="collections" element={<Wrap><ComingSoon title="My Collections" description="Save and organise your favourite stars and videos in one place." icon={FolderClosed} /></Wrap>} />
              <Route path="workflows" element={<Wrap><ComingSoon title="My Workflows" description="Build and manage your custom booking workflows." icon={Workflow} /></Wrap>} />
              <Route path="notifications" element={<Wrap><ComingSoon title="Notifications" description="Your alerts and updates will appear here." icon={Bell} /></Wrap>} />
              <Route path="help" element={<Wrap><ComingSoon title="Help & Support" description="Find answers or get in touch with our team." icon={HelpCircle} /></Wrap>} />
            </Route>

            {/* role === 'user' ONLY */}
            <Route element={<UserRoute />}>
              <Route path="dashboard" element={<Wrap><FanDashboard /></Wrap>} />
            </Route>
          </Route>

          {/* Dashboards — full-screen, no global navbar */}

          {/* Creator onboarding + dashboard — full-screen, auth required.
              The dashboard has its own sidebar/topbar app shell, so it lives
              outside MainLayout (no global navbar/footer). */}
          <Route element={<ProtectedRoute />}>
            <Route path="creator/onboarding" element={<Wrap><CreatorOnboarding /></Wrap>} />
            <Route path="creator-dashboard" element={<Wrap><CreatorDashboardPage /></Wrap>} />
          </Route>

          {/* role === 'admin' ONLY */}
          <Route element={<RoleProtectedRoute allowedRole="admin" />}>
            <Route path="admin" element={<Wrap><AdminDashboard /></Wrap>} />
          </Route>

          {/* role === 'super_admin' ONLY */}
          <Route element={<RoleProtectedRoute allowedRole="super_admin" />}>
            <Route path="superadmin" element={<Wrap><SuperAdminDashboard /></Wrap>} />
          </Route>

          {/* 404 — full-screen, no global navbar */}
          <Route path="404" element={<Wrap><NotFoundPage /></Wrap>} />
          <Route path="*" element={<Wrap><NotFoundPage /></Wrap>} />
        </Routes>
      </ModalProvider>
    </ThemeProvider>
  );
}
