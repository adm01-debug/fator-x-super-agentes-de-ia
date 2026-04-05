# 🦞 OPENCLAW — PLANO COMPLETO DE INSTALAÇÃO E CONFIGURAÇÃO
## Promo Brindes | Pink & Cerébro
### Versão 1.0 — Março 2026

---

## 📋 VISÃO GERAL DO PROJETO

| Item | Detalhe |
|------|---------|
| **Plataforma** | OpenClaw (open-source AI assistant) |
| **Hospedagem** | Hostinger VPS (Docker Manager) |
| **SO** | Ubuntu 24.04 LTS |
| **Plano recomendado** | KVM 2 (2 vCPU, 8GB RAM, 100GB NVMe) — ~$8.99/mês |
| **Canais** | WhatsApp + Bitrix24 + Bots Especialistas (Lovable) |
| **LLM principal** | Claude Sonnet 4.6 (recomendado) |
| **LLM fallback** | Claude Haiku (tarefas simples) / Claude Opus 4.6 (complexas) |
| **Tempo estimado** | 2-4 horas (instalação base) + 2-4 horas (configuração avançada) |

---

## 🏗️ ARQUITETURA DA SOLUÇÃO

```
┌─────────────────────────────────────────────────────────────┐
│                    HOSTINGER VPS (KVM 2)                     │
│                    Ubuntu 24.04 LTS                          │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              OPENCLAW GATEWAY                        │    │
│  │           ws://127.0.0.1:18789                       │    │
│  │    (Control Plane — WebSocket)                       │    │
│  └──────────────────┬──────────────────────────────────┘    │
│                     │                                        │
│         ┌───────────┼───────────────┐                       │
│         │           │               │                        │
│    ┌────▼────┐ ┌────▼────┐ ┌───────▼──────────┐            │
│    │  Canal  │ │  Canal  │ │    Webhooks       │            │
│    │WhatsApp │ │Telegram │ │  (HTTP inbound)   │            │
│    │(Baileys)│ │(grammY) │ │                   │            │
│    └─────────┘ └─────────┘ │ ┌───────────────┐ │            │
│                             │ │  Bitrix24     │ │            │
│                             │ │  (REST API)   │ │            │
│                             │ ├───────────────┤ │            │
│                             │ │  Bot Oráculo  │ │            │
│                             │ │  (Lovable)    │ │            │
│                             │ ├───────────────┤ │            │
│                             │ │  Bot DataHub  │ │            │
│                             │ │  (Lovable)    │ │            │
│                             │ ├───────────────┤ │            │
│                             │ │  Outros Bots  │ │            │
│                             │ │  (Lovable)    │ │            │
│                             │ └───────────────┘ │            │
│                             └───────────────────┘            │
│                     │                                        │
│         ┌───────────┼───────────────┐                       │
│         │           │               │                        │
│    ┌────▼────┐ ┌────▼────┐ ┌───────▼──────┐                │
│    │ Skills  │ │ Memory  │ │    SOUL.md    │                │
│    │ & Tools │ │  System │ │  (Identidade) │                │
│    └─────────┘ └─────────┘ └──────────────┘                │
│                                                              │
│    ┌─────────────────────────────────────────────────────┐  │
│    │              PROVEDORES DE LLM                       │  │
│    │  Claude Sonnet 4.6 (principal)                       │  │
│    │  Claude Haiku (triagem/simples)                      │  │
│    │  Claude Opus 4.6 (complexo — sob demanda)            │  │
│    └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 📐 FASES DE IMPLEMENTAÇÃO

---

### FASE 1 — PROVISIONAR INFRAESTRUTURA (Hostinger VPS)

**Objetivo:** Ter um servidor rodando 24/7 com Ubuntu 24.04 e Docker pronto.

**Pré-requisitos:**
- Conta ativa na Hostinger
- Cartão de crédito/pagamento configurado
- Decisão do plano (recomendado: KVM 2)

#### Passo a passo:

**1.1 — Comprar o VPS**
- Acessar: https://www.hostinger.com/vps
- Selecionar plano **KVM 2** (2 vCPU, 8GB RAM, 100GB NVMe, 8TB bandwidth)
- Preço: ~$8.99/mês no plano de 2 anos
- Escolher localização do servidor: **São Paulo** (menor latência para o Brasil) ou **Europe** se precisar de latência global média

**1.2 — Configurar o SO**
- Selecionar **Ubuntu 24.04 LTS**
- Definir uma senha root **forte** (mínimo 16 caracteres, alfanumérica + especiais)
- Anotar o **IP público** do VPS

**1.3 — Primeiro acesso SSH**
```bash
# Do seu computador local (Terminal/PowerShell)
ssh root@SEU_IP_VPS

