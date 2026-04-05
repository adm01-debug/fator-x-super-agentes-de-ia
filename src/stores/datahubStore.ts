/**
 * Nexus Agents Studio — DataHub Store (Zustand)
 * State for cross-database queries, connections, entity browser.
 */

import { create } from 'zustand';

interface DatahubState {
  // Connections
  connections: Record<string, unknown>[];
  activeConnectionId: string | null;

  // Query
  currentQuery: string;
  queryResults: Record<string, unknown>[];
  isQuerying: boolean;
  queryError: string | null;

  // Entity browser
  selectedEntity: string | null;
  selectedRecordId: string | null;

  // Actions
  setConnections: (connections: Record<string, unknown>[]) => void;
  setActiveConnection: (id: string | null) => void;
  setCurrentQuery: (query: string) => void;
  setQueryResults: (results: Record<string, unknown>[]) => void;
  setIsQuerying: (querying: boolean) => void;
  setQueryError: (error: string | null) => void;
  selectEntity: (entity: string | null) => void;
  selectRecord: (id: string | null) => void;
  reset: () => void;
}

export const useDatahubStore = create<DatahubState>((set) => ({
  connections: [],
  activeConnectionId: null,
  currentQuery: '',
  queryResults: [],
  isQuerying: false,
  queryError: null,
  selectedEntity: null,
  selectedRecordId: null,

  setConnections: (connections) => set({ connections }),
  setActiveConnection: (id) => set({ activeConnectionId: id }),
  setCurrentQuery: (query) => set({ currentQuery: query }),
  setQueryResults: (results) => set({ queryResults: results, queryError: null }),
  setIsQuerying: (querying) => set({ isQuerying: querying }),
  setQueryError: (error) => set({ queryError: error, isQuerying: false }),
  selectEntity: (entity) => set({ selectedEntity: entity, selectedRecordId: null }),
  selectRecord: (id) => set({ selectedRecordId: id }),
  reset: () => set({
    connections: [],
    activeConnectionId: null,
    currentQuery: '',
    queryResults: [],
    isQuerying: false,
    queryError: null,
    selectedEntity: null,
    selectedRecordId: null,
  }),
}));
