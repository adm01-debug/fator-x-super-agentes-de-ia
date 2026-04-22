import { useAuth } from '@/contexts/useAuth';
import { Navigate } from 'react-router-dom';
import { PageLoading } from '@/components/shared/PageLoading';
import type { ReactNode } from 'react';

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <PageLoading />;
  if (!user) return <Navigate to="/auth" replace />;

  return <>{children}</>;
}
