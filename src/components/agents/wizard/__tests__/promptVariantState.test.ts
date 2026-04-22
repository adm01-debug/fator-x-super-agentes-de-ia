/**
 * Wizard prompt-variant state — integration-style tests.
 *
 * Covers the three scenarios the user asked us to lock down:
 *
 *  1) Apply a variant → reload the wizard → the *same* variant is restored
 *     (we don't fall back to "balanced" via auto-detection).
 *  2) Switch between chips and the displayed `activeVariant` follows the
 *     user's explicit pick — never the auto-detected one.
 *  3) Manually edit the prompt → `selectedVariant` is cleared, the custom
 *     lock engages, and *both* survive a reload.
 *
 * We test the persistence layer (`draftStore`) and the pure derivation
 * (`detectPromptVariant` + the wizard's `selectedVariant ?? detected` rule)
 * directly. That keeps the suite fast and focused on the contract that
 * actually matters, instead of mounting the 950-line `QuickCreateWizard`.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  loadDrafts,
  saveDrafts,
  upsertDraft,
  DRAFTS_KEY,
} from '../draftStore';
import {
  QUICK_AGENT_TEMPLATES,
  detectPromptVariant,
  type PromptVariantId,
  type QuickAgentType,
} from '@/data/quickAgentTemplates';
import { QUICK_AGENT_DEFAULTS, type QuickAgentForm } from '@/lib/validations/quickAgentSchema';

/** Mirror of the wizard's chip-derivation rule (see QuickCreateWizard.tsx). */
function deriveActiveVariant(args: {
  type: QuickAgentType;
  prompt: string;
  selectedVariant: PromptVariantId | null;
  promptCustomLocked: boolean;
}): PromptVariantId | null {
  if (args.promptCustomLocked) return null;
  const detected = detectPromptVariant(args.type, args.prompt);
  return args.selectedVariant ?? detected;
}

function makeForm(overrides: Partial<QuickAgentForm> = {}): QuickAgentForm {
  return { ...QUICK_AGENT_DEFAULTS, ...overrides };
}

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  localStorage.clear();
});

