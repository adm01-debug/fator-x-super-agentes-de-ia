/**
 * Mount-and-forget component that activates SLO breach alerts.
 * Polls every 5 minutes; renders nothing.
 */
import { useSLOAlerts } from '@/hooks/useSLOAlerts';

export function SLOAlertsMounter() {
  useSLOAlerts();
  return null;
}
