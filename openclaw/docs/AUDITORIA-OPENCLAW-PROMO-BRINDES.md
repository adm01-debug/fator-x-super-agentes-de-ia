# 🔍 AUDITORIA EXAUSTIVA — OPENCLAW PROMO BRINDES
## Data: 01/04/2026 | Auditor: Claude (Agente de Processos)

---

## 📊 RESUMO EXECUTIVO

| Categoria | Score | Detalhes |
|-----------|:-----:|---------|
| **Funcionalidade Base** | 🟢 7/10 | Container rodando, modelo configurado, SOUL.md criado |
| **Segurança** | 🔴 2/10 | Firewall zero, tokens expostos, sem hardening |
| **Performance** | 🔴 3/10 | Datacenter Kuala Lumpur, latência 300-1300ms pro Brasil |
| **Integrações** | 🟡 4/10 | WhatsApp instalado mas não conectado, Bitrix24 pendente |
| **Operação/Backup** | 🔴 1/10 | Zero backup, zero monitoramento, updates pendentes |
| **Custo** | 🟡 5/10 | Default global é Opus (caro), risco de gastos desnecessários |
| **NOTA GERAL** | 🟡 **3.7/10** | **Funcional mas NÃO pronto para produção** |

---

## 🚨 PROBLEMAS CRÍTICOS (7) — Resolver IMEDIATAMENTE

