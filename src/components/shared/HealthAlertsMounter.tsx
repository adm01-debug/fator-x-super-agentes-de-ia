/**
 * Nexus Agents Studio — HealthAlertsMounter
 * Mount-and-forget component that starts the healthAlertsService poll
 * loop on first render and stops on unmount. Renders nothing.
 *
 * Mounted once inside App.tsx (above routes) so it lives for the
 * entire authenticated session.
 */
import { useEffect } from 'react';
import { start, stop } from '@/services/healthAlertsService';
import { useAuth } from '@/contexts/AuthContext';

export function HealthAlertsMounter() {
  const { user } = useAuth();

  useEffect(() => {
    // Only run when there's an authenticated user — no point in polling
    // health from anonymous sessions
    if (!user) {
      stop();
      return;
    }
    start(300_000); // every 5 minutes (avoids excessive polling)
    return () => stop();
  }, [user]);

  return null;
}
