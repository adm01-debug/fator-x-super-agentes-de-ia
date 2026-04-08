/**
 * Nexus Agents Studio — Workflow Keyboard Shortcuts (T17)
 * Generic global keyboard shortcuts for the workflow editor.
 * Decoupled from any specific store — caller passes callbacks.
 *
 * Shortcuts:
 *  - Cmd/Ctrl+S        : onSave callback (e.preventDefault to override
 *                        browser save dialog)
 *  - Delete/Backspace  : onDelete(selectedId) — only fires if selectedId
 *                        is provided
 *  - Escape            : onDeselect callback
 *  - Cmd/Ctrl+D        : onDuplicate(selectedId) callback
 *
 * Ignores keystrokes when the user is typing in an input/textarea/
 * contenteditable so it never steals focus from forms.
 */
import { useEffect } from 'react';

interface UseWorkflowKeyboardOptions {
  selectedId?: string | null;
  onSave?: () => void;
  onDelete?: (id: string) => void;
  onDeselect?: () => void;
  onDuplicate?: (id: string) => void;
  enabled?: boolean;
}

function isTypingInForm(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (target.isContentEditable) return true;
  return false;
}

export function useWorkflowKeyboard(options: UseWorkflowKeyboardOptions = {}) {
  const { selectedId, onSave, onDelete, onDeselect, onDuplicate, enabled = true } = options;

  useEffect(() => {
    if (!enabled) return;

    const handleKey = (e: KeyboardEvent) => {
      if (isTypingInForm(e.target)) return;

      const isMod = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl+S → save
      if (isMod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        onSave?.();
        return;
      }

      // Cmd/Ctrl+D → duplicate
      if (isMod && e.key.toLowerCase() === 'd' && selectedId) {
        e.preventDefault();
        onDuplicate?.(selectedId);
        return;
      }

      // Delete / Backspace → remove selected
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        onDelete?.(selectedId);
        return;
      }

      // Escape → deselect
      if (e.key === 'Escape' && selectedId) {
        e.preventDefault();
        onDeselect?.();
        return;
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [enabled, selectedId, onSave, onDelete, onDeselect, onDuplicate]);
}