# Primeira coisa: atualizar tudo
sudo apt update && sudo apt upgrade -y
```

**1.4 — Criar usuário não-root (SEGURANÇA CRÍTICA)**
```bash
# NUNCA rode OpenClaw como root!
adduser openclaw
usermod -aG sudo openclaw
usermod -aG docker openclaw

# Configurar SSH key (recomendado)
su - openclaw
mkdir -p ~/.ssh
chmod 700 ~/.ssh
# Copie sua chave pública para ~/.ssh/authorized_keys
```

**1.5 — Firewall básico**
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp        # SSH
sudo ufw allow 80/tcp        # HTTP (para SSL depois)
sudo ufw allow 443/tcp       # HTTPS
sudo ufw limit 22/tcp        # Rate limit SSH
sudo ufw enable
sudo ufw status numbered
```

**✅ Checkpoint Fase 1:**
- [ ] VPS ativo e acessível via SSH
- [ ] Usuário `openclaw` criado (não-root)
- [ ] Firewall configurado
- [ ] Sistema atualizado

---

### FASE 2 — INSTALAR OPENCLAW

**Objetivo:** OpenClaw instalado e gateway rodando.

Existem **2 caminhos** na Hostinger. Recomendo o **Caminho A** para vocês (mais controle):

#### Caminho A — Via Docker Manager (Recomendado para Hostinger)

**2.1 — Ativar Docker Manager**
- No hPanel da Hostinger → VPS → Manage → **Docker Manager** (menu lateral)
- Se não estiver instalado, clicar em **Install** (aguardar 2-3 min)

**2.2 — Deploy do OpenClaw**
- Aba **Catalog** → buscar "OpenClaw"
- Clicar em **Select** / **Deploy**
- Configurar variáveis de ambiente:
  - `OPENCLAW_GATEWAY_TOKEN`: será auto-gerado (SALVAR este token em local seguro!)
  - `WHATSAPP_NUMBER`: seu número dedicado com código do país (ex: +5511999999999)

**2.3 — Aguardar deploy** (2-3 minutos)
- Status muda para **Running**
- Anotar a **porta** exposta para o web interface

**2.4 — Acessar o Dashboard**
- URL: `http://SEU_IP_VPS:PORTA`
- Inserir o `OPENCLAW_GATEWAY_TOKEN`
- Clicar Login

#### Caminho B — Instalação Manual (Mais controle, mais trabalhoso)

```bash
# Logar como usuário openclaw
su - openclaw

# Instalar Node.js 22
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 22

# Verificar
node --version  # deve ser v22.x
npm --version

# Instalar OpenClaw globalmente
npm install -g openclaw

# Criar diretório do workspace
mkdir -p ~/my-agent && cd ~/my-agent

# Rodar o wizard de onboarding
openclaw onboard --install-daemon
```

O wizard vai perguntar:
1. **Gateway**: Selecionar **Local**
2. **Gateway interface**: Selecionar **Loopback** (127.0.0.1 — segurança!)
3. **Model provider**: Selecionar **Anthropic**
4. **API Key**: Colar sua chave da Anthropic
5. **Default model**: Selecionar **Claude Sonnet 4.6**
6. **Channel**: Selecionar **WhatsApp** (primeiro canal)
7. **Skills**: Selecionar **No** (configuraremos depois)
8. **Hooks**: Selecionar **Skip for now**

**✅ Checkpoint Fase 2:**
- [ ] OpenClaw instalado e rodando
- [ ] Gateway ativo em ws://127.0.0.1:18789
- [ ] Dashboard acessível via navegador
- [ ] Token do gateway salvo em local seguro

---

### FASE 3 — CONFIGURAR LLMs (API Keys + Roteamento)

**Objetivo:** Configurar o provedor de IA com modelo principal + fallback.

**3.1 — Obter API Key da Anthropic**
- Acessar: https://console.anthropic.com/
- Criar conta ou fazer login
- Ir em **API Keys** → **Create Key**
- Copiar e guardar em local seguro
- Adicionar créditos (recomendado: começar com $20-50 para testes)

**3.2 — Configurar no OpenClaw**

