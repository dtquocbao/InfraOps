import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { canAccessRoute, getDefaultRoute } from '../lib/navigation';
import { ExecutiveDashboard } from '../pages/ExecutiveDashboard';

export function RoleGuard() {
  const { user } = useAuth();
  const location = useLocation();

  if (user && !canAccessRoute(user.role, location.pathname)) {
    return <Navigate to={getDefaultRoute(user.role)} replace />;
  }

  return <Outlet />;
}

export function IndexPage() {
  const { user } = useAuth();
  if (!user) return null;

  const home = getDefaultRoute(user.role);
  if (home !== '/') {
    return <Navigate to={home} replace />;
  }

  return <ExecutiveDashboard />;
}