### C1. TOKENS E CREDENCIAIS EXPOSTOS
**Severidade:** 🔴 CRÍTICA
**O que aconteceu:** Durante a sessão de configuração, os seguintes segredos foram compartilhados no chat:
- Hostinger API Token (o primeiro, que falhou, e o segundo que funciona)
- Anthropic API Key (sk-ant-api03-uCeG...gAA)
- Senha root do SSH (Xk9#mPr0m0Brindes2026.vQ@)
- Gateway Token do OpenClaw (que é o mesmo token da Hostinger API!)

**Risco:** Qualquer pessoa com acesso a este histórico de chat pode acessar o VPS, o dashboard do OpenClaw e fazer chamadas à API da Anthropic gerando custos.

**Correção — Script no PuTTY:**
```bash
# 1. Mudar senha root
passwd root
# (digitar nova senha forte)

# 2. Gerar novo gateway token
NEW_TOKEN=$(openssl rand -hex 32)
echo "Novo token: $NEW_TOKEN"

# 3. Atualizar gateway token na config
python3 -c "
import json
with open('/docker/openclaw-sbem/data/.openclaw/openclaw.json','r') as f: c=json.load(f)
c['gateway']['auth']['token']='NOVO_TOKEN_AQUI'
c['gateway']['remote']['token']='NOVO_TOKEN_AQUI'
c['hooks']['token']='hooks_NOVO_TOKEN_AQUI'
with open('/docker/openclaw-sbem/data/.openclaw/openclaw.json','w') as f: json.dump(c,f,indent=2)
print('Tokens atualizados')
"

# 4. Reiniciar
cd /docker/openclaw-sbem && docker compose restart
```

Também necessário:
- Revogar API Key da Anthropic em console.anthropic.com → gerar nova
- Revogar API Token da Hostinger em hPanel → Perfil → API → gerar novo
- Atualizar a nova API Key no openclaw.json

---

### C2. ZERO FIREWALL NO VPS
**Severidade:** 🔴 CRÍTICA
**O que encontrei:** `firewall_group_id: null` — nenhum grupo de firewall configurado.

**Risco:** Todas as portas do servidor estão potencialmente expostas à internet. Embora o Traefik faça proxy reverso, outros serviços no servidor podem estar acessíveis.

**Correção via API Hostinger:**
```bash
# Criar grupo de firewall e regras via API
# Permitir apenas: SSH (22), HTTP (80), HTTPS (443)
```
Ou pelo hPanel: VPS → Manage → Firewall → Criar regras.

---

### C3. DATACENTER EM KUALA LUMPUR (MALÁSIA)
**Severidade:** 🔴 CRÍTICA para experiência do usuário
**O que encontrei:** `data_center_id: 21` = Kuala Lumpur, Malásia

**Teste de latência real:**
- Request 1: **1279ms** (!)
- Request 2: **301ms**
- Request 3: **1378ms**

**Risco:** Toda interação do WhatsApp vai levar 300ms-1.3s SÓ de rede, antes mesmo do LLM processar. Para o Brasil, isso é péssimo.

**Correção:** Migrar o VPS para datacenter mais próximo:
- Ideal: São Paulo ou EUA (se disponível na Hostinger)
- Alternativa: Europa (Frankfurt ou Amsterdam)
- Processo: Criar novo VPS → migrar dados → apontar DNS

**Nota:** Essa migração é a mais impactante em termos de UX, mas também a mais trabalhosa. Recomendo fazer depois de estabilizar tudo.

---

### C4. DEFAULT GLOBAL É OPUS (CUSTO 5x MAIOR)
**Severidade:** 🔴 IMPACTO FINANCEIRO
**O que encontrei:**
```json
"agents.defaults.model.primary": "Claude Opus 4.6"  // DEFAULT GLOBAL
"agents.list[0].model": "anthropic/claude-sonnet-4-6"  // AGENTE MAIN
```

**Risco:** Se qualquer session nova for criada (webhook, grupo, etc.), vai usar **Opus por padrão** ($15/$75 por M tokens) em vez de Sonnet ($3/$15). Diferença de 5x no custo.

**Correção:**
```bash
python3 -c "
import json
with open('/docker/openclaw-sbem/data/.openclaw/openclaw.json','r') as f: c=json.load(f)
c['agents']['defaults']['model']['primary']='anthropic/claude-sonnet-4-6'
with open('/docker/openclaw-sbem/data/.openclaw/openclaw.json','w') as f: json.dump(c,f,indent=2)
print('Default corrigido para Sonnet')
"
```

---

### C5. ZERO BACKUP AUTOMÁTICO
**Severidade:** 🔴 CRÍTICA
**O que encontrei:** Nenhum mecanismo de backup. Se o container ou disco corromper, perde-se:
- SOUL.md, AGENTS.md, USER.md
- Todas as memories acumuladas
- Config do OpenClaw
- Dados do workspace (65KB de docs Bitrix24!)

**Correção:**
```bash
# Criar script de backup diário
cat > /home/backup-openclaw.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p /backups
tar czf "/backups/openclaw_$DATE.tar.gz" \
  /docker/openclaw-sbem/data/.openclaw/ \
  /docker/openclaw-sbem/docker-compose.yml \
  /docker/openclaw-sbem/.env
ls -t /backups/openclaw_*.tar.gz | tail -n +31 | xargs rm -f 2>/dev/null
EOF
chmod +x /home/backup-openclaw.sh

# Agendar diário às 3h
(crontab -l 2>/dev/null; echo "0 3 * * * /home/backup-openclaw.sh") | crontab -
```

---

### C6. VPS PRECISA DE RESTART (UPDATES DE SEGURANÇA)
**Severidade:** 🟠 ALTA
**O que encontrei:** `*** System restart required ***` no login SSH + 12 updates pendentes.

**Risco:** Vulnerabilidades de segurança conhecidas não aplicadas.

**Correção:**
```bash
apt update && apt upgrade -y && reboot
```
(Isso vai reiniciar o VPS. O Docker auto-restart vai trazer o OpenClaw de volta.)

---

### C7. WHATSAPP NÃO CONECTADO
**Severidade:** 🟠 ALTA (funcional, não de segurança)
**O que encontrei:** Plugin instalado, habilitado, mas QR Code não escaneado.

**Correção:** Dashboard → Channels → WhatsApp → Show QR → Escanear com número dedicado.

---

## ⚠️ ALERTAS (8) — Resolver na próxima sprint

### A1. Canais inativos na allow list
Slack, Nostr, GoogleChat ainda estão em `plugins.allow[]`. Não causa erro mas é sujeira.

### A2. Tokens inválidos do Telegram/Discord
Os campos `channels.telegram.botToken` e `channels.discord.token` contêm o token da Hostinger (inválido). Já estão disabled, mas devem ser limpos.

### A3. Webhooks sem restrições
`hooks` não tem `allowedAgentIds`, `allowRequestSessionKey` nem `allowedSessionKeyPrefixes`. Qualquer request ao webhook pode acessar qualquer agente.

### A4. Headers de segurança ausentes
- ❌ Strict-Transport-Security (HSTS)
- ❌ X-Frame-Options
- ❌ Content-Security-Policy
- ❌ X-Content-Type-Options
- ⚠️ X-Powered-By: Express (exposto)

### A5. SOUL.md sem acentuação
Escrito em ASCII puro (sem ç, ã, é etc.) porque o script evitou UTF-8 para segurança. O agente vai entender, mas a qualidade do prompt é levemente inferior.

### A6. Plugin oxylabs-ai-studio não funcional
Aparece nos logs como "does not meet requirements". É o plugin de web search da Hostinger.

### A7. Docker image sem version pinning
`ghcr.io/hostinger/hvps-openclaw:latest` pode mudar sem controle. Ideal pinnar versão.

### A8. IDENTITY.md, TOOLS.md, BOOTSTRAP.md não revisados
Estes arquivos pré-existentes podem ter configs que conflitam com nosso SOUL.md.

---

## 📋 GAPS FUNCIONAIS — O que falta implementar

### G1. Integração Bitrix24
- Skill criada na pasta mas **vazia** (sem SKILL.md com endpoints)
- Webhook de entrada no Bitrix24 não configurado
- Webhook de saída do Bitrix24 → OpenClaw não configurado
- API REST do Bitrix24 não testada

### G2. Integração Bots Lovable
- Nenhum webhook mapping configurado
- Nenhum sessionKey prefix definido
- Nenhum bot Lovable testado com o endpoint /hooks/agent

### G3. Integração n8n
- Nenhuma conexão configurada
- Workflows de automação não criados

### G4. HEARTBEAT.md não personalizado
- Existe com conteúdo padrão, não com as tarefas da Promo Brindes
- Sem rotinas matinais, resumos semanais, alertas de deals

### G5. Monitoramento de custos
- Sem alertas de gasto na Anthropic
- Sem limites diários/mensais configurados
- Default global em Opus é armadilha de custo

### G6. Health monitoring
- Sem health check automático
- Sem alertas se o container cair
- Sem dashboards de uso

---

## 🛡️ PLANO DE CORREÇÃO PRIORIZADO

### URGÊNCIA 1 — Fazer AGORA (30 min)
| # | Ação | Comando/Local |
|---|------|---------------|
| 1 | Revogar API Key Anthropic | console.anthropic.com |
| 2 | Revogar API Token Hostinger | hPanel → Perfil → API |
| 3 | Mudar senha root | `passwd root` no PuTTY |
| 4 | Gerar novo gateway token | Script acima (C1) |
| 5 | Atualizar nova API Key no config | Script Python |
| 6 | Corrigir default global para Sonnet | Script acima (C4) |
| 7 | Aplicar updates do sistema | `apt update && apt upgrade -y && reboot` |

### URGÊNCIA 2 — Fazer ESTA SEMANA
| # | Ação |
|---|------|
| 8 | Configurar firewall no VPS |
| 9 | Configurar backup automático |
| 10 | Conectar WhatsApp (QR Code) |
| 11 | Reescrever SOUL.md com acentos e seções completas |
| 12 | Revisar IDENTITY.md e TOOLS.md pré-existentes |
| 13 | Limpar canais inativos da config |

### URGÊNCIA 3 — Fazer nas PRÓXIMAS 2 SEMANAS
| # | Ação |
|---|------|
| 14 | Implementar skill Bitrix24 completa |
| 15 | Configurar webhooks Bitrix24 ↔ OpenClaw |
| 16 | Integrar primeiro bot Lovable |
| 17 | Personalizar HEARTBEAT.md |
| 18 | Configurar headers de segurança no Traefik |
| 19 | Avaliar migração de datacenter (Kuala Lumpur → mais perto) |
| 20 | Configurar monitoramento e alertas |

---

## 📈 O QUE ESTÁ BOM

Nem tudo é problema! Coisas que estão funcionando:

1. ✅ VPS potente (KVM 4: 4 vCPU, 16GB RAM) — sobra muito recurso
2. ✅ Docker + Traefik com HTTPS/SSL automático
3. ✅ Container OpenClaw rodando estável (2+ semanas sem crash)
4. ✅ Claude Sonnet 4.6 configurado como modelo do agente main
5. ✅ Três modelos disponíveis (Haiku/Sonnet/Opus)
6. ✅ SOUL.md criado com identidade da Promo Brindes
7. ✅ AGENTS.md e USER.md criados
8. ✅ Workspace rico: bitrix24-raio-x.md (65KB!), docs, guias
9. ✅ Plugin WhatsApp instalado
10. ✅ Restart policy (unless-stopped) garante auto-recovery

---

*Auditoria concluída em 01/04/2026 — Versão 1.0*
*Próxima auditoria recomendada: após completar Urgência 1 e 2*