Se usou Docker Manager, acessar via SSH e editar:
```bash
# Localizar o arquivo de configuração
# Docker: geralmente em ~/openclaw/config/ ou via variáveis de ambiente
# Manual: ~/.openclaw/openclaw.json

# Editar configuração de modelos
nano ~/.openclaw/openclaw.json
```

Configuração recomendada de modelos:
```json
{
  "models": {
    "providers": {
      "anthropic": {
        "apiKey": "sk-ant-SUA_CHAVE_AQUI"
      }
    },
    "default": "anthropic/claude-sonnet-4-6",
    "aliases": {
      "fast": "anthropic/claude-haiku-4-5",
      "smart": "anthropic/claude-sonnet-4-6",
      "genius": "anthropic/claude-opus-4-6"
    }
  }
}
```

**3.3 — Testar os modelos**
```bash
# Via CLI
openclaw send "Olá, me diga seu nome e modelo"

# Ou via chat no dashboard web
# Enviar: "Qual modelo você está usando?"
```

**3.4 — (Opcional) Configurar roteamento multi-modelo**

Para economizar, configurar no SOUL.md ou AGENTS.md:
```markdown
## Regras de Modelo
- Para perguntas simples e triagem: usar /model fast
- Para trabalho do dia-a-dia: usar modelo padrão (Sonnet)
- Para análises complexas ou decisões críticas: usar /model genius
```

**💰 Estimativa de custo mensal (uso moderado):**

| Modelo | Uso estimado | Custo/mês |
|--------|-------------|-----------|
| Claude Haiku (triagem) | 70% das mensagens | ~$5-10 |
| Claude Sonnet (principal) | 25% das mensagens | ~$20-40 |
| Claude Opus (complexo) | 5% das mensagens | ~$10-30 |
| **TOTAL ESTIMADO** | | **~$35-80/mês** |

**✅ Checkpoint Fase 3:**
- [ ] API Key da Anthropic configurada
- [ ] Modelo padrão (Sonnet) respondendo
- [ ] Aliases configurados (fast/smart/genius)
- [ ] Teste de envio/resposta funcionando

---

### FASE 4 — CRIAR A IDENTIDADE DO AGENTE (SOUL.md)

**Objetivo:** Definir quem é o agente da Promo Brindes — personalidade, regras, guardrails.

**Este é o arquivo mais importante do OpenClaw.** Ele define como o agente se comporta em TODAS as interações.

**4.1 — Editar o SOUL.md**
```bash
nano ~/.openclaw/agents/default/SOUL.md
```

**4.2 — Template SOUL.md para Promo Brindes:**

```markdown
# 🦞 SOUL — Agente Nexus | Promo Brindes

## Identidade
Você é o **Nexus**, o assistente de IA da Promo Brindes, uma empresa de brindes
promocionais. Você é inteligente, prático, organizado e focado em resultados.

Você atende a equipe interna (Pink, Cerébro e colaboradores) e auxilia em
processos operacionais, comerciais, de compras, logística e gestão.

## Estilo de Comunicação
- Linguagem clara, direta e amigável em **português brasileiro**
- Tom profissional, mas acessível — como um colega competente
- Use emojis com moderação (1-2 por mensagem, quando apropriado)
- Quando não souber algo, diga claramente e sugira onde buscar
- Nunca invente dados, preços ou informações de clientes

## Capacidades Principais
1. **Gestão de Processos**: Ajudar a mapear, organizar e otimizar fluxos de trabalho
2. **CRM/Bitrix24**: Consultar e gerenciar dados do Bitrix24
3. **Comunicação**: Redigir mensagens, resumos e relatórios
4. **Pesquisa**: Buscar informações na web quando necessário
5. **Automação**: Sugerir e executar automações via n8n e webhooks

## Regras de Negócio (NUNCA violar)
- **Dados sensíveis**: NUNCA compartilhar dados de clientes com terceiros
- **Preços**: NUNCA inventar preços ou condições comerciais
- **Decisões financeiras**: SEMPRE escalar para Pink ou Cerébro
- **Contratos**: NUNCA assinar ou comprometer em nome da empresa
- **Fornecedores**: NUNCA compartilhar dados de fornecedores externamente

## Contexto da Empresa
- **Nome**: Promo Brindes
- **Segmento**: Brindes promocionais / marketing promocional
- **Sistemas**: Bitrix24 (CRM), n8n (automação), Lovable (plataformas web)
- **Projetos**: Nexus Agents Studio, Oráculo, DataHub, Super Cérebro
- **Decisores**: Pink (Diretor), Cerébro (Gestão/Estratégia)

## Comportamento em Grupos
- Em grupos, só responder quando mencionado por @nome ou quando a pergunta
  é claramente direcionada ao agente
- Nunca interromper conversas entre humanos
- Resumir threads longas quando solicitado

## Memória
- Ao final de interações importantes, registrar contexto em MEMORY.md
- Manter lista de decisões tomadas, projetos em andamento e preferências
- Revisar memórias diárias para manter continuidade
```

