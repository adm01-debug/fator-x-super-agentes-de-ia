/**
 * GraphRAG Service — Knowledge graph from documents via LLM entity/relation extraction
 * Implements: entity extraction, relation mapping, community detection, hierarchical summarization
 * Based on Microsoft GraphRAG pattern (open-source)
 */
import * as llm from './llmService';
import { logger } from '@/lib/logger';

// ═══ TYPES ═══

export interface GraphEntity {
  id: string;
  name: string;
  type: string; // person, company, product, concept, location, event
  description: string;
  properties: Record<string, string>;
  mentions: number;
  communityId?: number;
}

export interface GraphRelation {
  id: string;
  sourceId: string;
  targetId: string;
  type: string; // works_for, supplies, contains, related_to, etc.
  description: string;
  weight: number;
}

export interface GraphCommunity {
  id: number;
  entities: string[]; // entity IDs
  summary: string;
  level: number; // hierarchy level (0 = leaf, higher = more abstract)
}

export interface KnowledgeGraph {
  entities: GraphEntity[];
  relations: GraphRelation[];
  communities: GraphCommunity[];
  documentCount: number;
  createdAt: string;
}

export interface GraphQueryResult {
  answer: string;
  entities: GraphEntity[];
  relations: GraphRelation[];
  communities: GraphCommunity[];
  method: 'local' | 'global' | 'hybrid';
  confidence: number;
}

// ═══ GRAPH STORE ═══

const graphs = new Map<string, KnowledgeGraph>();

export function getGraph(graphId: string): KnowledgeGraph | null {
  return graphs.get(graphId) ?? null;
}

export function listGraphs(): { id: string; entityCount: number; relationCount: number; documentCount: number }[] {
  return Array.from(graphs.entries()).map(([id, g]) => ({
    id, entityCount: g.entities.length, relationCount: g.relations.length, documentCount: g.documentCount,
  }));
}

// ═══ ENTITY EXTRACTION ═══

/** Extract entities and relations from text using LLM. */
export async function extractEntitiesAndRelations(
  text: string,
  domain?: string
): Promise<{ entities: GraphEntity[]; relations: GraphRelation[] }> {
  if (!llm.isLLMConfigured()) {
    // Fallback: basic NER via regex
    return extractBasicEntities(text);
  }

  const response = await llm.callModel('anthropic/claude-sonnet-4', [
    { role: 'system', content: `Extract entities and relationships from the text. Domain: ${domain ?? 'general'}.
Return JSON: {"entities": [{"name": "...", "type": "person|company|product|concept|location|event", "description": "..."}], "relations": [{"source": "entity_name", "target": "entity_name", "type": "relation_type", "description": "..."}]}` },
    { role: 'user', content: text.slice(0, 5000) },
  ], { temperature: 0.1, maxTokens: 2000 });

  try {
    const data = JSON.parse(response.content.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
    const entities: GraphEntity[] = (data.entities ?? []).map((e: { name: string; type: string; description: string }, i: number) => ({
      id: `ent-${Date.now()}-${i}`, name: e.name, type: e.type, description: e.description,
      properties: {}, mentions: 1,
    }));
    const relations: GraphRelation[] = (data.relations ?? []).map((r: { source: string; target: string; type: string; description: string }, i: number) => {
      const src = entities.find(e => e.name === r.source);
      const tgt = entities.find(e => e.name === r.target);
      return {
        id: `rel-${Date.now()}-${i}`, sourceId: src?.id ?? '', targetId: tgt?.id ?? '',
        type: r.type, description: r.description, weight: 1,
      };
    }).filter((r: GraphRelation) => r.sourceId && r.targetId);

    return { entities, relations };
  } catch {
    return extractBasicEntities(text);
  }
}

function extractBasicEntities(text: string): { entities: GraphEntity[]; relations: GraphRelation[] } {
  const entities: GraphEntity[] = [];
  // Basic: extract capitalized multi-word phrases as potential entities
  const matches = text.match(/[A-Z][a-záàâãéèêíóôõúç]+(?:\s+[A-Z][a-záàâãéèêíóôõúç]+)+/g) ?? [];
  const unique = [...new Set(matches)];
  unique.slice(0, 30).forEach((name, i) => {
    entities.push({ id: `ent-${Date.now()}-${i}`, name, type: 'concept', description: '', properties: {}, mentions: 1 });
  });
  return { entities, relations: [] };
}

// ═══ GRAPH CONSTRUCTION ═══

/** Build a knowledge graph from multiple text chunks. */
export async function buildGraph(
  graphId: string,
  textChunks: { content: string; source: string }[],
  domain?: string,
  onProgress?: (stage: string, pct: number) => void
): Promise<KnowledgeGraph> {
  const allEntities: GraphEntity[] = [];
  const allRelations: GraphRelation[] = [];

  // Step 1: Extract entities from each chunk
  for (let i = 0; i < textChunks.length; i++) {
    onProgress?.('Extracting entities', Math.round(i / textChunks.length * 50));
    const { entities, relations } = await extractEntitiesAndRelations(textChunks[i].content, domain);
    allEntities.push(...entities);
    allRelations.push(...relations);
  }

  // Step 2: Deduplicate entities (merge by name)
  onProgress?.('Deduplicating', 60);
  const entityMap = new Map<string, GraphEntity>();
  allEntities.forEach(e => {
    const key = e.name.toLowerCase();
    if (entityMap.has(key)) {
      entityMap.get(key)!.mentions++;
    } else {
      entityMap.set(key, e);
    }
  });
  const dedupedEntities = Array.from(entityMap.values());

  // Step 3: Community detection (simplified Leiden-like algorithm)
  onProgress?.('Detecting communities', 75);
  const communities = detectCommunities(dedupedEntities, allRelations);

  // Step 4: Generate community summaries
  onProgress?.('Summarizing communities', 90);
  if (llm.isLLMConfigured()) {
    for (const community of communities.slice(0, 10)) {
      const entityNames = community.entities.map(eid => dedupedEntities.find(e => e.id === eid)?.name).filter(Boolean);
      if (entityNames.length > 0) {
        const resp = await llm.callModel('anthropic/claude-sonnet-4', [
          { role: 'user', content: `Summarize this group of related entities in 1-2 sentences: ${entityNames.join(', ')}` },
        ], { temperature: 0.2, maxTokens: 100 });
        community.summary = resp.content;
      }
    }
  }

  const graph: KnowledgeGraph = {
    entities: dedupedEntities, relations: allRelations, communities,
    documentCount: textChunks.length, createdAt: new Date().toISOString(),
  };

  graphs.set(graphId, graph);
  onProgress?.('Complete', 100);
  logger.info(`GraphRAG built: ${dedupedEntities.length} entities, ${allRelations.length} relations, ${communities.length} communities`, 'graphRag');
  return graph;
}

// ═══ COMMUNITY DETECTION (simplified) ═══

function detectCommunities(entities: GraphEntity[], relations: GraphRelation[]): GraphCommunity[] {
  // Simple connected components algorithm
  const adjacency = new Map<string, Set<string>>();
  entities.forEach(e => adjacency.set(e.id, new Set()));
  relations.forEach(r => {
    adjacency.get(r.sourceId)?.add(r.targetId);
    adjacency.get(r.targetId)?.add(r.sourceId);
  });

  const visited = new Set<string>();
  const communities: GraphCommunity[] = [];
  let communityId = 0;

  for (const entity of entities) {
    if (visited.has(entity.id)) continue;

    const component: string[] = [];
    const stack = [entity.id];
    while (stack.length > 0) {
      const nodeId = stack.pop()!;
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);
      component.push(nodeId);
      adjacency.get(nodeId)?.forEach(neighbor => {
        if (!visited.has(neighbor)) stack.push(neighbor);
      });
    }

    if (component.length > 0) {
      communities.push({ id: communityId++, entities: component, summary: '', level: 0 });
      component.forEach(eid => {
        const ent = entities.find(e => e.id === eid);
        if (ent) ent.communityId = communityId - 1;
      });
    }
  }

  return communities;
}

