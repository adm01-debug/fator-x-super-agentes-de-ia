/**
 * Zod validation schemas for all dialog forms.
 * Centralised validation = single source of truth.
 */
import { z } from 'zod';

export const inviteMemberSchema = z.object({
  email: z.string().trim().min(1, 'Email é obrigatório').email('Email inválido').max(255, 'Email muito longo'),
  name: z.string().trim().max(100, 'Nome muito longo').optional(),
  role: z.enum(['admin', 'editor', 'viewer', 'operator'], { required_error: 'Selecione um papel' }),
});
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const createKnowledgeBaseSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório').max(200, 'Nome muito longo'),
  description: z.string().trim().max(1000, 'Descrição muito longa').optional(),
  vectorDb: z.enum(['pgvector', 'pinecone']),
  embeddingModel: z.enum(['text-embedding-3-large', 'text-embedding-3-small']),
});
export type CreateKnowledgeBaseInput = z.infer<typeof createKnowledgeBaseSchema>;

export const editKnowledgeBaseSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório').max(200, 'Nome muito longo'),
  description: z.string().trim().max(1000, 'Descrição muito longa').optional(),
  embeddingModel: z.enum(['text-embedding-3-large', 'text-embedding-3-small']),
  status: z.enum(['active', 'inactive', 'indexing']),
});
export type EditKnowledgeBaseInput = z.infer<typeof editKnowledgeBaseSchema>;

export const createEvaluationSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório').max(200, 'Nome muito longo'),
  agentId: z.string().uuid('Selecione um agente'),
  datasetId: z.string().optional(),
  testCases: z.coerce.number().int().min(1, 'Mínimo 1').max(100, 'Máximo 100'),
  useJudge: z.boolean(),
  judgeMode: z.enum(['pointwise', 'faithfulness']),
});
export type CreateEvaluationInput = z.infer<typeof createEvaluationSchema>;

export const createPromptSchema = z.object({
  agentId: z.string().uuid('Selecione um agente'),
  content: z.string().trim().min(1, 'Conteúdo é obrigatório').max(50000, 'Prompt muito longo'),
  summary: z.string().trim().max(500, 'Descrição muito longa').optional(),
});
export type CreatePromptInput = z.infer<typeof createPromptSchema>;
