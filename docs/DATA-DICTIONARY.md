# Dicionario de Dados — Nexus Agents Studio

> 38 tabelas no PostgreSQL 17 (Supabase) com pgvector + pg_trgm

## Legenda

- **PK** = Primary Key
- **FK** = Foreign Key
- **NN** = NOT NULL
- **UQ** = UNIQUE
- **RLS** = Row Level Security ativo

---

## Core — Agentes

### agents (RLS)
| Campo | Tipo | NN | Default | Descricao |
|-------|------|----|---------|-----------| 
| id | UUID | PK | gen_random_uuid() | Identificador unico |
| user_id | UUID FK auth.users | NN | | Criador do agente |
| workspace_id | UUID FK workspaces | | | Workspace do agente |
| name | TEXT | NN | | Nome do agente |
| mission | TEXT | | '' | Missao/objetivo |
| model | TEXT | | 'claude-sonnet-4' | Modelo LLM principal |
| persona | TEXT | | 'assistant' | Tipo de persona |
| reasoning | TEXT | | 'react' | Padrao de raciocinio |
| status | agent_status ENUM | | 'draft' | draft/testing/staging/production/deprecated |
| version | INT | | 1 | Versao da configuracao |
| avatar_emoji | TEXT | | | Emoji do avatar |
| tags | TEXT[] | | '{}' | Tags de classificacao |
| config | JSONB | | '{}' | Configuracao completa (60+ campos) |
| version_lock | INT | | 1 | Optimistic locking |
| created_at | TIMESTAMPTZ | | NOW() | Data de criacao |
| updated_at | TIMESTAMPTZ | | NOW() | Ultima atualizacao (trigger) |

### prompt_versions (RLS)
| Campo | Tipo | NN | Default | Descricao |
|-------|------|----|---------|-----------| 
| id | UUID | PK | gen_random_uuid() | |
| agent_id | UUID FK agents | NN | | Agente dono |
| prompt | TEXT | NN | | Conteudo do prompt |
| summary | TEXT | | | Resumo da versao |
| model | TEXT | | | Modelo usado |
| is_active | BOOLEAN | | true | Versao ativa |
| created_at | TIMESTAMPTZ | | NOW() | |

### agent_traces (RLS)
| Campo | Tipo | NN | Default | Descricao |
|-------|------|----|---------|-----------| 
| id | UUID | PK | gen_random_uuid() | |
| agent_id | UUID FK agents | NN | | |
| session_id | TEXT | | | ID da sessao |
| input | TEXT | | | Entrada do usuario |
| output | TEXT | | | Resposta do agente |
| model | TEXT | | | Modelo utilizado |
| tokens_in | INT | | 0 | Tokens de entrada |
| tokens_out | INT | | 0 | Tokens de saida |
| cost_usd | NUMERIC(10,4) | | 0 | Custo em USD |
| latency_ms | INT | | 0 | Latencia em ms |
| status | trace_level ENUM | | 'success' | success/error/blocked/timeout |
| metadata | JSONB | | '{}' | Dados extras |
| created_at | TIMESTAMPTZ | | NOW() | |

### agent_usage (RLS)
| Campo | Tipo | NN | Default | Descricao |
|-------|------|----|---------|-----------| 
| id | UUID | PK | gen_random_uuid() | |
| agent_id | UUID FK agents | NN | | |
| date | DATE | NN | | Data do uso |
| total_tokens | BIGINT | | 0 | Total de tokens |
| total_cost | NUMERIC(10,4) | | 0 | Custo total |
| request_count | INT | | 0 | Num de requisicoes |
| UQ | | | | (agent_id, date) |

---

## Workspaces — Multi-tenancy

### workspaces (RLS)
| Campo | Tipo | NN | Default | Descricao |
|-------|------|----|---------|-----------| 
| id | UUID | PK | gen_random_uuid() | |
| name | TEXT | NN | | Nome do workspace |
| owner_id | UUID FK auth.users | NN | | Dono |
| created_at | TIMESTAMPTZ | | NOW() | |
| updated_at | TIMESTAMPTZ | | NOW() | |

### workspace_members (RLS)
| Campo | Tipo | NN | Default | Descricao |
|-------|------|----|---------|-----------| 
| id | UUID | PK | gen_random_uuid() | |
| workspace_id | UUID FK workspaces | NN | | |
| user_id | UUID FK auth.users | NN | | |
| role | TEXT CHECK | | 'viewer' | admin/editor/viewer/operator |
| email | TEXT | | | Email do membro |
| created_at | TIMESTAMPTZ | | NOW() | |

### workspace_secrets (RLS)
| Campo | Tipo | NN | Default | Descricao |
|-------|------|----|---------|-----------| 
| id | UUID | PK | gen_random_uuid() | |
| workspace_id | UUID FK workspaces | NN | | |
| key_name | TEXT | NN | | Nome da chave |
| encrypted_value | TEXT | NN | | Valor criptografado |
| key_hint | TEXT | | | Dica (ultimos 4 chars) |
| UQ | | | | (workspace_id, key_name) |
| created_at | TIMESTAMPTZ | | NOW() | |

---

## Knowledge — RAG

### knowledge_bases (RLS)
| Campo | Tipo | NN | Default | Descricao |
|-------|------|----|---------|-----------| 
| id | UUID | PK | gen_random_uuid() | |
| workspace_id | UUID FK workspaces | NN | | |
| name | TEXT | NN | | Nome da base |
| description | TEXT | | | Descricao |
| document_count | INT | | 0 | Num de documentos |
| status | TEXT | | 'active' | Status |
| created_at | TIMESTAMPTZ | | NOW() | |