**4.3 — Configurar USER.md** (contexto sobre os usuários)
```bash
nano ~/.openclaw/workspace/USER.md
```

```markdown
# Usuários do Agente Nexus

## Pink
- Diretor da Promo Brindes
- Comunicação direta, objetiva, frequentemente usa CAPS LOCK para ênfase
- Espera respostas completas e proativas
- Foco em processos, escalabilidade e automação
- Sempre pensa em como melhorar 1% a mais

## Cerébro
- Gestão e estratégia
- Parceiro do Pink nos projetos de tecnologia
- Foco em análise e implementação

## Equipe
- Vendedores, Compras, Financeiro, Logística, Arte
- Diferentes níveis de familiaridade com tecnologia
- Adaptar linguagem conforme o interlocutor
```

**4.4 — Configurar AGENTS.md** (instruções operacionais)
```bash
nano ~/.openclaw/workspace/AGENTS.md
```

```markdown
# Instruções Operacionais — Agente Nexus

## Ferramentas Disponíveis
- Web search: pesquisar informações atualizadas
- Bitrix24 API: consultar CRM via webhooks
- File system: gerenciar arquivos do workspace
- Calendar: verificar agenda (quando configurado)

## Prioridades
1. Segurança dos dados da empresa
2. Precisão das informações
3. Velocidade de resposta
4. Proatividade (sugerir melhorias)

## Formato de Respostas
- Para perguntas simples: resposta direta, 1-3 frases
- Para análises: seções organizadas com headers
- Para processos: passo a passo numerado
- Para dados do CRM: tabela quando possível

## Escalation
- Dúvidas sobre preços/condições → escalar para Pink
- Problemas técnicos nos sistemas → registrar e notificar
- Reclamações de clientes → tratar com prioridade alta
```

**✅ Checkpoint Fase 4:**
- [ ] SOUL.md criado e personalizado
- [ ] USER.md com perfil dos usuários
- [ ] AGENTS.md com instruções operacionais
- [ ] Restart do OpenClaw: `openclaw restart`
- [ ] Teste de personalidade (enviar "Quem é você?" e validar resposta)

---

### FASE 5 — CONFIGURAR CANAIS DE MENSAGENS

**Objetivo:** Conectar WhatsApp + Bitrix24 + Bots Lovable.

---

#### 5A — WhatsApp (Canal Nativo)

**⚠️ ALERTA DE SEGURANÇA:**
- Usar um **número DEDICADO** — nunca o WhatsApp pessoal!
- Um chip pré-pago secundário ou número virtual é ideal
- Risco de ban existe (conexão não-oficial via Baileys)
- Máximo de 4 dispositivos vinculados por conta

**5A.1 — Configurar o canal:**
```bash
# Se usou Docker Manager:
# No dashboard OpenClaw → Channels → WhatsApp → Show QR

# Se usou instalação manual:
openclaw channels login --channel whatsapp
```

**5A.2 — Escanear QR Code:**
- Abrir WhatsApp no celular do número dedicado
- Ir em **Configurações → Dispositivos vinculados → Vincular dispositivo**
- Escanear o QR exibido no terminal/dashboard

**5A.3 — Testar:**
- De outro celular, enviar mensagem para o número do bot
- Validar que o agente responde com a personalidade do SOUL.md
- Testar: "Quem é você?" / "Qual seu modelo de IA?" / "Me ajude com X"

**5A.4 — Configurações de segurança WhatsApp:**
```json
// No openclaw.json, seção channels.whatsapp:
{
  "channels": {
    "whatsapp": {
      "enabled": true,
      "autoReply": true,
      "groupMode": "mention-only",
      "blockedNumbers": [],
      "allowedNumbers": ["+5511XXXXXXXXX", "+5511YYYYYYYYY"]
    }
  }
}
```

---

#### 5B — Bitrix24 (Via Webhooks)

O Bitrix24 **não é um canal nativo** do OpenClaw, mas integra perfeitamente via **webhooks bidirecionais**.

