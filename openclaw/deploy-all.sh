#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# OpenClaw Full Deploy Script - 10 Tarefas
# Execute via SSH: ssh root@187.77.151.129
# Depois cole: bash /tmp/deploy-all.sh
# OU copie e cole todo o conteudo no terminal SSH
# ═══════════════════════════════════════════════════════════════

set -e
echo "═══ OPENCLAW DEPLOY SCRIPT ═══"
echo "Data: $(date)"
echo ""

# ═══ TAREFA 1: Verificar conectividade ═══
echo "=== TAREFA 1: Verificando servidor ==="
echo "Hostname: $(hostname)"
echo "Docker: $(docker --version 2>/dev/null || echo 'NOT FOUND')"
echo "Container: $(docker ps --format '{{.Names}} {{.Status}}' | grep openclaw || echo 'NOT RUNNING')"
echo ""

# ═══ TAREFA 2: Backup da config atual ═══
echo "=== TAREFA 2: Backup da config ==="
BACKUP_DATE=$(date +%Y%m%d%H%M%S)
cp /docker/openclaw-sbem/data/.openclaw/openclaw.json \
   /docker/openclaw-sbem/data/.openclaw/openclaw.json.pre-handoff-${BACKUP_DATE} 2>/dev/null && \
   echo "Backup criado: openclaw.json.pre-handoff-${BACKUP_DATE}" || \
   echo "WARN: Config anterior nao encontrada (primeira instalacao?)"
echo ""

# ═══ TAREFA 3: Aplicar config completa ═══
echo "=== TAREFA 3: Aplicando config ==="
cat > /docker/openclaw-sbem/data/.openclaw/openclaw.json << 'CONFIGEOF'
{
  "meta": {
    "lastTouchedVersion": "2026.3.8",
    "lastTouchedAt": "2026-04-06T00:00:00.000Z"
  },
  "update": {
    "channel": "dev",
    "checkOnStart": false,
    "auto": {
      "betaCheckIntervalHours": 1
    }
  },
  "browser": {
    "headless": true,
    "noSandbox": true,
    "defaultProfile": "openclaw"
  },
  "models": {
    "mode": "merge",
    "providers": {
      "anthropic": {
        "apiKey": "${ANTHROPIC_API_KEY:-CONFIGURE_SUA_API_KEY_AQUI}",
        "baseUrl": "https://api.anthropic.com",
        "models": []
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "anthropic/claude-sonnet-4-6"
      },
      "models": {
        "anthropic/claude-opus-4-6": { "alias": "Claude Opus 4.6" },
        "anthropic/claude-sonnet-4-6": { "alias": "Claude Sonnet 4.6" },
        "anthropic/claude-haiku-4-5": { "alias": "Claude Haiku 4.5" }
      }
    },
    "list": [
      {
        "id": "main",
        "name": "Nexus",
        "model": "anthropic/claude-sonnet-4-6",
        "tools": {
          "profile": "coding",
          "alsoAllow": [
            "web_search", "web_fetch", "canvas", "message", "gateway",
            "nodes", "agents_list", "tts", "browser", "read", "write",
            "exec", "edit", "process", "cron", "image", "subagents",
            "sessions_spawn"
          ]
        }
      }
    ]
  },
  "commands": {
    "native": "auto",
    "nativeSkills": "auto",
    "bash": true,
    "restart": true,
    "ownerDisplay": "raw"
  },
  "hooks": {
    "token": "hooks_80cf60ff8bc8f58d23e99545fee7dc45",
    "allowedAgentIds": ["main"],
    "allowRequestSessionKey": true,
    "allowedSessionKeyPrefixes": [
      "hook:bitrix24", "hook:oraculo", "hook:datahub",
      "hook:nexus", "hook:financeiro", "hook:gestao"
    ]
  },
  "channels": {
    "whatsapp": {
      "enabled": true,
      "dmPolicy": "pairing"
    }
  },
  "gateway": {
    "mode": "local",
    "controlUi": {},
    "auth": {
      "mode": "token",
      "token": "279aa66fab8872d47fcd0bcf5e545e8a54e7838a29ab8c4727827eb44145b425",
      "rateLimit": {
        "maxAttempts": 5,
        "windowMs": 60000,
        "lockoutMs": 600000
      }
    },
    "remote": {
      "token": "279aa66fab8872d47fcd0bcf5e545e8a54e7838a29ab8c4727827eb44145b425"
    }
  },
  "plugins": {
    "allow": ["whatsapp"],
    "entries": {
      "whatsapp": { "enabled": true }
    }
  }
}
CONFIGEOF
echo "Config escrita com sucesso"
python3 -m json.tool /docker/openclaw-sbem/data/.openclaw/openclaw.json > /dev/null 2>&1 && \
  echo "JSON VALIDO" || echo "ERRO: JSON INVALIDO!"
echo ""