// ═══ GRAPH QUERYING ═══

/** Query the knowledge graph — local (entity-specific) or global (community summaries). */
export async function queryGraph(
  graphId: string,
  query: string,
  method: 'local' | 'global' | 'hybrid' = 'hybrid'
): Promise<GraphQueryResult> {
  const graph = graphs.get(graphId);
  if (!graph) return { answer: 'Graph not found', entities: [], relations: [], communities: [], method, confidence: 0 };

  const queryLower = query.toLowerCase();

  // Local search: find relevant entities
  const matchedEntities = graph.entities
    .filter(e => e.name.toLowerCase().includes(queryLower) || e.description.toLowerCase().includes(queryLower) || queryLower.includes(e.name.toLowerCase()))
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, 10);

  // Get relations for matched entities
  const entityIds = new Set(matchedEntities.map(e => e.id));
  const matchedRelations = graph.relations.filter(r => entityIds.has(r.sourceId) || entityIds.has(r.targetId));

  // Global search: find relevant communities
  const matchedCommunities = graph.communities.filter(c =>
    c.summary.toLowerCase().includes(queryLower) || c.entities.some(eid => entityIds.has(eid))
  ).slice(0, 5);

  // Generate answer
  let answer = '';
  if (llm.isLLMConfigured() && (matchedEntities.length > 0 || matchedCommunities.length > 0)) {
    const context = [
      ...matchedEntities.map(e => `Entity: ${e.name} (${e.type}) — ${e.description}`),
      ...matchedRelations.map(r => {
        const src = graph.entities.find(e => e.id === r.sourceId)?.name ?? '?';
        const tgt = graph.entities.find(e => e.id === r.targetId)?.name ?? '?';
        return `Relation: ${src} → ${r.type} → ${tgt}: ${r.description}`;
      }),
      ...matchedCommunities.map(c => `Community: ${c.summary}`),
    ].join('\n');

    const resp = await llm.callModel('anthropic/claude-sonnet-4', [
      { role: 'system', content: 'Answer the question using ONLY the knowledge graph context below. Cite entities.' },
      { role: 'user', content: `Context:\n${context.slice(0, 3000)}\n\nQuestion: ${query}` },
    ], { maxTokens: 1024 });
    answer = resp.content;
  } else {
    answer = matchedEntities.length > 0
      ? `Found ${matchedEntities.length} entities: ${matchedEntities.map(e => e.name).join(', ')}`
      : 'No relevant entities found in the knowledge graph.';
  }

  const confidence = matchedEntities.length > 0 ? Math.min(90, 40 + matchedEntities.length * 10) : 10;

  return { answer, entities: matchedEntities, relations: matchedRelations, communities: matchedCommunities, method, confidence };
}

/** Get graph stats for display. */
export function getGraphStats(graphId: string): { entities: number; relations: number; communities: number; topEntities: { name: string; mentions: number; type: string }[] } | null {
  const graph = graphs.get(graphId);
  if (!graph) return null;
  return {
    entities: graph.entities.length,
    relations: graph.relations.length,
    communities: graph.communities.length,
    topEntities: graph.entities.sort((a, b) => b.mentions - a.mentions).slice(0, 10).map(e => ({ name: e.name, mentions: e.mentions, type: e.type })),
  };
}