**Arquitetura da integração:**

```
Bitrix24                          OpenClaw
┌─────────────┐                  ┌──────────────────┐
│  Evento CRM │──webhook out──→  │ /hooks/agent     │
│  (ex: novo  │                  │ (recebe evento)  │
│   deal)     │                  │                  │
│             │                  │ Agente processa  │
│             │  ←──REST API───  │ e responde via   │
│  Ação CRM   │                  │ Bitrix24 API     │
│  (ex: criar │                  │                  │
│   tarefa)   │                  │                  │
└─────────────┘                  └──────────────────┘
```

**5B.1 — Criar Webhook de Saída no Bitrix24:**
- Bitrix24 → **Aplicações** → **Webhooks** → **Webhook de saída**
- URL do handler: `http://SEU_IP_VPS:PORTA/hooks/agent`
- Eventos a monitorar:
  - `ONCRMDEALADD` (novo deal)
  - `ONCRMDEALUPDATE` (deal atualizado)
  - `ONCRMLEADADD` (novo lead)
  - `ONTASKADD` (nova tarefa)
  - `ONIMBOTMESSAGEADD` (mensagem no chat do bot)

**5B.2 — Criar Webhook de Entrada no Bitrix24:**
- Bitrix24 → **Aplicações** → **Webhooks** → **Webhook de entrada**
- Permissões necessárias:
  - `crm` (ler/escrever CRM)
  - `task` (ler/escrever tarefas)
  - `im` (mensagens internas)
  - `user` (consultar usuários)
- Anotar a URL do webhook (ex: `https://seubitrix.bitrix24.com.br/rest/1/xxxxxxxxxxxx/`)

**5B.3 — Configurar Webhook no OpenClaw:**

Criar arquivo de mapeamento de hooks:
```bash
nano ~/.openclaw/config/hooks.yaml
```

```yaml
hooks:
  allowedAgentIds: ["*"]
  defaultSessionKey: "hook:bitrix24"
  
  mappings:
    bitrix24-deal:
      match:
        header:
          x-source: "bitrix24"
      transform: "transforms/bitrix24.js"
      sessionKey: "hook:bitrix24:deals"
      deliver: true
      channel: "whatsapp"
      to: "+5511XXXXXXXXX"  # Número do Pink para notificações
```

**5B.4 — Criar skill de Bitrix24:**
```bash
mkdir -p ~/.openclaw/workspace/skills/bitrix24
nano ~/.openclaw/workspace/skills/bitrix24/SKILL.md
```

```markdown
---
name: bitrix24
description: Integração com o Bitrix24 CRM da Promo Brindes. Permite consultar deals, leads, contatos, empresas, tarefas e enviar mensagens internas.
---

# Bitrix24 CRM — Promo Brindes

## Endpoints Disponíveis
- Base URL: https://seubitrix.bitrix24.com.br/rest/1/SEU_TOKEN/

## Operações
- Consultar deal: `crm.deal.get?id=ID`
- Listar deals: `crm.deal.list`
- Criar tarefa: `tasks.task.add`
- Enviar mensagem: `im.message.add`
- Buscar contato: `crm.contact.list?filter[PHONE]=NUMERO`

## Regras
- Sempre confirmar antes de CRIAR ou ALTERAR dados no CRM
- Para operações de leitura: executar diretamente
- Para operações de escrita: pedir confirmação ao usuário
- Nunca deletar registros sem aprovação explícita
```

**5B.5 — Registrar skill:**
```json
// No openclaw.json, adicionar:
{
  "skills": {
    "entries": {
      "bitrix24": {
        "enabled": true,
        "env": {
          "BITRIX24_WEBHOOK_URL": "https://seubitrix.bitrix24.com.br/rest/1/SEU_TOKEN/"
        }
      }
    }
  }
}
```

---

#### 5C — Bots Especialistas (Sistemas Lovable)

Os bots que vocês estão criando nos sistemas Lovable (Oráculo, DataHub, etc.) se conectam ao OpenClaw via **webhooks HTTP**.

**Arquitetura:**