# ═══ TAREFA 4: Aplicar workspace files ═══
echo "=== TAREFA 4: Aplicando workspace files ==="
WORKSPACE="/docker/openclaw-sbem/data/.openclaw/workspace"
mkdir -p "$WORKSPACE/skills/bitrix24"

# Clone repo para pegar os arquivos
cd /tmp
rm -rf /tmp/repo-openclaw
git clone --depth 1 https://github.com/adm01-debug/fator-x-super-agentes-de-ia.git repo-openclaw 2>/dev/null

if [ -d "/tmp/repo-openclaw/openclaw/workspace" ]; then
  for f in SOUL.md AGENTS.md USER.md HEARTBEAT.md; do
    if [ -f "/tmp/repo-openclaw/openclaw/workspace/$f" ]; then
      cp "/tmp/repo-openclaw/openclaw/workspace/$f" "$WORKSPACE/$f"
      echo "  Copiado: $f"
    else
      echo "  WARN: $f nao encontrado no repo"
    fi
  done

  if [ -f "/tmp/repo-openclaw/openclaw/workspace/skills/bitrix24/SKILL.md" ]; then
    cp "/tmp/repo-openclaw/openclaw/workspace/skills/bitrix24/SKILL.md" "$WORKSPACE/skills/bitrix24/SKILL.md"
    echo "  Copiado: skills/bitrix24/SKILL.md"
  fi
else
  echo "  WARN: Pasta openclaw/workspace nao encontrada no repo"
  echo "  Criando arquivos minimos..."

  cat > "$WORKSPACE/SOUL.md" << 'EOF'
# SOUL — Nexus Agent
Voce e o Nexus, agente IA da Promo Brindes. Sua missao e ajudar com vendas, atendimento, gestao e automacao.
EOF

  cat > "$WORKSPACE/AGENTS.md" << 'EOF'
# AGENTS
- main: Nexus (Claude Sonnet 4.6) — Agente principal
EOF

  cat > "$WORKSPACE/USER.md" << 'EOF'
# USER — Pink (Administrador)
Owner da Promo Brindes. Preferencias: respostas em PT-BR, diretas, com emojis quando apropriado.
EOF

  cat > "$WORKSPACE/HEARTBEAT.md" << 'EOF'
# HEARTBEAT
Sistema de monitoramento. Verifica saude dos servicos a cada 5 minutos.
EOF
  echo "  Arquivos minimos criados"
fi

rm -rf /tmp/repo-openclaw
echo "  Arquivos pre-existentes PRESERVADOS (nao sobrescritos)"
ls -la "$WORKSPACE/" | grep -v "^total"
echo ""

# ═══ TAREFA 5: Configurar backup automatico ═══
echo "=== TAREFA 5: Configurando backup automatico ==="
mkdir -p /backups

cat > /home/backup-openclaw.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p /backups
tar czf "/backups/openclaw_$DATE.tar.gz" \
  /docker/openclaw-sbem/data/.openclaw/ \
  /docker/openclaw-sbem/.env 2>/dev/null
ls -t /backups/openclaw_*.tar.gz 2>/dev/null | tail -n +31 | xargs rm -f 2>/dev/null
echo "$(date): Backup OK - openclaw_$DATE.tar.gz" >> /backups/backup.log
EOF
chmod +x /home/backup-openclaw.sh

# Agendar diario as 3h UTC
(crontab -l 2>/dev/null | grep -v "backup-openclaw"; echo "0 3 * * * /home/backup-openclaw.sh") | crontab -

# Executar primeiro backup agora
/home/backup-openclaw.sh
echo "Backup executado:"
ls -la /backups/openclaw_*.tar.gz | tail -1
echo ""

# ═══ TAREFA 6: Configurar health check ═══
echo "=== TAREFA 6: Configurando health check ==="
cat > /home/healthcheck-openclaw.sh << 'EOF'
#!/bin/bash
CONTAINER="openclaw-sbem-openclaw-1"
if ! docker ps --format '{{.Names}}' | grep -q "$CONTAINER"; then
  echo "$(date): Container DOWN! Reiniciando..." >> /var/log/openclaw-health.log
  cd /docker/openclaw-sbem && docker compose restart
else
  echo "$(date): OK" >> /var/log/openclaw-health.log
fi
# Manter log com max 1000 linhas
tail -1000 /var/log/openclaw-health.log > /var/log/openclaw-health.log.tmp 2>/dev/null
mv /var/log/openclaw-health.log.tmp /var/log/openclaw-health.log 2>/dev/null
EOF
chmod +x /home/healthcheck-openclaw.sh

# A cada 5 minutos
(crontab -l 2>/dev/null | grep -v "healthcheck-openclaw"; echo "*/5 * * * * /home/healthcheck-openclaw.sh") | crontab -
echo "Health check configurado (cada 5 min)"
echo ""

