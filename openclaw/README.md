# OpenClaw - Promo Brindes

Configuracao do agente OpenClaw para a Promo Brindes.

## Infraestrutura
- **VPS**: Hostinger KVM 4 (4 vCPU, 16GB RAM, 200GB NVMe)
- **SO**: Ubuntu 24.04 LTS + Docker + Traefik
- **URL**: https://openclaw-sbem.srv1481814.hstgr.cloud
- **LLM**: Claude Sonnet 4.6 (principal) / Opus 4.6 (complexo) / Haiku 4.5 (simples)

## Canais
- WhatsApp (numero dedicado)
- Webhooks para Bitrix24 e bots Lovable

## Arquivos
- `config/openclaw.json.template` - Template de configuracao (sem credenciais)
- `workspace/SOUL.md` - Identidade do agente
- `workspace/AGENTS.md` - Instrucoes operacionais
- `workspace/USER.md` - Perfil dos usuarios
- `workspace/HEARTBEAT.md` - Tarefas programadas
- `workspace/skills/bitrix24/SKILL.md` - Skill de integracao Bitrix24
- `scripts/backup.sh` - Backup automatico diario
- `scripts/healthcheck.sh` - Health check a cada 5 min

## Setup
1. Copiar `config/openclaw.json.template` para o VPS
2. Substituir valores `CHANGE_ME_*` pelas credenciais reais
3. Copiar workspace/* para o workspace do OpenClaw no VPS
4. Configurar crontab com scripts de backup e healthcheck

## Seguranca
- NUNCA commitar credenciais reais (API keys, tokens)
- Usar o template e substituir no servidor
- Rotacionar tokens regularmente
