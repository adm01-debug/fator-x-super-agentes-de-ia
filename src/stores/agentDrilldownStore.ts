/**
 * agentDrilldownStore — session-scoped global filter for "drill into a single agent".
 *
 * Backed by sessionStorage so the filter survives navigation between related
 * pages (e.g. drill-down from Cost Anomalies → Traces → Monitoring) and dies
 * when the tab/session closes. This is intentionally separate from the
 * AgentTracesPage filter persistence (Cloud + localStorage) — that one is
 * about the user's preferred default filters, this one is about an active
 * investigation context.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface AgentDrilldownState {
  /** UUID of the agent currently being drilled into; null when no drill is active. */
  agentId: string | null;
  /** Cached human label (resolved when first set) so the badge can render without refetching. */
  agentName: string | null;
  /** Origin route — used only for analytics/debugging breadcrumbs. */
  origin: string | null;

  setDrilldown: (agentId: string, agentName: string | null, origin?: string) => void;
  clearDrilldown: () => void;
}

export const useAgentDrilldownStore = create<AgentDrilldownState>()(
  persist(
    (set) => ({
      agentId: null,
      agentName: null,
      origin: null,

      setDrilldown: (agentId, agentName, origin) => set({
        agentId,
        agentName: agentName ?? null,
        origin: origin ?? null,
      }),
      clearDrilldown: () => set({ agentId: null, agentName: null, origin: null }),
    }),
    {
      name: 'nexus.agent-drilldown',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
