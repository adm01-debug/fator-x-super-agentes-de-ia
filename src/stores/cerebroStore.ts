/**
 * Nexus Agents Studio — Super Cérebro Store (Zustand)
 * State for Knowledge Graph, collections, queries, health.
 */

import { create } from 'zustand';

interface CerebroState {
  // Active tab
  activeTab: string;

  // Search
  searchQuery: string;
  searchResults: Record<string, unknown>[];
  isSearching: boolean;

  // Collections
  collections: Record<string, unknown>[];
  selectedCollectionId: string | null;

  // Health
  healthScore: number;
  decayAlerts: number;
  duplicateAlerts: number;

  // Actions
  setActiveTab: (tab: string) => void;
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: Record<string, unknown>[]) => void;
  setIsSearching: (searching: boolean) => void;
  setCollections: (collections: Record<string, unknown>[]) => void;
  selectCollection: (id: string | null) => void;
  setHealthScore: (score: number) => void;
  setAlerts: (decay: number, duplicates: number) => void;
  reset: () => void;
}

export const useCerebroStore = create<CerebroState>((set) => ({
  activeTab: 'overview',
  searchQuery: '',
  searchResults: [],
  isSearching: false,
  collections: [],
  selectedCollectionId: null,
  healthScore: 0,
  decayAlerts: 0,
  duplicateAlerts: 0,

  setActiveTab: (tab) => set({ activeTab: tab }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSearchResults: (results) => set({ searchResults: results }),
  setIsSearching: (searching) => set({ isSearching: searching }),
  setCollections: (collections) => set({ collections }),
  selectCollection: (id) => set({ selectedCollectionId: id }),
  setHealthScore: (score) => set({ healthScore: score }),
  setAlerts: (decay, duplicates) => set({ decayAlerts: decay, duplicateAlerts: duplicates }),
  reset: () => set({
    activeTab: 'overview',
    searchQuery: '',
    searchResults: [],
    isSearching: false,
    collections: [],
    selectedCollectionId: null,
    healthScore: 0,
    decayAlerts: 0,
    duplicateAlerts: 0,
  }),
}));