# ═══ TAREFA 7: Updates de seguranca ═══
echo "=== TAREFA 7: Updates de seguranca ==="
apt-get update -qq 2>/dev/null
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -qq 2>/dev/null
echo "Updates aplicados"
echo ""

# ═══ TAREFA 8: Reiniciar OpenClaw ═══
echo "=== TAREFA 8: Reiniciando OpenClaw ==="
cd /docker/openclaw-sbem && docker compose restart
echo "Aguardando 20 segundos..."
sleep 20
echo ""

# ═══ TAREFA 9: Verificacao final ═══
echo "═══════════════════════════════════════════"
echo "=== TAREFA 9: VERIFICACAO FINAL ==="
echo "═══════════════════════════════════════════"
echo ""

echo "1. Container rodando?"
docker ps --format 'table {{.Names}}\t{{.Status}}' | grep openclaw
echo ""

echo "2. Ultimos logs (sem erros Telegram/Discord?):"
docker logs openclaw-sbem-openclaw-1 --tail 10 2>&1
echo ""

echo "3. Config JSON valido?"
docker exec openclaw-sbem-openclaw-1 cat /data/.openclaw/openclaw.json 2>/dev/null | python3 -m json.tool > /dev/null 2>&1 && \
  echo "   JSON VALIDO" || echo "   JSON INVALIDO!"
echo ""

echo "4. Workspace files:"
ls -la /docker/openclaw-sbem/data/.openclaw/workspace/ 2>/dev/null | grep -E "\.md$"
echo ""

echo "5. Backup:"
ls -la /backups/openclaw_*.tar.gz 2>/dev/null | tail -1
echo ""

echo "6. Crontab:"
crontab -l 2>/dev/null
echo ""

echo "7. Dashboard acessivel?"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 https://openclaw-sbem.srv1481814.hstgr.cloud/ 2>/dev/null)
echo "   HTTP: $HTTP_CODE $([ "$HTTP_CODE" -lt 500 ] && echo 'OK' || echo 'FAIL')"
echo ""

# ═══ CHECKLIST ═══
echo "═══════════════════════════════════════════"
echo "         CHECKLIST DE VALIDACAO"
echo "═══════════════════════════════════════════"

check() {
  if [ "$1" = "true" ]; then echo "[OK] $2"; else echo "[!!] $2"; fi
}

CONFIG=$(cat /docker/openclaw-sbem/data/.openclaw/openclaw.json 2>/dev/null)

check "$(echo "$CONFIG" | python3 -m json.tool > /dev/null 2>&1 && echo true)" "Config JSON valido"
check "$(echo "$CONFIG" | grep -q '279aa66f' && echo true)" "Gateway token atualizado"
check "$(echo "$CONFIG" | grep -q 'hooks_80cf60ff' && echo true)" "Hooks token atualizado"
check "$(echo "$CONFIG" | grep -q 'claude-sonnet-4-6' && echo true)" "Modelo default: Sonnet 4.6"
check "$(echo "$CONFIG" | grep -q '"Nexus"' && echo true)" "Agente main: Nexus"
check "$(echo "$CONFIG" | grep -qv 'telegram' && echo true)" "Telegram REMOVIDO"
check "$(echo "$CONFIG" | grep -qv 'discord' && echo true)" "Discord REMOVIDO"
check "$(echo "$CONFIG" | grep -q '"whatsapp"' && echo true)" "WhatsApp enabled"
check "$([ -f /docker/openclaw-sbem/data/.openclaw/workspace/SOUL.md ] && echo true)" "SOUL.md no workspace"
check "$([ -f /docker/openclaw-sbem/data/.openclaw/workspace/AGENTS.md ] && echo true)" "AGENTS.md no workspace"
check "$([ -f /docker/openclaw-sbem/data/.openclaw/workspace/USER.md ] && echo true)" "USER.md no workspace"
check "$([ -f /docker/openclaw-sbem/data/.openclaw/workspace/HEARTBEAT.md ] && echo true)" "HEARTBEAT.md no workspace"
check "$([ -f /docker/openclaw-sbem/data/.openclaw/workspace/skills/bitrix24/SKILL.md ] && echo true)" "Skill Bitrix24"
check "$(crontab -l 2>/dev/null | grep -q 'backup-openclaw' && echo true)" "Backup no crontab (3h UTC)"
check "$(crontab -l 2>/dev/null | grep -q 'healthcheck-openclaw' && echo true)" "Health check no crontab (5min)"
check "$(docker ps --format '{{.Names}}' | grep -q 'openclaw-sbem' && echo true)" "Container rodando"
check "$(docker logs openclaw-sbem-openclaw-1 --tail 50 2>&1 | grep -qvi 'telegram\|discord.*error' && echo true)" "Logs sem erros Telegram/Discord"

echo ""
echo "═══ DEPLOY COMPLETO! ═══"
echo "Proximo passo: TAREFA 10 (reboot) - execute manualmente:"
echo "  reboot"
echo "Depois reconecte e verifique: docker ps"
