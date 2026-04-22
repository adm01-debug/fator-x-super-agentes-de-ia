/**
 * ═══════════════════════════════════════════════════════════════
 * Nexus Agents Studio — Knowledge Base Seeds
 * ═══════════════════════════════════════════════════════════════
 * Definições de Knowledge Bases "canônicas" para a Promo Brindes:
 * cada KB descreve:
 *   - sua identidade (id, nome, descrição),
 *   - que tipos de documento espera receber,
 *   - quais agentes dos 7 enriquecidos devem consumi-la via RAG.
 *
 * Esse arquivo não cria KBs no banco por si só — ele é a fonte única
 * de verdade consumida por:
 *   (a) `KnowledgeBaseSetupPage` para mostrar ao admin QUAIS KBs
 *       precisam ser criadas e com QUE docs,
 *   (b) `buildAgentFromTemplate` ao forkar, injetando os `rag_sources`
 *       apropriados em `AgentConfig.rag_sources[]`,
 *   (c) teste de cobertura garantindo que todo agente enriquecido
 *       referencia pelo menos 1 KB que existe nos seeds.
 *
 * Fluxo esperado ao operar:
 *   1. Admin consulta este arquivo, sobe os docs no Storage.
 *   2. Chama `rag-ingest` edge function apontando para os docs.
 *   3. KB fica `active` em `public.knowledge_bases` com `id = kb_*`.
 *   4. Ao forkar um agente, os `rag_sources` apontam para essas KBs
 *      automaticamente via `intended_agents`.
 */

import type { RAGSource } from '@/types/agentTypes';

export type KnowledgeBaseDocType =
  | 'pdf'
  | 'docx'
  | 'csv'
  | 'url'
  | 'notion'
  | 'google_drive'
  | 'confluence'
  | 'database'
  | 'api';

export interface KnowledgeBaseSeed {
  /** ID estável usado como `id` em `public.knowledge_bases` e no `rag_sources[].id` dos agentes. */
  id: string;
  /** Nome legível exibido na UI. */
  name: string;
  /** Descrição curta do conteúdo e uso esperado. */
  description: string;
  /** Emoji/ícone para listagem na UI. */
  icon: string;
  /** IDs dos agentes (de `agentTemplates.ts`) que consomem esta KB via `search_knowledge`. */
  intended_agents: string[];
  /** Docs esperados: admin deve subir ao menos 1 de cada categoria para a KB ficar "funcional". */
  suggested_docs: Array<{
    category: string;
    description: string;
    types: KnowledgeBaseDocType[];
    /** Marque como essencial quando o agente falha em operar bem sem esse doc. */
    essential: boolean;
  }>;
  /** Frequência de re-sync para fontes externas (google_drive, notion, url). */
  sync_frequency: RAGSource['sync_frequency'];
  /** Tags para filtro na UI. */
  tags: string[];
}