```
Sistema Lovable (Oráculo, DataHub, etc.)
┌─────────────────────────────────────────┐
│  Frontend (React/Lovable)               │
│  ┌──────────────────────────────┐       │
│  │  Bot Especialista do sistema │       │
│  │  (ex: Oráculo de Pesquisas) │       │
│  └──────────┬───────────────────┘       │
│             │                            │
│             │ HTTP POST                  │
│             ▼                            │
│  ┌──────────────────────────────┐       │
│  │  Supabase Edge Function      │       │
│  │  (proxy/middleware)          │       │
│  └──────────┬───────────────────┘       │
│             │                            │
└─────────────┼────────────────────────────┘
              │ webhook
              ▼
┌─────────────────────────────────┐
│  OpenClaw Gateway               │
│  POST /hooks/agent              │
│  {                              │
│    "message": "...",            │
│    "name": "Oráculo",          │
│    "agentId": "specialist",    │
│    "sessionKey": "hook:oraculo"│
│  }                              │
└─────────────────────────────────┘
```

**5C.1 — Configurar webhook endpoint no OpenClaw:**

O OpenClaw já expõe o endpoint `/hooks/agent` por padrão. Basta configurar a autenticação:

```bash
# Gerar um token seguro para webhooks
openssl rand -hex 32
# Resultado: abc123def456... (guardar!)
```

Configurar no `openclaw.json`:
```json
{
  "hooks": {
    "token": "SEU_TOKEN_WEBHOOK_AQUI",
    "allowedAgentIds": ["*"],
    "allowRequestSessionKey": true,
    "allowedSessionKeyPrefixes": ["hook:oraculo", "hook:datahub", "hook:nexus"]
  }
}
```

**5C.2 — Exemplo de chamada dos bots Lovable:**

```javascript
// No seu sistema Lovable (Supabase Edge Function ou direto do frontend)
const response = await fetch("http://SEU_IP_VPS:PORTA/hooks/agent", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer SEU_TOKEN_WEBHOOK_AQUI"
  },
  body: JSON.stringify({
    message: "Pesquise tendências de brindes eco-friendly para 2026",
    name: "Oráculo",
    sessionKey: "hook:oraculo",
    agentId: "default",
    deliver: false,  // false = não enviar resposta pro WhatsApp
    model: "anthropic/claude-sonnet-4-6"
  })
});

const result = await response.json();
// result contém a resposta do agente OpenClaw
```

**5C.3 — Mapeamento dos bots especialistas:**

| Bot | sessionKey | Descrição | Modelo sugerido |
|-----|-----------|-----------|-----------------|
| Oráculo | `hook:oraculo` | Pesquisas e inteligência de mercado | Sonnet (web search) |
| DataHub | `hook:datahub` | Consultas e análises de dados | Sonnet / Opus |
| Nexus Studio | `hook:nexus` | Gestão de agentes | Sonnet |
| Financeiro | `hook:financeiro` | Consultas financeiras | Sonnet |
| Gestão Time | `hook:gestao` | Gestão de equipe e tarefas | Sonnet |

**✅ Checkpoint Fase 5:**
- [ ] WhatsApp conectado e respondendo (número dedicado)
- [ ] Webhook Bitrix24 → OpenClaw configurado
- [ ] Webhook OpenClaw → Bitrix24 (REST API) funcionando
- [ ] Endpoint de webhook acessível para bots Lovable
- [ ] Teste end-to-end: evento no Bitrix24 → notificação no WhatsApp
- [ ] Teste end-to-end: bot Lovable → OpenClaw → resposta de volta

---

### FASE 6 — INSTALAR SKILLS & FERRAMENTAS

**Objetivo:** Dar superpoderes ao agente com ferramentas práticas.

**6.1 — Skills essenciais para instalar:**

```bash
# Web Search (pesquisa na internet)
openclaw plugins install @anthropic/web-search
# ou configurar Brave Search API

# Calendar (se usar Google Calendar)
openclaw plugins install @openclaw/google-calendar

# File management
# Já vem built-in

# Cron/Scheduled tasks
# Já vem built-in via HEARTBEAT.md
```

**6.2 — Configurar HEARTBEAT.md** (tarefas programadas)

```bash
nano ~/.openclaw/workspace/HEARTBEAT.md
```

```markdown
# Heartbeat — Tarefas Programadas

## Diário (8h da manhã)
- Verificar novos deals no Bitrix24 que entraram ontem
- Resumir mensagens não lidas importantes
- Listar tarefas com prazo para hoje

## Semanal (Segunda, 9h)
- Gerar resumo da semana anterior (deals fechados, leads novos)
- Identificar deals parados há mais de 5 dias
- Sugerir follow-ups pendentes
```

**6.3 — Configurar TOOLS.md** (permissões de ferramentas)

```bash
nano ~/.openclaw/workspace/TOOLS.md
```

