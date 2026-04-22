import { createContext, useContext } from 'react';

export interface UnsavedChangesContextType {
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (v: boolean) => void;
  confirmNavigation: (onConfirm: () => void) => void;
}

export const UnsavedChangesContext = createContext<UnsavedChangesContextType>({
  hasUnsavedChanges: false,
  setHasUnsavedChanges: () => {},
  confirmNavigation: (cb) => cb(),
});

export function useUnsavedChanges() {
  return useContext(UnsavedChangesContext);
}