describe('wizard / prompt variant state', () => {
  describe('1) Apply variant + reload', () => {
    it('restores the explicitly picked variant — not the auto-detected fallback', () => {
      const type: QuickAgentType = 'chatbot';
      const variant: PromptVariantId = 'detailed';
      const tpl = QUICK_AGENT_TEMPLATES[type];

      // Simulate the wizard saving the draft right after user clicked "Detailed".
      const form = makeForm({
        type,
        name: 'Suporte detalhado',
        emoji: '🤖',
        mission: 'Atender clientes com profundidade técnica e empatia.',
        prompt: tpl.promptVariants[variant].prompt,
      });

      const empty = loadDrafts();
      const { store, id } = upsertDraft(empty, {
        form,
        promptCustomLocked: false,
        selectedVariant: variant,
      });
      saveDrafts({ ...store, activeId: id });

      // Reload — fresh module call, reading from the same localStorage.
      const reloaded = loadDrafts();
      const restored = reloaded.drafts.find((d) => d.id === id);
      expect(restored).toBeDefined();
      expect(restored!.selectedVariant).toBe(variant);
      expect(restored!.promptCustomLocked).toBe(false);

      // The chip the user sees must match the explicit pick.
      const active = deriveActiveVariant({
        type,
        prompt: restored!.form.prompt,
        selectedVariant: restored!.selectedVariant ?? null,
        promptCustomLocked: !!restored!.promptCustomLocked,
      });
      expect(active).toBe(variant);
    });

    it('still restores the user pick when text happens to match a different variant', () => {
      // Edge case: user picked "concise" but the prompt body coincidentally
      // matches the "balanced" template character-for-character. The explicit
      // `selectedVariant` must win over `detectPromptVariant`.
      const type: QuickAgentType = 'chatbot';
      const balancedText = QUICK_AGENT_TEMPLATES[type].promptVariants.balanced.prompt;

      const form = makeForm({ type, prompt: balancedText });
      const { store, id } = upsertDraft(loadDrafts(), {
        form,
        promptCustomLocked: false,
        selectedVariant: 'concise',
      });
      saveDrafts({ ...store, activeId: id });

      const restored = loadDrafts().drafts.find((d) => d.id === id)!;
      const active = deriveActiveVariant({
        type,
        prompt: restored.form.prompt,
        selectedVariant: restored.selectedVariant ?? null,
        promptCustomLocked: false,
      });
      // Auto-detect would say 'balanced' here — explicit pick must override.
      expect(detectPromptVariant(type, restored.form.prompt)).toBe('balanced');
      expect(active).toBe('concise');
    });
  });

  describe('2) Switching between chips', () => {
    it('always reflects the latest explicit pick, not the auto-detected one', () => {
      const type: QuickAgentType = 'copilot';
      const tpl = QUICK_AGENT_TEMPLATES[type];

      // Start: user clicks "balanced" — wizard sets prompt + selectedVariant.
      let state = {
        prompt: tpl.promptVariants.balanced.prompt,
        selectedVariant: 'balanced' as PromptVariantId | null,
        promptCustomLocked: false,
      };
      expect(deriveActiveVariant({ type, ...state })).toBe('balanced');

      // Click "concise".
      state = {
        prompt: tpl.promptVariants.concise.prompt,
        selectedVariant: 'concise',
        promptCustomLocked: false,
      };
      expect(deriveActiveVariant({ type, ...state })).toBe('concise');

      // Click "detailed".
      state = {
        prompt: tpl.promptVariants.detailed.prompt,
        selectedVariant: 'detailed',
        promptCustomLocked: false,
      };
      expect(deriveActiveVariant({ type, ...state })).toBe('detailed');
    });

    it('falls back to detectPromptVariant only when the user has never picked one', () => {
      const type: QuickAgentType = 'analyst';
      const tpl = QUICK_AGENT_TEMPLATES[type];

      // Fresh form, prompt was filled by template (== balanced) but user
      // never opened the variant chips.
      const active = deriveActiveVariant({
        type,
        prompt: tpl.promptVariants.balanced.prompt,
        selectedVariant: null,
        promptCustomLocked: false,
      });
      expect(active).toBe('balanced');
    });
  });

  describe('3) Manual edit → custom lock + zeroed variant, surviving reload', () => {
    it('clears selectedVariant, sets the custom lock, and persists both', () => {
      const type: QuickAgentType = 'chatbot';
      const tpl = QUICK_AGENT_TEMPLATES[type];

      // Initial: user picked "detailed".
      const initial = makeForm({
        type,
        name: 'Edit teste',
        emoji: '🛠️',
        mission: 'Testar a transição para modo customizado depois de editar.',
        prompt: tpl.promptVariants.detailed.prompt,
      });
      const first = upsertDraft(loadDrafts(), {
        form: initial,
        promptCustomLocked: false,
        selectedVariant: 'detailed',
      });
      saveDrafts({ ...first.store, activeId: first.id });

      // Now simulate the wizard's `updatePromptManual` side-effect: prompt
      // mutates, selectedVariant -> null, promptCustomLocked -> true.
      const editedForm = { ...initial, prompt: initial.prompt + '\n\nRegra extra adicionada manualmente.' };
      const second = upsertDraft(loadDrafts(), {
        id: first.id,
        form: editedForm,
        promptCustomLocked: true,
        selectedVariant: null,
      });
      saveDrafts({ ...second.store, activeId: second.id });

      // Reload — both flags must survive.
      const reloaded = loadDrafts();
      const restored = reloaded.drafts.find((d) => d.id === first.id)!;
      expect(restored.promptCustomLocked).toBe(true);
      expect(restored.selectedVariant).toBeNull();

      // The chip area should show "no active variant" (custom mode).
      const active = deriveActiveVariant({
        type,
        prompt: restored.form.prompt,
        selectedVariant: restored.selectedVariant ?? null,
        promptCustomLocked: !!restored.promptCustomLocked,
      });
      expect(active).toBeNull();
    });

    it('keeps the lock even when edited text coincidentally re-matches a variant', () => {
      // Important contract: once locked, even if the user undoes their edit
      // and the text bytes line back up with "balanced", we still show
      // "customizado" (lock holds until the user explicitly unlocks).
      const type: QuickAgentType = 'chatbot';
      const balancedText = QUICK_AGENT_TEMPLATES[type].promptVariants.balanced.prompt;

      const form = makeForm({ type, prompt: balancedText });
      const { store, id } = upsertDraft(loadDrafts(), {
        form,
        promptCustomLocked: true,
        selectedVariant: null,
      });
      saveDrafts({ ...store, activeId: id });

      const restored = loadDrafts().drafts.find((d) => d.id === id)!;
      expect(restored.promptCustomLocked).toBe(true);

      const active = deriveActiveVariant({
        type,
        prompt: restored.form.prompt,
        selectedVariant: null,
        promptCustomLocked: true,
      });
      // Auto-detect would gladly say 'balanced' — lock must override.
      expect(detectPromptVariant(type, restored.form.prompt)).toBe('balanced');
      expect(active).toBeNull();
    });
  });

  describe('persistence robustness', () => {
    it('treats unknown selectedVariant strings as null on reload', () => {
      // Hand-craft a corrupted store (e.g. older build wrote a variant id
      // that no longer exists). normalizeVariant should defang it.
      const id = 'd_test_corrupt';
      localStorage.setItem(
        DRAFTS_KEY,
        JSON.stringify({
          version: 2,
          activeId: id,
          drafts: [{
            id,
            form: makeForm({ type: 'chatbot' }),
            savedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            promptCustomLocked: false,
            selectedVariant: 'super-detailed', // not a real variant
          }],
        }),
      );

      const reloaded = loadDrafts();
      const restored = reloaded.drafts.find((d) => d.id === id)!;
      expect(restored.selectedVariant).toBeNull();
    });
  });
});