export const KNOWLEDGE_BASE_SEEDS: KnowledgeBaseSeed[] = [
  {
    id: 'kb_catalog_products',
    name: 'Catálogo de Produtos',
    description:
      'Manuais, fichas técnicas e matriz de preços dos produtos da Promo Brindes. Base para quote_generator calcular cotações corretas e sales_assistant sugerir produtos adequados.',
    icon: '📦',
    intended_agents: ['quote_generator', 'sales_assistant', 'customer_support'],
    suggested_docs: [
      {
        category: 'Fichas técnicas por SKU',
        description:
          'PDF de cada SKU com dimensões, peso, material, compatibilidade de técnicas de gravação.',
        types: ['pdf'],
        essential: true,
      },
      {
        category: 'Matriz de preços',
        description:
          'Planilha com preço base + faixas de desconto por volume (5% ≥ 250un, 8% ≥ 500un, 12% ≥ 1000un, 15% ≥ 2500un).',
        types: ['csv', 'pdf'],
        essential: true,
      },
      {
        category: 'Política de compatibilidade de gravação',
        description:
          'Tabela de quais técnicas (laser CO2/Fiber/UV, DTF, silk, UV flatbed) cada material aceita.',
        types: ['pdf'],
        essential: true,
      },
      {
        category: 'Catálogo visual',
        description: 'Imagens + descrições comerciais (para sugestão na UI do co-piloto).',
        types: ['pdf', 'url'],
        essential: false,
      },
    ],
    sync_frequency: 'weekly',
    tags: ['produtos', 'preços', 'gravação'],
  },

  {
    id: 'kb_commercial_playbook',
    name: 'Playbook Comercial',
    description:
      'Scripts, objeções comuns e respostas validadas, matriz de desconto por alçada, processo de aprovação HITL. Alimenta spec_vendas_closer e spec_vendas_sdr.',
    icon: '📖',
    intended_agents: ['spec_vendas_closer', 'spec_vendas_sdr', 'sales_assistant', 'lead_qualifier'],
    suggested_docs: [
      {
        category: 'Playbook de objeções',
        description:
          'Top 20 objeções + argumentos validados ("caro", "prazo", "já temos fornecedor", "vou pensar", etc.).',
        types: ['pdf', 'notion'],
        essential: true,
      },
      {
        category: 'Matriz de desconto',
        description:
          'Alçadas de desconto por ticket: <12% auto, 12-20% HITL, >20% gerente/diretor.',
        types: ['pdf', 'csv'],
        essential: true,
      },
      {
        category: 'Scripts de cadência SDR',
        description:
          'Templates de e-mail D1, D3, D7, D12 por ICP (eventos, RH corporativo, marketing promocional).',
        types: ['docx', 'notion'],
        essential: true,
      },
      {
        category: 'ICP e personas',
        description: 'Documentação do ICP por porte, setor, cargo decisor.',
        types: ['pdf', 'notion'],
        essential: false,
      },
    ],
    sync_frequency: 'weekly',
    tags: ['vendas', 'playbook', 'objeções'],
  },

  {
    id: 'kb_quotes_history',
    name: 'Histórico de Cotações',
    description:
      'Cotações fechadas nos últimos 24 meses: padrões de precificação por cliente/segmento, taxas de conversão por tier, margens realizadas. Essencial para memory_procedural do quote_generator.',
    icon: '💰',
    intended_agents: ['quote_generator', 'spec_vendas_closer', 'spec_vendas_intel'],
    suggested_docs: [
      {
        category: 'Export de cotações fechadas',
        description:
          'CSV com: cliente, SKU, qtd, técnica, preço unitário, desconto, fechou/perdeu, motivo.',
        types: ['csv', 'database'],
        essential: true,
      },
      {
        category: 'Análise de perdas',
        description:
          'Motivos textuais de cotações perdidas (preço, prazo, concorrente, cliente desistiu).',
        types: ['csv', 'database'],
        essential: false,
      },
    ],
    sync_frequency: 'daily',
    tags: ['cotações', 'precificação', 'histórico'],
  },

  {
    id: 'kb_customer_success',
    name: 'Cases de Sucesso',
    description:
      'Histórias de clientes fechados organizadas por setor. SDR usa em cold e-mails ("tivemos resultado similar na X"); closer usa para quebrar objeção "nunca trabalharam com empresas como a nossa".',
    icon: '🏆',
    intended_agents: ['spec_vendas_sdr', 'spec_vendas_closer', 'sales_assistant'],
    suggested_docs: [
      {
        category: 'Cases por setor',
        description:
          '1 one-pager por case: contexto, desafio, solução Promo, resultado mensurável.',
        types: ['pdf', 'google_drive'],
        essential: true,
      },
      {
        category: 'Depoimentos de clientes',
        description: 'Vídeos curtos + transcrições + autorização de uso.',
        types: ['url', 'pdf'],
        essential: false,
      },
    ],
    sync_frequency: 'weekly',
    tags: ['cases', 'social-proof', 'vendas'],
  },

  {
    id: 'kb_production_matrix',
    name: 'Matriz de Produção',
    description:
      'Prazos de produção por técnica de gravação (laser CO2/Fiber/UV, DTF, silk, UV flatbed, tampografia) e tipo de material. quote_generator usa para nunca inventar prazo.',
    icon: '⚙️',
    intended_agents: ['quote_generator', 'customer_support', 'sales_assistant'],
    suggested_docs: [
      {
        category: 'Matriz de prazos por técnica',
        description: 'Tabela de base_dias_sku + gravacao_dias + frete_dias por técnica e volume.',
        types: ['csv', 'pdf'],
        essential: true,
      },
      {
        category: 'Capacidade instalada',
        description: 'Quantas peças/dia cada equipamento processa (laser CO2, Fiber, UV, DTF).',
        types: ['csv'],
        essential: true,
      },
      {
        category: 'SLAs de produção express',
        description: 'Política de produção express (+15% custo, janelas disponíveis).',
        types: ['pdf'],
        essential: false,
      },
    ],
    sync_frequency: 'weekly',
    tags: ['produção', 'prazos', 'capacidade'],
  },

  {
    id: 'kb_legal_policies',
    name: 'Políticas Jurídicas',
    description:
      'LGPD, CLT (para HR), templates de NDA, política de confidencialidade, cláusulas-padrão de contratos. closer consulta antes de aceitar cláusulas especiais.',
    icon: '⚖️',
    intended_agents: ['spec_vendas_closer', 'customer_support'],
    suggested_docs: [
      {
        category: 'Política LGPD',
        description: 'Procedimento interno de tratamento de PII, consent, opt-out.',
        types: ['pdf', 'notion'],
        essential: true,
      },
      {
        category: 'Templates de NDA',
        description: 'NDAs bilaterais e unilaterais padrão.',
        types: ['docx'],
        essential: true,
      },
      {
        category: 'Cláusulas-padrão',
        description: 'Biblioteca de cláusulas aprovadas pelo jurídico.',
        types: ['docx', 'notion'],
        essential: true,
      },
    ],
    sync_frequency: 'manual',
    tags: ['jurídico', 'compliance', 'LGPD'],
  },

  {
    id: 'kb_ops_procedures',
    name: 'Procedimentos Operacionais',
    description:
      'SOPs, fluxogramas BPMN, Kaizens registrados, políticas 5S. Base para o spec_vendas_intel identificar gargalos de produção ao analisar forecast.',
    icon: '🗂️',
    intended_agents: ['spec_vendas_intel', 'customer_support'],
    suggested_docs: [
      {
        category: 'SOPs por área',
        description:
          'Procedimentos-padrão de cada célula (comercial, produção, logística, compras).',
        types: ['pdf', 'confluence'],
        essential: true,
      },
      {
        category: 'Fluxogramas BPMN',
        description: 'Diagramas dos processos principais (cotação → produção → expedição).',
        types: ['pdf'],
        essential: false,
      },
      {
        category: 'Kaizens registrados',
        description: 'Log de melhorias implementadas e ganhos medidos.',
        types: ['csv', 'confluence'],
        essential: false,
      },
    ],
    sync_frequency: 'weekly',
    tags: ['processos', 'kaizen', 'ops'],
  },
];