### knowledge_base_chunks (RLS)
| Campo | Tipo | NN | Default | Descricao |
|-------|------|----|---------|-----------| 
| id | UUID | PK | gen_random_uuid() | |
| kb_id | UUID FK knowledge_bases | | | Base de conhecimento |
| content | TEXT | NN | | Conteudo do chunk |
| embedding | vector(1536) | | | Embedding pgvector |
| metadata | JSONB | | '{}' | Metadados |
| workspace_id | UUID FK workspaces | | | |
| created_at | TIMESTAMPTZ | | NOW() | |

---

## Brain — Super Cerebro

### brain_facts (RLS)
| Campo | Tipo | NN | Default | Descricao |
|-------|------|----|---------|-----------| 
| id | UUID | PK | gen_random_uuid() | |
| collection_id | UUID FK brain_collections | | | Colecao |
| content | TEXT | | | Conteudo do fato |
| fact_type | TEXT | | | Tipo (episodic/semantic/procedural) |
| confidence | NUMERIC(3,2) | | 0.5 | Nivel de confianca |
| source | TEXT | | | Origem |
| workspace_id | UUID | | | |
| superseded_by | UUID FK brain_facts | | | Fato substituto (SET NULL on delete) |
| created_at | TIMESTAMPTZ | | NOW() | |

### brain_entities
| Campo | Tipo | NN | Default | Descricao |
|-------|------|----|---------|-----------| 
| id | UUID | PK | gen_random_uuid() | |
| name | TEXT | NN | | Nome da entidade |
| entity_type | TEXT | | | Tipo (person/org/concept) |
| workspace_id | UUID | | | |
| created_at | TIMESTAMPTZ | | NOW() | |

### brain_relationships
| Campo | Tipo | NN | Default | Descricao |
|-------|------|----|---------|-----------| 
| id | UUID | PK | gen_random_uuid() | |
| source_entity_id | UUID FK brain_entities | NN | | Entidade origem |
| target_entity_id | UUID FK brain_entities | NN | | Entidade destino |
| relation_type | TEXT | | | Tipo de relacao |
| weight | NUMERIC(3,2) | | 1.0 | Peso da relacao |
| workspace_id | UUID | | | |
| created_at | TIMESTAMPTZ | | NOW() | |

---

## Oracle — Multi-LLM Council

### oracle_queries
| Campo | Tipo | NN | Default | Descricao |
|-------|------|----|---------|-----------| 
| id | UUID | PK | gen_random_uuid() | |
| workspace_id | UUID FK workspaces | | | |
| user_id | UUID | | | Quem consultou |
| query | TEXT | NN | | Pergunta |
| mode | TEXT | | 'consensus' | consensus/voting/debate/tournament |
| models | TEXT[] | | | Modelos consultados |
| result | JSONB | | | Resultado consolidado |
| total_cost | NUMERIC(10,4) | | 0 | Custo total |
| created_at | TIMESTAMPTZ | | NOW() | |

---

## DataHub — Dados Externos

### datahub_connections (RLS)
| Campo | Tipo | NN | Default | Descricao |
|-------|------|----|---------|-----------| 
| id | UUID | PK | gen_random_uuid() | |
| workspace_id | UUID | NN | | |
| name | TEXT | NN | | Nome da conexao |
| db_type | TEXT | | 'supabase' | Tipo do banco |
| host | TEXT | | | Host/URL |
| status | TEXT | | 'active' | active/inactive/error |
| created_at | TIMESTAMPTZ | | NOW() | |

### datahub_entity_mappings (RLS)
| Campo | Tipo | NN | Default | Descricao |
|-------|------|----|---------|-----------| 
| id | UUID | PK | gen_random_uuid() | |
| workspace_id | UUID | NN | | |
| entity_name | TEXT | NN | | Nome da entidade |
| primary_connection_id | UUID FK datahub_connections | | | Conexao primaria |
| mapping_config | JSONB | | '{}' | Configuracao |
| enabled | BOOLEAN | | true | Ativo |
| created_at | TIMESTAMPTZ | | NOW() | |

---

## Avaliacao e Testes

### evaluation_runs (RLS)
| Campo | Tipo | NN | Default | Descricao |
|-------|------|----|---------|-----------| 
| id | UUID | PK | gen_random_uuid() | |
| workspace_id | UUID FK workspaces | | | |
| agent_id | UUID FK agents | | | Agente avaliado |
| status | TEXT | | 'pending' | pending/running/completed/failed |
| results | JSONB | | '{}' | Resultados |
| created_at | TIMESTAMPTZ | | NOW() | |

---

## Migrations

| # | Arquivo | Tabelas | Descricao |
|---|---------|---------|-----------|
| 001 | initial_schema | 10 | Core: agents, traces, usage, prompts, feedback |
| 002 | datahub_tables | 7 | DataHub: connections, schemas, entities, queries |
| 003 | datahub_identity_quality | 2 | Identity resolution + data quality |
| 004 | super_cerebro_oraculo | 10 | Brain + Oracle tables |
| 005 | workspaces_secrets_kb | 5 | Multi-tenancy, secrets, knowledge bases |
| 006 | database_manager | 3 | DB manager: discovered tables, functions, logs |
| 007 | fix_rls_policies | 0 | RLS fixes: workspace isolation, datahub policies |
| 008 | add_indexes_constraints | 0 | 11 indexes, FK cascade fixes, updated_at cols |
| 009 | knowledge_chunks_vector | 1 | pgvector chunks table + IVFFlat index |
| 010 | optimistic_locking | 0 | version_lock + trigger on agents |
| 011 | down_migrations_reference | 0 | Referencia de rollback para todas migrations |
| 012 | atomic_operations | 0 | RPC save_agent_atomic com optimistic lock |
