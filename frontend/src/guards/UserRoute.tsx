import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from "@/providers/AuthProvider";
import { useRole, defaultDashboardFor } from "@/hooks/useRole";

function Spinner() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-dark-900">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );
}

/**
 * UserRoute — only role === 'user' passes.
 * Admins and super admins are redirected to their correct dashboards.
 */
export default function UserRoute() {
    const { user, loading: authLoading } = useAuth();
    const { role, loading: roleLoading } = useRole();

    if (authLoading || roleLoading) return <Spinner />;

    if (!user) return <Navigate to="/" replace />;

    if (role === 'user') return <Outlet />;

    return <Navigate to={defaultDashboardFor(role)} replace />;
}