/** Retorna as KB ids que um agente específico consome. */
export function getKnowledgeBaseIdsForAgent(agentId: string): string[] {
  return KNOWLEDGE_BASE_SEEDS.filter((kb) => kb.intended_agents.includes(agentId)).map(
    (kb) => kb.id,
  );
}

/** Retorna todas as KBs indexadas por id (leitura rápida). */
export function getKnowledgeBaseSeed(id: string): KnowledgeBaseSeed | undefined {
  return KNOWLEDGE_BASE_SEEDS.find((kb) => kb.id === id);
}

/**
 * Converte as KBs de um agente em objetos `RAGSource[]` prontos para
 * `AgentConfig.rag_sources`. Cada RAGSource aponta para a KB pelo id —
 * a edge function `semantic-search` resolve para a tabela real via
 * `knowledge_bases.id = rag_sources[].id`.
 */
export function buildRagSourcesForAgent(agentId: string): RAGSource[] {
  return getKnowledgeBaseIdsForAgent(agentId).map((kbId) => {
    const seed = getKnowledgeBaseSeed(kbId)!;
    return {
      id: seed.id,
      name: seed.name,
      type: 'database' as const,
      location: `knowledge_bases/${seed.id}`,
      sync_frequency: seed.sync_frequency,
      enabled: true,
    };
  });
}
