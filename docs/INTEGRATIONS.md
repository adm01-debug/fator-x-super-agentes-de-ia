# Guia de Integrações - Nexus Agents Studio

Este documento descreve todas as integrações externas do sistema, incluindo configuração, variáveis de ambiente, limites de uso e boas práticas.

---

## Índice

1. [OpenRouter (LLM Gateway)](#1-openrouter-llm-gateway)
2. [Anthropic (Direto)](#2-anthropic-direto)
3. [Supabase](#3-supabase)
4. [OpenClaw](#4-openclaw)
5. [Bitrix24 CRM](#5-bitrix24-crm)
6. [n8n (Automação)](#6-n8n-automação)
7. [Variáveis de Ambiente - Resumo](#7-variáveis-de-ambiente---resumo)

---

## 1. OpenRouter (LLM Gateway)

### Finalidade

O OpenRouter é o **gateway principal de LLMs** do Nexus Agents Studio. Ele funciona como um proxy unificado que roteia chamadas para múltiplos provedores (Anthropic, OpenAI, Google, Meta, DeepSeek) com uma única API key. É a opção recomendada para o módulo **Oráculo** (council multi-modelo) e para chamadas gerais de LLM.

### Configuração

1. Acesse [https://openrouter.ai](https://openrouter.ai) e crie uma conta.
2. Gere uma API key no painel (formato: `sk-or-v1-...`).
3. Adicione a chave ao arquivo `.env`:

```env
VITE_OPENROUTER_API_KEY=sk-or-v1-...sua-chave-aqui
```

4. A chave é carregada automaticamente pelo `llmService.ts` via `import.meta.env.VITE_OPENROUTER_API_KEY`.
5. Alternativamente, o usuário pode configurar a chave via **Settings > API Keys** na interface (armazenada apenas em memória, nunca em localStorage por segurança).

### Modelos Disponíveis

| ID do Modelo | Nome | Provedor | Custo/1K Tokens |
|---|---|---|---|
| `anthropic/claude-sonnet-4` | Claude Sonnet 4 | Anthropic | $0.003 |
| `anthropic/claude-opus-4` | Claude Opus 4 | Anthropic | $0.015 |
| `openai/gpt-4o` | GPT-4o | OpenAI | $0.005 |
| `openai/gpt-4o-mini` | GPT-4o Mini | OpenAI | $0.00015 |
| `google/gemini-2.0-flash-001` | Gemini 2.0 Flash | Google | $0.0001 |
| `google/gemini-2.5-pro-preview` | Gemini 2.5 Pro | Google | $0.007 |
| `deepseek/deepseek-chat-v3-0324` | DeepSeek V3 | DeepSeek | $0.0005 |
| `meta-llama/llama-4-maverick` | Llama 4 Maverick | Meta | $0.0005 |

### Rate Limits e Preços

- Os rate limits dependem do seu plano no OpenRouter (free, pro, enterprise).
- O custo é por token, variando conforme o modelo (veja tabela acima).
- Timeout padrão: **30 segundos** por chamada (`AbortSignal.timeout(30000)`).
- O Oráculo envia chamadas em paralelo para N modelos; o custo total é a soma de todas as chamadas + a chamada de síntese.

### Endpoint

```
POST https://openrouter.ai/api/v1/chat/completions
```

Headers obrigatórios:
```
Authorization: Bearer {VITE_OPENROUTER_API_KEY}
Content-Type: application/json
HTTP-Referer: {window.location.origin}
X-Title: Nexus Agents Studio
```

### Variável de Ambiente

| Variável | Onde Usar | Exemplo |
|---|---|---|
| `VITE_OPENROUTER_API_KEY` | Frontend (Vite) | `sk-or-v1-abc123...` |
| `OPENROUTER_API_KEY` | Edge Functions (Deno) | `sk-or-v1-abc123...` |

---

## 2. Anthropic (Direto)

### Quando Usar Direto vs OpenRouter

| Cenário | Recomendação |
|---|---|
| Chamadas multi-modelo (Oráculo) | OpenRouter |
| Agente exclusivo Claude | Direto ou OpenRouter |
| Edge Function `llm-gateway` | Direto (via `ANTHROPIC_API_KEY`) |
| Menor latência com Claude | Direto |
| Gestão unificada de billing | OpenRouter |

O Edge Function `llm-gateway` usa roteamento automático: modelos que começam com `claude` vão para a API direta da Anthropic; todos os outros vão para o OpenRouter.

### Configuração da API Key

1. Acesse [https://console.anthropic.com](https://console.anthropic.com).
2. Gere uma API key (formato: `sk-ant-...`).
3. Configure no Supabase Secrets (para Edge Functions):

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...sua-chave
```

4. Na interface, selecione "Anthropic" como provedor em **Settings > API Keys**.

### Modelos Disponíveis (API Direta)

| Modelo | Uso Recomendado |
|---|---|
| `claude-sonnet-4-20250514` | Modelo padrão para agentes (default do `llm-gateway`) |
| `claude-opus-4` | Tarefas complexas, raciocínio avançado |
| `claude-haiku-4.5` | Respostas rápidas, baixo custo |

### Endpoint

```
POST https://api.anthropic.com/v1/messages
```

Headers obrigatórios:
```
x-api-key: {ANTHROPIC_API_KEY}
Content-Type: application/json
anthropic-version: 2023-06-01
```

Para chamadas do frontend (browser), adicionar:
```
anthropic-dangerous-direct-browser-access: true
```

### Variável de Ambiente

| Variável | Onde Usar |
|---|---|
| `ANTHROPIC_API_KEY` | Edge Functions (Deno env) |

---

## 3. Supabase

### Finalidade

O Supabase é a **infraestrutura core** do Nexus Agents Studio, fornecendo:
- **Banco de dados PostgreSQL** (38 tabelas)
- **Autenticação** (auth.users com trigger automático de workspace)
- **Row Level Security** (RLS) em todas as tabelas
- **Edge Functions** (llm-gateway, rag-ingest, test-runner, lgpd-delete)
- **pgvector** para embeddings e busca semântica
- **Realtime** para atualizações em tempo real

### Setup do Projeto

#### 1. Criar Projeto no Supabase

```bash
# Instalar CLI
npm install -g supabase

# Login
supabase login

# Criar projeto (ou linkar a existente)
supabase init
supabase link --project-ref SEU_PROJECT_ID
```

#### 2. Configurar Variáveis de Ambiente

```env
VITE_SUPABASE_PROJECT_ID=seu-project-id
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...sua-anon-key
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
```

#### 3. Executar Migrations

```bash
# Aplicar todas as migrations (001 a 011)
supabase db push

# Ou via migration direta
supabase migration up
```

#### 4. Gerar Tipos TypeScript

```bash
npm run types:gen
# Equivale a: supabase gen types typescript --project-id $VITE_SUPABASE_PROJECT_ID > src/types/supabase-generated.ts
```

### Configuração de Autenticação

O sistema usa Supabase Auth com as seguintes características:

- **Trigger automático**: ao criar um usuário (`auth.users INSERT`), a função `handle_new_user()` cria automaticamente um workspace e adiciona o usuário como `admin`.
- **Provedores**: configuráveis no Dashboard do Supabase (email/senha, Google, GitHub, etc.).
- **Client**: inicializado em `src/integrations/supabase/client.ts` usando `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`.

### Visão Geral das Políticas RLS

Todas as 38 tabelas têm RLS habilitado. O padrão de isolamento é baseado em **workspace membership**:

| Padrão de RLS | Tabelas | Regra |
|---|---|---|
| Via `workspace_id` direto | `agents`, `workspaces`, `workspace_secrets`, `knowledge_bases`, `evaluation_runs`, `datahub_connections`, etc. | `workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())` |
| Via FK intermediária | `datahub_table_schemas`, `datahub_query_log`, `db_discovered_tables` | JOIN pela `connection_id` ou `database_id` até o `workspace_id` |
| Por `user_id` direto | `agent_traces`, `agent_usage` | `user_id = auth.uid()` |
| Público (somente leitura) | `agent_templates` | `is_public = true` |

**Regras de permissão por role**:
- `admin`: CRUD completo em todas as tabelas do workspace
- `editor`: SELECT + INSERT + UPDATE (sem DELETE em tabelas críticas como secrets)
- `viewer`: somente SELECT
- `operator`: somente SELECT

### Deploy de Edge Functions

```bash
# Deploy individual
supabase functions deploy llm-gateway
supabase functions deploy rag-ingest
supabase functions deploy test-runner
supabase functions deploy lgpd-delete

# Configurar secrets para Edge Functions
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set OPENROUTER_API_KEY=sk-or-v1-...
supabase secrets set SUPABASE_URL=https://seu-projeto.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

#### Edge Functions Disponíveis

| Função | Finalidade |
|---|---|
| `llm-gateway` | Proxy de LLM com roteamento automático Anthropic/OpenRouter, logging de uso e estimativa de custo |
| `rag-ingest` | Ingestão e chunking de documentos para knowledge bases com pgvector |
| `test-runner` | Execução de testes automatizados de agentes |
| `lgpd-delete` | Exclusão de dados pessoais conforme LGPD |

### Variáveis de Ambiente

| Variável | Onde Usar | Descrição |
|---|---|---|
| `VITE_SUPABASE_PROJECT_ID` | Frontend | ID do projeto (usado para gerar tipos) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Frontend | Anon key (público, com RLS) |
| `VITE_SUPABASE_URL` | Frontend | URL do projeto Supabase |
| `SUPABASE_URL` | Edge Functions | URL interna do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions | Service role key (bypassa RLS) |

---

## 4. OpenClaw

### O Que É

O OpenClaw é um **canal de deploy para agentes** (conforme ADR 005). Ele permite publicar agentes construídos no Nexus para canais de comunicação (WhatsApp, Telegram, Slack, Discord, Web Chat) usando um formato padronizado de `SOUL.md` + `SKILL.md`.

O OpenClaw NÃO é infraestrutura core; é uma opção de deploy entre outras.

### Setup no Hostinger VPS

1. Acesse seu VPS no Hostinger.
2. Instale o OpenClaw:

```bash
npx openclaw@latest
```

3. Configure o LLM provider dentro do OpenClaw (ele tem sua própria configuração de API keys).
4. O gateway padrão fica disponível em: `https://openclaw-sbem.srv1481814.hstgr.cloud`

### Formato SOUL.md + SKILL.md

#### SOUL.md

Define a **personalidade e regras** do agente. Gerado automaticamente a partir da configuração do Nexus:

```markdown
# Nome do Agente

## Persona
Assistente profissional

## Mission
Ajudar o usuário com suas necessidades

## Scope
Responder perguntas e executar tarefas dentro do escopo definido

## Rules
1. Sempre responda na língua do usuário
2. Nunca invente informações
3. Escale para humano quando fora do escopo
4. Tom: Formal e profissional
5. Estilo: Respostas concisas e diretas

## Tone
Formal e profissional

## Language
pt-BR

## Constraints
- Não revelar dados pessoais de terceiros (LGPD)
- Não executar ações destrutivas sem confirmação
- Respeitar limites de escopo definidos

## Fallback
Desculpe, não consigo ajudar com isso. Vou encaminhar para um atendente humano.
```

#### SKILL.md

Define uma **capacidade/integração** do agente:

```markdown
# Nome da Skill

## Description
Descrição da capacidade

## Endpoint
https://api.exemplo.com/v1/action

## Parameters
- **query** (string, required): Input principal
- **limit** (number, optional): Máximo de resultados

## Authentication
Bearer token in Authorization header
```

### Configuração de Gateway URL + Token

```env
VITE_OPENCLAW_GATEWAY_URL=https://your-openclaw-instance.hstgr.cloud
VITE_OPENCLAW_API_TOKEN=your-openclaw-token
```

### API do Gateway

| Endpoint | Método | Descrição |
|---|---|---|
| `/api/sessions/{sessionId}/messages` | POST | Enviar mensagem para o agente |
| `/api/sessions/{sessionId}` | GET | Histórico da sessão |
| `/api/health` | GET | Health check (retorna `{ version }`) |

Headers:
```
Content-Type: application/json
Authorization: Bearer {VITE_OPENCLAW_API_TOKEN}
```

Timeout padrão: **10 segundos** por chamada.

### Canais Suportados

- WhatsApp
- Telegram
- Slack
- Discord
- Web Chat

### Deploy via Interface

O módulo de deploy (`DeployModule.tsx`) gera automaticamente o pacote SOUL.md + SKILL.md e oferece download direto.

### Variáveis de Ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `VITE_OPENCLAW_GATEWAY_URL` | Não | URL do gateway (default: `https://openclaw-sbem.srv1481814.hstgr.cloud`) |
| `VITE_OPENCLAW_API_TOKEN` | Não | Token de autenticação para o gateway |

---

## 5. Bitrix24 CRM

### Finalidade

O Bitrix24 é integrado como **CRM externo** para operações de vendas, atendimento e gestão de leads. A integração está disponível via servidor MCP (Model Context Protocol) com mais de 50 ferramentas disponíveis.

### Configuração OAuth2

1. Acesse o painel de administração do Bitrix24.
2. Navegue para **Aplicações > Developer resources > OAuth 2.0**.
3. Registre uma nova aplicação:
   - **Redirect URI**: `https://seu-domínio.com/oauth/callback`
   - **Scopes**: `crm`, `task`, `calendar`, `disk`, `department`
4. Anote o `client_id` e `client_secret`.

### Configuração de Webhook

Alternativamente, use webhooks (mais simples para integrações internas):

1. No Bitrix24, vá para **Aplicações > Webhooks > Inbound webhook**.
2. Selecione as permissões necessárias.
3. Copie a URL do webhook (formato: `https://seu-domínio.bitrix24.com.br/rest/USER_ID/WEBHOOK_TOKEN/`).

### Rate Limits

| Limite | Valor |
|---|---|
| Requisições por segundo | **50 req/seg** |
| Batch (lote) | Até 50 comandos por chamada batch |
| Tempo de execução de webhook | 30 segundos |

### Entidades Disponíveis

O servidor MCP do Bitrix24 expõe as seguintes operações:

#### CRM
| Ferramenta MCP | Entidade | Operações |
|---|---|---|
| `b24_deal_create`, `b24_deal_get`, `b24_deal_list`, `b24_deal_update` | Negócios (Deals) | CRUD completo |
| `b24_contact_create`, `b24_contact_search`, `b24_contact_update` | Contatos | Criar, buscar, atualizar |
| `b24_lead_create`, `b24_lead_list` | Leads | Criar, listar |
| `b24_company_create`, `b24_company_get`, `b24_company_list`, `b24_company_update` | Empresas | CRUD completo |
| `b24_invoice_list` | Faturas | Listar |
| `b24_quote_list` | Orçamentos | Listar |
| `b24_stages_list` | Funis/Estágios | Listar |
| `b24_category_list` | Categorias | Listar |

#### Tarefas e Projetos
| Ferramenta MCP | Operações |
|---|---|
| `b24_task_create`, `b24_task_get`, `b24_task_list`, `b24_task_update` | CRUD de tarefas |
| `b24_task_complete` | Completar tarefa |
| `b24_task_comment`, `b24_task_checklist` | Comentários e checklists |

#### Calendário e Comunicação
| Ferramenta MCP | Operações |
|---|---|
| `b24_calendar_event_create`, `b24_calendar_event_list` | Eventos de calendário |
| `b24_chat_message_send` | Enviar mensagem no chat |
| `b24_notify_send` | Enviar notificação |

#### Automação (BizProc)
| Ferramenta MCP | Operações |
|---|---|
| `b24_bizproc_workflow_start` | Iniciar workflow |
| `b24_bizproc_task_list` | Listar tarefas de workflow |

#### Outros
| Ferramenta MCP | Operações |
|---|---|
| `b24_user_current`, `b24_user_list` | Usuários |
| `b24_department_list` | Departamentos |
| `b24_product_create`, `b24_product_get`, `b24_product_list`, `b24_product_search`, `b24_product_update` | Produtos |
| `b24_catalog_list` | Catálogos |
| `b24_disk_storage_list`, `b24_disk_folder_list` | Armazenamento (Disk) |
| `b24_activity_create`, `b24_activity_list` | Atividades |
| `b24_timeline_add` | Linha do tempo |
| `b24_timeman_open`, `b24_timeman_close`, `b24_timeman_status` | Controle de ponto |
| `b24_userfields_list` | Campos customizados |
| `b24_server_info` | Informações do servidor |
| `b24_batch` | Operações em lote |
| `b24_spa_item_create`, `b24_spa_item_get`, `b24_spa_item_list`, `b24_spa_item_update` | Smart Process Automation |
| `b24_lists_get`, `b24_lists_element_create`, `b24_lists_element_list` | Listas universais |

---

## 6. n8n (Automação)

### Finalidade

O n8n é utilizado como **motor de automação de workflows** integrado ao Nexus via servidor MCP. Permite criar fluxos automatizados que reagem a eventos do sistema (deploy de agentes, conclusão de testes, etc.).

### Configuração de Webhook URL

Os webhooks do n8n são configurados como triggers no sistema de CI/CD (`cicdService.ts`):

```typescript
// Tipos de trigger disponíveis
type TriggerType = 'cron' | 'webhook' | 'event';

// Exemplo de criação de trigger webhook
addTrigger({
  name: 'Notificar deploy',
  type: 'webhook',
  webhookUrl: 'https://seu-n8n.com/webhook/abc123',
  agentId: 'agent-uuid',
  enabled: true,
});
```

### Triggers Disponíveis

| Evento | Descrição | Uso Típico |
|---|---|---|
| `agent.deploy` | Agente promovido para staging/produção | Notificar equipe, atualizar CRM |
| `test.complete` | Testes automatizados concluídos | Relatório de qualidade, aprovação automática |
| `pipeline.passed` | Pipeline CI/CD passou todas as etapas | Auto-promote para produção |
| `pipeline.failed` | Pipeline CI/CD falhou | Notificar responsável, abrir ticket |
| `cron` | Execução agendada | Relatórios periódicos, health checks |

### Ferramentas MCP do n8n

O servidor MCP do n8n fornece gestão completa de workflows:

| Ferramenta MCP | Descrição |
|---|---|
| `n8n_workflow_create` | Criar novo workflow |
| `n8n_workflow_get` | Obter detalhes de um workflow |
| `n8n_workflow_list` | Listar todos os workflows |
| `n8n_workflow_update` | Atualizar workflow existente |
| `n8n_workflow_delete` | Excluir workflow |
| `n8n_workflow_activate` | Ativar workflow |
| `n8n_workflow_deactivate` | Desativar workflow |
| `n8n_workflow_execute` | Executar workflow manualmente |
| `n8n_workflow_import_json` | Importar workflow via JSON |
| `n8n_execution_get` | Detalhes de uma execução |
| `n8n_execution_list` | Listar execuções |
| `n8n_execution_delete` | Excluir registro de execução |
| `n8n_credential_create` | Criar credencial |
| `n8n_credential_list` | Listar credenciais |
| `n8n_credential_delete` | Excluir credencial |
| `n8n_variable_create` | Criar variável de ambiente |
| `n8n_variable_list` | Listar variáveis |
| `n8n_variable_update` | Atualizar variável |
| `n8n_variable_delete` | Excluir variável |
| `n8n_tag_create` | Criar tag |
| `n8n_tag_list` | Listar tags |
| `n8n_user_list` | Listar usuários |
| `n8n_server_info` | Informações do servidor |

### Configuração de Credenciais

As credenciais no n8n são gerenciadas via MCP:

```
# Credenciais típicas para integração com Nexus
- SSH: Para deploy em VPS (OpenClaw)
- API Keys: OpenRouter, Anthropic, Supabase
- OAuth2: Bitrix24, Google Workspace
- Webhook Secrets: Para autenticar chamadas de volta
```

### Exemplo de Workflow

Fluxo típico: **Agente passa no CI/CD -> Deploy automático**

1. Trigger: Webhook recebe evento `pipeline.passed`
2. Filtro: Verificar se `status === 'passed'` e `promotedTo === 'production'`
3. Ação: Chamar API do OpenClaw para deploy
4. Notificação: Enviar mensagem no Bitrix24 chat

---

## 7. Variáveis de Ambiente - Resumo

### Arquivo `.env` (Frontend)

```env
# Supabase
VITE_SUPABASE_PROJECT_ID=your-project-id
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...your-anon-key
VITE_SUPABASE_URL=https://your-project.supabase.co

# LLM Providers
VITE_OPENROUTER_API_KEY=sk-or-v1-...your-openrouter-key

# OpenClaw Gateway (opcional)
VITE_OPENCLAW_GATEWAY_URL=https://your-openclaw-instance.hstgr.cloud
VITE_OPENCLAW_API_TOKEN=your-openclaw-token
```

### Supabase Secrets (Edge Functions)

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set OPENROUTER_API_KEY=sk-or-v1-...
supabase secrets set SUPABASE_URL=https://...
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### Segurança

- API keys do frontend são mantidas **apenas em memória** (nunca salvas em localStorage).
- A variável `VITE_OPENROUTER_API_KEY` no `.env` é a exceção, pois o Vite a injeta em build time.
- Secrets sensíveis devem estar apenas nas Edge Functions (via `supabase secrets set`).
- O serviço `workspace_secrets` armazena chaves encriptadas no banco, com uma view segura (`workspace_secrets_safe`) que nunca expõe o valor completo.
