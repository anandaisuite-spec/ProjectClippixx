import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from "@/providers/AuthProvider";

/**
 * ProtectedRoute
 *
 * Renders child routes (via <Outlet />) only when the user is authenticated.
 * - While Firebase resolves the auth state → shows a full-page spinner.
 * - Once resolved, unauthenticated users are hard-redirected to /.
 *
 * Usage in App.tsx (wrap one or more <Route> elements):
 *   <Route element={<ProtectedRoute />}>
 *     <Route path="dashboard" element={<Dashboard />} />
 *   </Route>
 */
export default function ProtectedRoute() {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white dark:bg-dark-900">
                <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/" replace />;
    }

    return <Outlet />;
}
