import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navigation from "@/layouts/Navigation";
import Footer from "@/layouts/Footer";
import ErrorBoundary from "@/components/ErrorBoundary";

function PageLoader() {
  return (
    <div className="min-h-[400px] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function MainLayout() {
  const location = useLocation();
  return (
    <div className="min-h-screen text-gray-900 dark:text-white overflow-x-hidden relative">
      <Navigation />
      {/* key by pathname so a crashed route resets its error state on navigation
          instead of staying stuck on a stale fallback after the URL changes. */}
      <ErrorBoundary key={location.pathname}>
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </ErrorBoundary>
      <Footer />
    </div>
  );
}
