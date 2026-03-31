export interface KnowledgeBase { id: string; name: string; description: string; documents: number; chunks: number; lastSync: string; status: 'synced' | 'syncing' | 'error' | 'pending'; vectorDb: string; embeddingModel: string; owner: string; }

export const knowledgeBases: KnowledgeBase[] = [
  { id: '1', name: 'Documentação Técnica', description: 'Manuais de produto, APIs e guias de integração', documents: 342, chunks: 8450, lastSync: '2026-03-30 08:15', status: 'synced', vectorDb: 'pgvector', embeddingModel: 'text-embedding-3-large', owner: 'Marina Costa' },
  { id: '2', name: 'Políticas Internas 2026', description: 'RH, compliance, segurança da informação e processos', documents: 142, chunks: 3890, lastSync: '2026-03-30 07:00', status: 'synced', vectorDb: 'Pinecone', embeddingModel: 'text-embedding-3-small', owner: 'Bruno Almeida' },
  { id: '3', name: 'Base Jurídica', description: 'Contratos, regulamentos, jurisprudência e pareceres', documents: 89, chunks: 4210, lastSync: '2026-03-29 22:30', status: 'syncing', vectorDb: 'Weaviate', embeddingModel: 'text-embedding-3-large', owner: 'Bruno Almeida' },
  { id: '4', name: 'Contratos Q1 2026', description: 'Contratos comerciais do primeiro trimestre', documents: 56, chunks: 0, lastSync: 'Nunca', status: 'error', vectorDb: 'pgvector', embeddingModel: 'text-embedding-3-small', owner: 'Juliana Santos' },
  { id: '5', name: 'FAQ Suporte', description: 'Perguntas frequentes e resoluções de tickets', documents: 1240, chunks: 15600, lastSync: '2026-03-30 09:00', status: 'synced', vectorDb: 'Qdrant', embeddingModel: 'text-embedding-3-small', owner: 'Marina Costa' },
];
