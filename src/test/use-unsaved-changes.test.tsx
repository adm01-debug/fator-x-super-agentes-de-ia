import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { UnsavedChangesProvider } from '@/hooks/use-unsaved-changes';
import { useUnsavedChanges } from '@/hooks/unsavedChanges.context';

function wrapper({ children }: { children: React.ReactNode }) {
  return <UnsavedChangesProvider>{children}</UnsavedChangesProvider>;
}

describe('useUnsavedChanges', () => {
  it('defaults to no unsaved changes', () => {
    const { result } = renderHook(() => useUnsavedChanges(), { wrapper });
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it('can set unsaved changes', () => {
    const { result } = renderHook(() => useUnsavedChanges(), { wrapper });
    act(() => {
      result.current.setHasUnsavedChanges(true);
    });
    expect(result.current.hasUnsavedChanges).toBe(true);
  });

  it('confirmNavigation calls callback immediately when no unsaved changes', () => {
    const { result } = renderHook(() => useUnsavedChanges(), { wrapper });
    const callback = vi.fn();
    act(() => {
      result.current.confirmNavigation(callback);
    });
    expect(callback).toHaveBeenCalledOnce();
  });

  it('confirmNavigation does NOT call callback immediately when there are unsaved changes', () => {
    const { result } = renderHook(() => useUnsavedChanges(), { wrapper });
    act(() => {
      result.current.setHasUnsavedChanges(true);
    });
    const callback = vi.fn();
    act(() => {
      result.current.confirmNavigation(callback);
    });
    // Should NOT be called — dialog should appear instead
    expect(callback).not.toHaveBeenCalled();
  });
});