```markdown
# Permissões de Ferramentas

## Aprovação Automática (sem pedir confirmação)
- Pesquisa web
- Leitura de arquivos
- Consulta ao Bitrix24 (GET/leitura)
- Consulta de calendário

## Requer Aprovação (pedir confirmação antes)
- Criar/editar deal no Bitrix24
- Criar/editar tarefa no Bitrix24
- Enviar mensagem no chat do Bitrix24
- Deletar qualquer registro
- Executar comandos no terminal
- Modificar arquivos do sistema
```

**✅ Checkpoint Fase 6:**
- [ ] Web search funcionando
- [ ] Skill Bitrix24 registrado
- [ ] HEARTBEAT.md configurado
- [ ] TOOLS.md com permissões definidas
- [ ] Teste: "Pesquise sobre brindes sustentáveis 2026" → resposta com dados da web

---

### FASE 7 — SEGURANÇA & HARDENING

**Objetivo:** Blindar o agente para uso em produção.

**7.1 — Configurações críticas de segurança:**

```bash
# Bind gateway apenas ao localhost
# No openclaw.json:
{
  "gateway": {
    "host": "127.0.0.1",
    "port": 18789
  }
}
```

**7.2 — Habilitar exec_approval:**
```json
{
  "tools": {
    "exec_approval": true,
    "sandbox": {
      "mode": "non-main"
    }
  }
}
```

**7.3 — SSL/HTTPS** (obrigatório para webhooks em produção)
```bash
# Instalar Certbot
sudo apt install certbot -y

# Se tiver domínio apontando para o VPS:
sudo certbot certonly --standalone -d openclaw.seudominio.com.br

# Configurar reverse proxy com Nginx
sudo apt install nginx -y
```

Configuração Nginx:
```nginx
server {
    listen 443 ssl;
    server_name openclaw.seudominio.com.br;
    
    ssl_certificate /etc/letsencrypt/live/openclaw.seudominio.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/openclaw.seudominio.com.br/privkey.pem;
    
    location / {
        proxy_pass http://127.0.0.1:18789;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    location /hooks/ {
        proxy_pass http://127.0.0.1:18789;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        # Rate limiting para webhooks
        limit_req zone=webhooks burst=10 nodelay;
    }
}
```

**7.4 — Não fazer:**
- ❌ Rodar como root
- ❌ Expor gateway na interface 0.0.0.0
- ❌ Usar senhas fracas
- ❌ Instalar skills da comunidade sem verificar
- ❌ Guardar API keys em repos/código
- ❌ Dar permissão de escrita irrestrita ao agente

**✅ Checkpoint Fase 7:**
- [ ] Gateway bound a 127.0.0.1
- [ ] exec_approval habilitado
- [ ] SSL/HTTPS configurado (se usar domínio)
- [ ] Nginx como reverse proxy
- [ ] Firewall revisado
- [ ] API keys em variáveis de ambiente (não hardcoded)

---

### FASE 8 — OPERAÇÃO 24/7 & MONITORAMENTO

**Objetivo:** Garantir que o agente nunca caia e seja observável.

**8.1 — Configurar como serviço systemd:**

```bash
sudo nano /etc/systemd/system/openclaw-gateway.service
```

```ini
[Unit]
Description=OpenClaw Gateway
After=network.target

[Service]
Type=simple
User=openclaw
WorkingDirectory=/home/openclaw/my-agent
ExecStart=/home/openclaw/.nvm/versions/node/v22.x.x/bin/openclaw gateway start --foreground
Restart=always
RestartSec=10
Environment=PATH=/home/openclaw/.nvm/versions/node/v22.x.x/bin:/usr/local/bin:/usr/bin:/bin

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable openclaw-gateway
sudo systemctl start openclaw-gateway

# Verificar status
systemctl status openclaw-gateway

# Ver logs em tempo real
journalctl -u openclaw-gateway -f
```

**8.2 — Backup automático:**

```bash
# Criar script de backup
nano /home/openclaw/backup.sh
```

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/openclaw/backups"
mkdir -p $BACKUP_DIR

# Backup do workspace (SOUL.md, AGENTS.md, memories, skills, config)
tar czf "$BACKUP_DIR/openclaw_$DATE.tar.gz" \
  ~/.openclaw/workspace/ \
  ~/.openclaw/openclaw.json \
  ~/.openclaw/agents/ \
  ~/.openclaw/config/

