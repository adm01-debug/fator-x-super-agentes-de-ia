import { useEffect, useState } from 'react';

/**
 * Persistência por agente das preferências do RestoreVersionDialog:
 *  - quais campos copiar (prompt/tools/model)
 *  - se a sub-view de diff completo estava aberta
 *  - id da última versão de origem visualizada (para "reabrir igual")
 *
 * Armazenado em localStorage para sobreviver entre sessões. Não é dado
 * sensível e é totalmente client-side, então usamos uma chave simples
 * baseada no agentId.
 */

export interface RestoreDialogMemory {
  copyPrompt: boolean;
  copyTools: boolean;
  copyModel: boolean;
  showFullDiff: boolean;
  lastSourceVersionId: string | null;
  lastSourceVersionNumber: number | null;
  savedAt: string; // ISO
}

const DEFAULTS: Omit<RestoreDialogMemory, 'savedAt'> = {
  copyPrompt: true,
  copyTools: true,
  copyModel: false,
  showFullDiff: false,
  lastSourceVersionId: null,
  lastSourceVersionNumber: null,
};

const storageKey = (agentId: string) => `nexus:restore-dialog:${agentId}`;

export function readRestoreDialogMemory(agentId: string | undefined | null): RestoreDialogMemory | null {
  if (!agentId || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey(agentId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RestoreDialogMemory>;
    return {
      copyPrompt: parsed.copyPrompt ?? DEFAULTS.copyPrompt,
      copyTools: parsed.copyTools ?? DEFAULTS.copyTools,
      copyModel: parsed.copyModel ?? DEFAULTS.copyModel,
      showFullDiff: parsed.showFullDiff ?? DEFAULTS.showFullDiff,
      lastSourceVersionId: parsed.lastSourceVersionId ?? null,
      lastSourceVersionNumber: parsed.lastSourceVersionNumber ?? null,
      savedAt: parsed.savedAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function writeRestoreDialogMemory(agentId: string | undefined | null, value: Omit<RestoreDialogMemory, 'savedAt'>) {
  if (!agentId || typeof window === 'undefined') return;
  try {
    const payload: RestoreDialogMemory = { ...value, savedAt: new Date().toISOString() };
    window.localStorage.setItem(storageKey(agentId), JSON.stringify(payload));
  } catch {
    // localStorage indisponível (modo privado, quota): falha silenciosa.
  }
}

export function clearRestoreDialogMemory(agentId: string | undefined | null) {
  if (!agentId || typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(storageKey(agentId));
  } catch {
    // ignore
  }
}

/**
 * Hook conveniente: lê uma vez ao montar (ou quando agentId muda) e expõe
 * um saver explícito. Não escrevemos automaticamente em todo render para
 * evitar gravar estados intermediários — quem chama decide o momento.
 */
export function useRestoreDialogMemory(agentId: string | undefined | null) {
  const [memory, setMemory] = useState<RestoreDialogMemory | null>(() => readRestoreDialogMemory(agentId));

  useEffect(() => {
    setMemory(readRestoreDialogMemory(agentId));
  }, [agentId]);

  const save = (value: Omit<RestoreDialogMemory, 'savedAt'>) => {
    writeRestoreDialogMemory(agentId, value);
    setMemory({ ...value, savedAt: new Date().toISOString() });
  };

  const clear = () => {
    clearRestoreDialogMemory(agentId);
    setMemory(null);
  };

  return { memory, save, clear };
}
