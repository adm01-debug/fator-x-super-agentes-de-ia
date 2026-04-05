# Procedimento de Resposta a Incidentes

> Guia operacional para triagem, resolucao e comunicacao de incidentes na plataforma Fator X Super Agentes de IA.

---

## Matriz de Severidade

| Severidade | Descricao | Exemplo |
|------------|-----------|---------|
| **P0 - Critico** | Sistema completamente indisponivel. Todos os usuarios afetados. | Supabase fora do ar, build de producao quebrado, dominio inacessivel |
| **P1 - Alto** | Funcionalidade principal quebrada. Parte significativa dos usuarios afetada. | Login nao funciona, agentes de IA nao respondem, erro 500 em rotas criticas |
| **P2 - Medio** | Bug que impacta uma funcionalidade secundaria. Workaround disponivel. | Filtro de busca nao retorna resultados corretos, layout quebrado em mobile |
| **P3 - Baixo** | Problema cosmetico ou melhoria de UX. Nenhum impacto funcional. | Texto desalinhado, cor incorreta em botao, typo na interface |

---

## SLA por Severidade

| Severidade | Tempo de Resposta | Tempo de Resolucao | Notificacao |
|------------|-------------------|---------------------|-------------|
| **P0** | 5 minutos | 1 hora | Slack imediato + telefone |
| **P1** | 15 minutos | 4 horas | Slack imediato |
| **P2** | 1 hora | 1 dia util | Slack no canal do time |
| **P3** | 1 dia util | 1 semana | Issue no GitHub |

> **Nota:** O relogio do SLA conta apenas em horario comercial (9h-18h BRT) para P2 e P3. Para P0 e P1, o relogio roda 24/7.

---

## Cadeia de Escalonamento

```
Etapa 1 (0-15min)    -> Desenvolvedor de plantao
Etapa 2 (15min-1h)   -> Tech Lead
Etapa 3 (1h+)        -> CTO
Etapa 4 (4h+)        -> CTO + Stakeholders de negocio
```

### Responsabilidades por Etapa

**Desenvolvedor de plantao:**
- Confirmar o incidente e classificar a severidade
- Iniciar investigacao e coletar logs (`supabase logs`, console do Vercel/Cloudflare)
- Comunicar status no canal #incidentes do Slack
- Aplicar hotfix ou rollback se possivel

**Tech Lead:**
- Validar a classificacao de severidade
- Coordenar recursos adicionais se necessario
- Aprovar hotfix PRs com review acelerado (4h SLA)
- Decidir entre fix-forward ou rollback

**CTO:**
- Comunicacao com stakeholders externos
- Decisoes de arquitetura emergenciais
- Autorizacao de mudancas de infraestrutura
- Acionamento de suporte dos provedores (Supabase, Vercel)

---

## Template de Comunicacao

### Notificacao Inicial (Slack)

```
🚨 [P0/P1/P2/P3] Incidente Detectado

Resumo: [Descricao curta do problema]
Impacto: [Quem/o que esta afetado]
Inicio: [Horario UTC-3 da deteccao]
Status: Investigando
Responsavel: @[nome]
Canal de acompanhamento: #incidentes

Proximo update em: [15min para P0, 30min para P1, 2h para P2]
```

### Atualizacao de Status (Slack)

```
🔄 Update - [P0/P1/P2/P3] [Titulo do Incidente]

Status: [Investigando | Identificado | Corrigindo | Monitorando | Resolvido]
Causa: [Se identificada]
Acao atual: [O que esta sendo feito agora]
ETA: [Estimativa para resolucao]

Proximo update em: [tempo]
```

### Resolucao (Slack + E-mail)

```
✅ Incidente Resolvido - [Titulo]

Duracao total: [tempo de inicio ate resolucao]
Causa raiz: [Descricao breve]
Resolucao: [O que foi feito]
Itens pendentes: [Se houver follow-ups]
Post-mortem agendado: [data/hora]
```

---

## Template de Post-Mortem

### Cabecalho

| Campo | Valor |
|-------|-------|
| **Titulo** | [Descricao do incidente] |
| **Data** | [YYYY-MM-DD] |
| **Severidade** | [P0/P1/P2/P3] |
| **Duracao** | [tempo total] |
| **Autor** | [nome do responsavel] |
| **Participantes** | [quem esteve envolvido] |

### Timeline

| Horario (BRT) | Evento |
|---------------|--------|
| HH:MM | Primeiro alerta detectado |
| HH:MM | Desenvolvedor de plantao acionado |
| HH:MM | Causa raiz identificada |
| HH:MM | Fix aplicado em producao |
| HH:MM | Monitoramento confirma resolucao |

### Analise dos 5 Porques

1. **Por que o problema ocorreu?**
   - [Resposta]
2. **Por que isso nao foi detectado antes?**
   - [Resposta]
3. **Por que o sistema nao se recuperou sozinho?**
   - [Resposta]
4. **Por que a resolucao demorou X tempo?**
   - [Resposta]
5. **Por que nao tinhamos prevencao para isso?**
   - [Resposta]

### Causa Raiz

[Descricao detalhada da causa raiz tecnica]

### Impacto

- Usuarios afetados: [numero/percentual]
- Funcionalidades indisponiveis: [lista]
- Dados perdidos: [se aplicavel]
- Impacto financeiro estimado: [se aplicavel]

### Itens de Acao

| Acao | Responsavel | Prioridade | Prazo | Status |
|------|-------------|------------|-------|--------|
| [Descricao] | @[nome] | Alta/Media/Baixa | [data] | Pendente |

### Licoes Aprendidas

- O que funcionou bem:
  - [item]
- O que pode melhorar:
  - [item]

---

## Checklist do Plantao

### Ao Iniciar o Plantao

- [ ] Verificar acesso ao dashboard do Supabase
- [ ] Verificar acesso ao painel de deploy (Vercel/Cloudflare)
- [ ] Confirmar que notificacoes do Slack estao ativas no celular
- [ ] Verificar que o ambiente local esta funcional (`bun install && bun run build`)
- [ ] Revisar incidentes recentes no canal #incidentes

### Ao Receber um Alerta

- [ ] Confirmar recebimento no Slack em ate 5 minutos
- [ ] Classificar a severidade usando a matriz acima
- [ ] Verificar se ha deploy recente que possa ser a causa (`git log --oneline -5`)
- [ ] Checar status dos servicos externos:
  - Supabase: https://status.supabase.com
  - Vercel: https://www.vercel-status.com
  - Cloudflare: https://www.cloudflarestatus.com
- [ ] Coletar logs relevantes
- [ ] Postar notificacao inicial no Slack

### Para Rollback de Emergencia

```bash
# 1. Identificar o ultimo deploy estavel
git log --oneline -10

# 2. Reverter para o commit estavel
git revert HEAD --no-edit
git push origin main

# 3. Para rollback de migracao Supabase (CUIDADO)
# Nunca faça rollback de migracao sem consultar o Tech Lead
supabase db reset --linked
```

### Ao Resolver o Incidente

- [ ] Postar mensagem de resolucao no Slack
- [ ] Verificar metricas por 30 minutos apos o fix
- [ ] Criar issue no GitHub para o post-mortem (para P0 e P1)
- [ ] Agendar reuniao de post-mortem em ate 48 horas (para P0 e P1)
- [ ] Atualizar este documento se o processo puder ser melhorado