# Manter apenas últimos 30 backups
ls -t $BACKUP_DIR/openclaw_*.tar.gz | tail -n +31 | xargs rm -f 2>/dev/null

echo "Backup concluído: openclaw_$DATE.tar.gz"
```

```bash
chmod +x /home/openclaw/backup.sh

# Agendar backup diário às 3h da manhã
crontab -e
# Adicionar:
0 3 * * * /home/openclaw/backup.sh >> /home/openclaw/backups/backup.log 2>&1
```

**8.3 — Health check:**

```bash
# Criar script de monitoramento
nano /home/openclaw/healthcheck.sh
```

```bash
#!/bin/bash
# Verificar se o gateway está rodando
if ! systemctl is-active --quiet openclaw-gateway; then
    echo "$(date): OpenClaw Gateway DOWN! Reiniciando..." >> /home/openclaw/health.log
    sudo systemctl restart openclaw-gateway
fi
```

```bash
chmod +x /home/openclaw/healthcheck.sh

# Verificar a cada 5 minutos
crontab -e
# Adicionar:
*/5 * * * * /home/openclaw/healthcheck.sh
```

**8.4 — Monitoramento de custos:**

Verificar regularmente no console da Anthropic:
- https://console.anthropic.com/billing
- Configurar alertas de gasto
- Revisar semanalmente qual modelo está consumindo mais

**✅ Checkpoint Fase 8:**
- [ ] OpenClaw rodando como serviço systemd
- [ ] Auto-restart configurado
- [ ] Backup diário automático
- [ ] Health check a cada 5 minutos
- [ ] Logs acessíveis via journalctl
- [ ] Alertas de custo configurados na Anthropic

---

## 📊 RESUMO DE CUSTOS MENSAIS ESTIMADOS

| Item | Custo Estimado |
|------|---------------|
| Hostinger VPS KVM 2 | ~$8.99/mês |
| API Anthropic (uso moderado) | ~$35-80/mês |
| Domínio (opcional) | ~$1/mês |
| **TOTAL** | **~$45-90/mês** |

---

## 🔄 FLUXO PÓS-INSTALAÇÃO (Primeiros 7 Dias)

| Dia | Atividade |
|-----|-----------|
| **Dia 1** | Conversar livremente com o agente, testar personalidade e tom |
| **Dia 2** | Testar integrações (WhatsApp, Bitrix24 webhook) |
| **Dia 3** | Ajustar SOUL.md baseado nas respostas do Dia 1-2 |
| **Dia 4** | Configurar skills e heartbeat |
| **Dia 5** | Integrar primeiro bot Lovable (Oráculo) |
| **Dia 6** | Testar cenários de erro e recovery |
| **Dia 7** | Revisar custos, ajustar modelos, documentar learnings |

---

## ⚠️ RISCOS E MITIGAÇÕES

| Risco | Probabilidade | Impacto | Mitigação |
|-------|:---:|:---:|-----------|
| Ban do WhatsApp | Média | Alto | Usar número dedicado; começar com Telegram como backup |
| Custo de API explode | Baixa | Médio | Alertas de gasto; roteamento multi-modelo; limites diários |
| Agente dá resposta errada | Média | Médio | Guardrails no SOUL.md; exec_approval; testes regulares |
| VPS cai | Baixa | Alto | Systemd restart; health checks; backup diário |
| Segurança comprometida | Baixa | Muito Alto | Firewall; localhost only; SSL; tokens fortes; não rodar como root |
| Webhook Bitrix24 falha | Média | Médio | Retry automático; logs; Hookdeck como intermediário |

---

## 📚 REFERÊNCIAS E DOCUMENTAÇÃO

| Recurso | URL |
|---------|-----|
| Docs oficiais OpenClaw | https://docs.openclaw.ai |
| GitHub OpenClaw | https://github.com/openclaw/openclaw |
| SOUL.md Template | https://docs.openclaw.ai/reference/templates/SOUL |
| Webhooks Guide | https://docs.openclaw.ai/automation/webhook |
| Hostinger OpenClaw Guide | https://www.hostinger.com/support/how-to-install-openclaw-on-hostinger-vps/ |
| ClawHub (Skills) | https://github.com/openclaw/clawhub |
| Anthropic Console | https://console.anthropic.com |
| Bitrix24 REST API | https://www.bitrix24.com/apps/webhooks.php |

---

*Documento gerado em 31/03/2026 — Versão 1.0*
*Próxima revisão: após conclusão da Fase 2 (instalação)*
