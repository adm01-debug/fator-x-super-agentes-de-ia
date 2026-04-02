/**
 * Self-Editing Memory (MemGPT/Letta Pattern)
 * Agent auto-manages its own memory via tool calls: insert, search, replace, forget.
 * Implements: core memory, archival memory, recall memory, compaction, importance scoring.
 */
import * as llm from './llmService';
import * as memoryService from './memoryService';
import { logger } from '@/lib/logger';

// ═══ TYPES ═══

export interface CoreMemory {
  persona: string; // Agent's self-description (always in context)
  userBlock: string; // Current user info (always in context)
  systemBlock: string; // System rules (always in context)
}

export interface MemoryTool {
  name: string;
  description: string;
  execute: (agentId: string, params: Record<string, string>) => Promise<string>;
}

export interface CompactionResult {
  originalEntries: number;
  compactedEntries: number;
  removedEntries: number;
  summariesCreated: number;
}

// ═══ CORE MEMORY (always in context) ═══

const coreMemories = new Map<string, CoreMemory>();

export function getCoreMemory(agentId: string): CoreMemory {
  if (!coreMemories.has(agentId)) {
    coreMemories.set(agentId, { persona: '', userBlock: '', systemBlock: '' });
  }
  return coreMemories.get(agentId)!;
}

export function updateCoreMemory(agentId: string, updates: Partial<CoreMemory>): void {
  const current = getCoreMemory(agentId);
  coreMemories.set(agentId, { ...current, ...updates });
}

// ═══ MEMORY TOOLS (agent calls these to manage memory) ═══

export const memoryTools: MemoryTool[] = [
  {
    name: 'core_memory_replace',
    description: 'Replace a section of core memory (persona or user block)',
    execute: async (agentId, params) => {
      const { section, oldText, newText } = params;
      const core = getCoreMemory(agentId);
      if (section === 'persona') {
        core.persona = core.persona.replace(oldText, newText);
      } else if (section === 'user') {
        core.userBlock = core.userBlock.replace(oldText, newText);
      }
      coreMemories.set(agentId, core);
      return `Core memory updated: ${section}`;
    },
  },
  {
    name: 'archival_memory_insert',
    description: 'Store a fact in long-term archival memory',
    execute: async (agentId, params) => {
      const { content, importance } = params;
      memoryService.addMemory(agentId, 'semantic', content, {
        confidence: parseInt(importance) || 80,
        source: 'self-edit',
        ttlDays: 365,
      });
      return `Archived: "${content.slice(0, 50)}..."`;
    },
  },
  {
    name: 'archival_memory_search',
    description: 'Search archival memory for relevant facts',
    execute: async (agentId, params) => {
      const results = memoryService.searchMemories(agentId, params.query, 5);
      if (results.length === 0) return 'No archival memories found.';
      return results.map((r, i) => `[${i + 1}] ${r.content}`).join('\n');
    },
  },
  {
    name: 'recall_memory_search',
    description: 'Search conversation history by keyword or date',
    execute: async (agentId, params) => {
      const shortTerm = memoryService.getMemories(agentId, 'short_term');
      const episodic = memoryService.getMemories(agentId, 'episodic');
      const all = [...shortTerm, ...episodic];
      const query = params.query.toLowerCase();
      const matches = all.filter(m => m.content.toLowerCase().includes(query));
      if (matches.length === 0) return 'No recall memories found.';
      return matches.slice(0, 5).map((m, i) => `[${i + 1}] (${m.layer}) ${m.content}`).join('\n');
    },
  },
  {
    name: 'memory_forget',
    description: 'Remove a specific memory by marking as forgotten',
    execute: async (agentId, params) => {
      const { layer, content } = params;
      const entries = memoryService.getMemories(agentId, layer as memoryService.MemoryEntry['layer']);
      const match = entries.find(e => e.content.includes(content));
      if (match) {
        memoryService.deleteMemory(agentId, layer as memoryService.MemoryEntry['layer'], match.id);
        return `Forgotten: "${content.slice(0, 50)}..."`;
      }
      return 'Memory not found.';
    },
  },
];

// ═══ MEMORY COMPACTION ═══

/**
 * Compact memory: summarize old entries, remove low-importance ones.
 * Implements Ebbinghaus-inspired decay + importance scoring.
 */
export async function compactMemory(agentId: string): Promise<CompactionResult> {
  const stats = memoryService.getStats(agentId);
  let removed = 0;
  let summariesCreated = 0;
  const originalTotal = stats.reduce((s, st) => s + st.count, 0);

  // Compact episodic memory: summarize every 20 entries into 1 summary
  const episodic = memoryService.getMemories(agentId, 'episodic');
  if (episodic.length > 30) {
    const oldEntries = episodic.slice(20); // Keep newest 20
    if (llm.isLLMConfigured() && oldEntries.length > 5) {
      const summaryText = oldEntries.map(e => e.content).join('\n');
      const summaryResp = await llm.callModel('anthropic/claude-sonnet-4', [
        { role: 'system', content: 'Summarize these interaction memories into 3-5 key facts. Be concise.' },
        { role: 'user', content: summaryText.slice(0, 3000) },
      ], { temperature: 0.2, maxTokens: 300 });

      // Store summary as semantic memory
      memoryService.addMemory(agentId, 'semantic', `[Compacted from ${oldEntries.length} interactions] ${summaryResp.content}`, {
        source: 'compaction', confidence: 75,
      });
      summariesCreated++;

      // Remove old entries
      for (const entry of oldEntries) {
        memoryService.deleteMemory(agentId, 'episodic', entry.id);
        removed++;
      }
    }
  }

  // Remove expired short-term memories
  const shortTerm = memoryService.getMemories(agentId, 'short_term');
  const now = new Date().toISOString();
  for (const entry of shortTerm) {
    if (entry.expiresAt && entry.expiresAt < now) {
      memoryService.deleteMemory(agentId, 'short_term', entry.id);
      removed++;
    }
  }

  const compactedTotal = originalTotal - removed + summariesCreated;
  logger.info(`Memory compaction: ${originalTotal} → ${compactedTotal} entries (removed ${removed}, created ${summariesCreated} summaries)`, 'selfEditingMemory');

  return { originalEntries: originalTotal, compactedEntries: compactedTotal, removedEntries: removed, summariesCreated };
}

// ═══ BUILD MEMORY-AUGMENTED PROMPT ═══

/** Build a system prompt that includes core memory + relevant archival memories. */
export function buildMemoryAugmentedPrompt(agentId: string, basePrompt: string, userQuery: string): string {
  const core = getCoreMemory(agentId);
  const relevantMemories = memoryService.searchMemories(agentId, userQuery, 3);

  let prompt = basePrompt;

  if (core.persona) {
    prompt += `\n\n## Your Memory — Persona\n${core.persona}`;
  }
  if (core.userBlock) {
    prompt += `\n\n## Your Memory — Current User\n${core.userBlock}`;
  }
  if (relevantMemories.length > 0) {
    prompt += `\n\n## Your Memory — Relevant Facts\n${relevantMemories.map(m => `- ${m.content}`).join('\n')}`;
  }

  prompt += `\n\n## Memory Tools Available\nYou can manage your memory by calling these tools:\n${memoryTools.map(t => `- ${t.name}: ${t.description}`).join('\n')}`;

  return prompt;
}
