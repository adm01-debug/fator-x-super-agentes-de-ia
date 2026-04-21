/**
 * Nexus Agents Studio — Draft Versions Service
 * Local-only (localStorage) snapshots of in-progress agent configs.
 * Não persiste no backend — usado para "salvar rascunho" no AgentBuilder.
 */
import type { AgentConfig } from '@/types/agentTypes';
import { logger } from '@/lib/logger';

const STORAGE_KEY = 'nexus.agent.draft-versions.v1';
const MAX_DRAFTS_PER_AGENT = 20;

export interface DraftVersion {
  id: string;            // uuid local
  agentId: string;       // 'new' quando ainda não foi salvo
  agentName: string;
  label: string;         // título dado pelo usuário ou auto
  note?: string;
  snapshot: AgentConfig; // cópia completa
  createdAt: string;     // ISO
  size: number;          // bytes aproximados
}

function readAll(): DraftVersion[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DraftVersion[]) : [];
  } catch (err) {
    logger.error('Failed to read draft versions', { err: String(err) });
    return [];
  }
}

function writeAll(drafts: DraftVersion[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  } catch (err) {
    logger.error('Failed to write draft versions', { err: String(err) });
  }
}

export function listDraftVersions(agentId?: string): DraftVersion[] {
  const all = readAll();
  const key = agentId || 'new';
  return all
    .filter((d) => d.agentId === key)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function saveDraftVersion(params: {
  agent: AgentConfig;
  label?: string;
  note?: string;
}): DraftVersion {
  const { agent, label, note } = params;
  const agentId = (agent.id as string | undefined) || 'new';
  const json = JSON.stringify(agent);
  const draft: DraftVersion = {
    id: crypto.randomUUID(),
    agentId,
    agentName: agent.name || 'Sem nome',
    label: (label || '').trim() || `Rascunho ${new Date().toLocaleString('pt-BR')}`,
    note: (note || '').trim() || undefined,
    snapshot: JSON.parse(json) as AgentConfig,
    createdAt: new Date().toISOString(),
    size: new Blob([json]).size,
  };

  const all = readAll();
  // Mantém limite por agente — descarta os mais antigos
  const sameAgent = all.filter((d) => d.agentId === agentId);
  const others = all.filter((d) => d.agentId !== agentId);
  const trimmed = [draft, ...sameAgent].slice(0, MAX_DRAFTS_PER_AGENT);
  writeAll([...trimmed, ...others]);
  return draft;
}

export function deleteDraftVersion(id: string): void {
  const all = readAll();
  writeAll(all.filter((d) => d.id !== id));
}

export function clearDraftVersions(agentId?: string): void {
  const all = readAll();
  const key = agentId || 'new';
  writeAll(all.filter((d) => d.agentId !== key));
}

export function getDraftVersion(id: string): DraftVersion | undefined {
  return readAll().find((d) => d.id === id);
}
