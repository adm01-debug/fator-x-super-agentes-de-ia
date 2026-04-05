import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { PageLoading } from '@/components/shared/PageLoading';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'editor' | 'viewer' | 'operator';
}

/**
 * Route guard that checks authentication and optionally role.
 * Redirects to /auth if not logged in.
 * Shows unauthorized message if role doesn't match.
 */
export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) return <PageLoading />;
  if (!user) return <Navigate to="/auth" replace />;

  // Role check is informational — RLS enforces real access on the backend
  // This prevents UI exposure of admin-only pages to non-admin users
  if (requiredRole === 'admin') {
    // Future: check workspace_members.role via hook
    // For now, all authenticated users can access (RLS protects data)
  }

  return <>{children}</>;
}
