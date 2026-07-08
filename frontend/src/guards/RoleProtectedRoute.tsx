import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from "@/providers/AuthProvider";
import { useRole, defaultDashboardFor } from "@/hooks/useRole";
import type { UserRole } from "@/services/api";

type RoleProtectedRouteProps = {
    /**
     * The ONLY role that may access this route.
     * Strict isolation: no role inherits another's access.
     */
    allowedRole: Exclude<UserRole, 'user'>;
};

function Spinner() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-dark-900">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );
}

/**
 * RoleProtectedRoute — strict single-role isolation.
 *
 * Only the exact `allowedRole` may pass. Every other authenticated user
 * is redirected to THEIR OWN correct dashboard, not to /.
 *
 * Usage:
 *   <Route element={<RoleProtectedRoute allowedRole="admin" />}>
 *     <Route path="admin" element={<AdminDashboard />} />
 *   </Route>
 */
export default function RoleProtectedRoute({ allowedRole }: RoleProtectedRouteProps) {
    const { user, loading: authLoading } = useAuth();
    const { role, loading: roleLoading } = useRole();

    if (authLoading || roleLoading) return <Spinner />;

    if (!user) return <Navigate to="/" replace />;

    if (role === allowedRole) return <Outlet />;

    // Wrong role → redirect to their own correct dashboard
    return <Navigate to={defaultDashboardFor(role)} replace />;
}
