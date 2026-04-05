# Nexus Agents Studio — Runbook Operacional

## Deploy

O deploy é automático via Lovable:
1. Fazer alterações no código via Lovable Chat
2. Build automático no preview
3. Publicar via botão "Publish" no Lovable

### Rollback
1. Abrir **History** no Lovable (botão no painel lateral)
2. Identificar a versão anterior estável
3. Clicar em "Restore" na versão desejada
4. Verificar preview e publicar novamente

**Tempo estimado de rollback: < 3 minutos**

## Edge Functions

Edge Functions são deployadas automaticamente ao salvar.

### Logs
- Acessar via Lovable Cloud → Edge Function Logs
- Filtrar por nome da função
- Verificar erros com stack trace

## Incidentes

### Severidades
| Sev | Descrição | SLA |
|-----|-----------|-----|
| P1 | Sistema indisponível | 30 min |
| P2 | Feature crítica quebrada | 2h |
| P3 | Bug não-bloqueante | 24h |
| P4 | Melhoria/cosmético | Backlog |

### Procedimento
1. **Detectar** — Alerta, report de usuário, ou monitoramento
2. **Avaliar** — Determinar severidade (P1-P4)
3. **Comunicar** — Notificar stakeholders se P1/P2
4. **Mitigar** — Rollback se necessário, ou hotfix
5. **Resolver** — Implementar correção definitiva
6. **Post-mortem** — Documentar causa raiz e ações preventivas

## Cenários Comuns

### DB Lento
1. Verificar se há queries sem índice (checar `agent_traces`, `audit_log`)
2. Verificar limites do plano Supabase
3. Considerar paginação se estiver carregando muitos registros

### API Externa Fora (Bitrix24)
1. O sistema deve degradar graciosamente
2. Operações locais continuam funcionando
3. Retry automático quando a API voltar

### Erro 401 em Massa
1. Verificar se o Supabase Auth está operacional
2. Verificar se as chaves API não expiraram
3. Limpar cache do browser e relogar

## Contatos
- **Técnico:** Equipe Promo Brindes
- **Suporte Lovable:** https://docs.lovable.dev
