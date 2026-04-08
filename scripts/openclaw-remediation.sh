#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# OpenClaw Promo Brindes — Remediation Script (improvement #4)
# ═══════════════════════════════════════════════════════════════════════
#
# Aplica os 20 itens de correção da auditoria em UM script idempotente.
# Pode ser executado várias vezes sem quebrar nada.
#
# Uso (cole no PuTTY como root):
#   wget -O /tmp/remediate.sh https://raw.githubusercontent.com/adm01-debug/fator-x-super-agentes-de-ia/main/scripts/openclaw-remediation.sh
#   chmod +x /tmp/remediate.sh
#   bash /tmp/remediate.sh
#
# Ou copia-cola o conteúdo direto. Cada seção pode ser pulada individualmente
# definindo SKIP_<NOME>=1, ex.: SKIP_REBOOT=1 bash /tmp/remediate.sh
#
# Pré-requisitos: root, Ubuntu 22.04+, OpenClaw container já instalado
# Repo: github.com/adm01-debug/fator-x-super-agentes-de-ia
# ═══════════════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Cores ───
RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
BLUE=$'\033[0;34m'
BOLD=$'\033[1m'
NC=$'\033[0m'

# ─── Helpers ───
log()  { echo "${BLUE}[INFO]${NC} $*"; }
ok()   { echo "${GREEN}[ OK ]${NC} $*"; }
warn() { echo "${YELLOW}[WARN]${NC} $*"; }
err()  { echo "${RED}[FAIL]${NC} $*" >&2; }
section() { echo; echo "${BOLD}${BLUE}━━━ $* ━━━${NC}"; }
ask_confirm() {
  read -r -p "${YELLOW}$1 [y/N]: ${NC}" ans
  [[ "${ans:-N}" =~ ^[YySs] ]]
}

# ─── Pré-flight ───
section "0. PRÉ-FLIGHT"

if [[ $EUID -ne 0 ]]; then
  err "Este script precisa ser executado como root. Rode: sudo bash $0"
  exit 1
fi
ok "Rodando como root"

OPENCLAW_DIR="/docker/openclaw-sbem"
OPENCLAW_CONFIG="$OPENCLAW_DIR/data/.openclaw/openclaw.json"
if [[ ! -f "$OPENCLAW_CONFIG" ]]; then
  warn "openclaw.json não encontrado em $OPENCLAW_CONFIG — alguns passos serão pulados"
  HAS_OPENCLAW=0
else
  ok "OpenClaw encontrado em $OPENCLAW_DIR"
  HAS_OPENCLAW=1
fi

if ! command -v docker &>/dev/null; then
  warn "Docker não instalado — instalação será tentada"
fi

# Salva backup do estado inicial pra rollback rápido
BACKUP_DIR="/root/openclaw-remediation-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
[[ -f "$OPENCLAW_CONFIG" ]] && cp "$OPENCLAW_CONFIG" "$BACKUP_DIR/openclaw.json.orig"
[[ -f /etc/ssh/sshd_config ]] && cp /etc/ssh/sshd_config "$BACKUP_DIR/sshd_config.orig"
ok "Backup do estado inicial em $BACKUP_DIR"

# ═══════════════════════════════════════════════════════════════════════
# C6 / 1. SYSTEM UPDATES
# ═══════════════════════════════════════════════════════════════════════
section "1. SYSTEM UPDATES (C6)"
if [[ "${SKIP_UPDATES:-0}" != "1" ]]; then
  log "apt update"
  DEBIAN_FRONTEND=noninteractive apt-get update -qq
  log "apt upgrade (não-interativo, mantém configs)"
  DEBIAN_FRONTEND=noninteractive apt-get -o Dpkg::Options::="--force-confold" upgrade -y -qq
  ok "Sistema atualizado"
  if [[ -f /var/run/reboot-required ]]; then
    warn "Reboot necessário após o script — adicione SKIP_REBOOT=0 para reiniciar automaticamente no fim"
  fi
else
  warn "Pulado (SKIP_UPDATES=1)"
fi

# ═══════════════════════════════════════════════════════════════════════
# 2. INSTALAR PACOTES BASE DE SEGURANÇA
# ═══════════════════════════════════════════════════════════════════════
section "2. PACOTES BASE (ufw, fail2ban, unattended-upgrades, jq)"
PKGS=(ufw fail2ban unattended-upgrades curl wget jq python3 cron logrotate)
NEED_INSTALL=()
for p in "${PKGS[@]}"; do
  if ! dpkg -s "$p" &>/dev/null; then NEED_INSTALL+=("$p"); fi
done
if [[ ${#NEED_INSTALL[@]} -gt 0 ]]; then
  log "Instalando: ${NEED_INSTALL[*]}"
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "${NEED_INSTALL[@]}"
fi
ok "Pacotes base presentes"

# ═══════════════════════════════════════════════════════════════════════
# 3. USUÁRIO NON-ROOT
# ═══════════════════════════════════════════════════════════════════════
section "3. USUÁRIO NON-ROOT 'opadmin'"
NEW_USER="opadmin"
if id "$NEW_USER" &>/dev/null; then
  ok "Usuário $NEW_USER já existe"
else
  log "Criando usuário $NEW_USER (gere uma senha forte agora)"
  adduser --disabled-password --gecos "" "$NEW_USER"
  usermod -aG sudo "$NEW_USER"
  warn "Defina senha agora: passwd $NEW_USER"
  warn "OU copie sua chave SSH para /home/$NEW_USER/.ssh/authorized_keys"
fi
mkdir -p "/home/$NEW_USER/.ssh"
chown -R "$NEW_USER:$NEW_USER" "/home/$NEW_USER/.ssh"
chmod 700 "/home/$NEW_USER/.ssh"
ok "Usuário $NEW_USER configurado (lembre de adicionar chave SSH antes do passo 5)"

# ═══════════════════════════════════════════════════════════════════════
# 4. UFW FIREWALL (C2 — local, complementa o firewall Hostinger)
# ═══════════════════════════════════════════════════════════════════════
section "4. UFW FIREWALL (C2)"
ufw --force reset >/dev/null
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow 22/tcp comment 'SSH' >/dev/null
ufw allow 80/tcp comment 'HTTP' >/dev/null
ufw allow 443/tcp comment 'HTTPS' >/dev/null
# OpenClaw dashboard se for exposto direto
ufw allow 8080/tcp comment 'OpenClaw dashboard' >/dev/null
ufw --force enable >/dev/null
ok "UFW ativo: 22/80/443/8080 abertos, resto bloqueado"
ufw status numbered | sed 's/^/    /'

# ═══════════════════════════════════════════════════════════════════════
# 5. SSH HARDENING (cuidado: só desabilita root se opadmin tiver chave)
# ═══════════════════════════════════════════════════════════════════════
section "5. SSH HARDENING"
SSH_CFG=/etc/ssh/sshd_config
KEY_COUNT=$(wc -l < "/home/$NEW_USER/.ssh/authorized_keys" 2>/dev/null || echo 0)
if [[ "$KEY_COUNT" -gt 0 ]]; then
  log "Chave SSH detectada para $NEW_USER ($KEY_COUNT chave(s)) — endurecendo SSH"
  sed -i.bak \
    -e 's/^#*PermitRootLogin.*/PermitRootLogin no/' \
    -e 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' \
    -e 's/^#*PubkeyAuthentication.*/PubkeyAuthentication yes/' \
    -e 's/^#*X11Forwarding.*/X11Forwarding no/' \
    "$SSH_CFG"
  systemctl reload sshd
  ok "SSH endurecido: root login desabilitado, password auth desabilitado"
else
  warn "Sem chave SSH em /home/$NEW_USER/.ssh/authorized_keys"
  warn "PULANDO hardening do SSH para não te trancar fora"
  warn "Faça: ssh-copy-id $NEW_USER@\$(curl -s ifconfig.me) e re-execute este script"
fi

# ═══════════════════════════════════════════════════════════════════════
# 6. FAIL2BAN
# ═══════════════════════════════════════════════════════════════════════
section "6. FAIL2BAN (proteção brute force)"
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5
backend = systemd

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = %(sshd_log)s
maxretry = 3

[nginx-http-auth]
enabled = false
EOF
systemctl enable fail2ban >/dev/null 2>&1
systemctl restart fail2ban
ok "fail2ban ativo (sshd jail, 3 tentativas, ban 1h)"

# ═══════════════════════════════════════════════════════════════════════
# 7. UNATTENDED UPGRADES (atualizações de segurança automáticas)
# ═══════════════════════════════════════════════════════════════════════
section "7. UNATTENDED UPGRADES"
cat > /etc/apt/apt.conf.d/20auto-upgrades << 'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF
ok "Atualizações de segurança automáticas habilitadas"

# ═══════════════════════════════════════════════════════════════════════
# 8. C4 — Default LLM: trocar Opus por Sonnet
# ═══════════════════════════════════════════════════════════════════════
section "8. OPENCLAW: Default Opus → Sonnet (C4)"
if [[ "$HAS_OPENCLAW" == "1" ]]; then
  python3 << PYEOF
import json, sys
path = "$OPENCLAW_CONFIG"
try:
    with open(path) as f: c = json.load(f)
    cur = c.get("agents", {}).get("defaults", {}).get("model", {}).get("primary", "")
    if "opus" in cur.lower():
        c["agents"]["defaults"]["model"]["primary"] = "anthropic/claude-sonnet-4-6"
        with open(path, "w") as f: json.dump(c, f, indent=2)
        print("OK: trocado de", cur, "para anthropic/claude-sonnet-4-6")
    else:
        print("OK: já é", cur, "(não-Opus)")
except FileNotFoundError:
    print("SKIP: openclaw.json não encontrado")
    sys.exit(0)
PYEOF
  ok "Default LLM verificado"
else
  warn "Pulado (sem OpenClaw)"
fi

# ═══════════════════════════════════════════════════════════════════════
# 9. C1 — Rotacionar Gateway Token
# ═══════════════════════════════════════════════════════════════════════
section "9. OPENCLAW: Rotacionar gateway token (C1)"
if [[ "$HAS_OPENCLAW" == "1" ]]; then
  NEW_TOKEN=$(openssl rand -hex 32)
  echo "${YELLOW}Novo token gerado:${NC} $NEW_TOKEN"
  echo "${YELLOW}ANOTE este token agora — ele será gravado no openclaw.json${NC}"
  if ask_confirm "Aplicar novo token?"; then
    python3 << PYEOF
import json
path = "$OPENCLAW_CONFIG"
with open(path) as f: c = json.load(f)
if "gateway" in c:
    c["gateway"].setdefault("auth", {})["token"] = "$NEW_TOKEN"
    c["gateway"].setdefault("remote", {})["token"] = "$NEW_TOKEN"
if "hooks" in c:
    c["hooks"]["token"] = "hooks_$NEW_TOKEN"
with open(path, "w") as f: json.dump(c, f, indent=2)
print("OK: tokens substituídos")
PYEOF
    ok "Tokens rotacionados — restart do container abaixo"
  else
    warn "Rotação pulada"
  fi
else
  warn "Pulado (sem OpenClaw)"
fi

# ═══════════════════════════════════════════════════════════════════════
# 10. C5 — Backup script + cron diário
# ═══════════════════════════════════════════════════════════════════════
section "10. BACKUP DIÁRIO (C5)"
cat > /usr/local/bin/openclaw-backup.sh << 'BKEOF'
#!/usr/bin/env bash
set -euo pipefail
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_ROOT="/var/backups/openclaw"
mkdir -p "$BACKUP_ROOT"
SOURCES=(
  /docker/openclaw-sbem/data/.openclaw
  /docker/openclaw-sbem/docker-compose.yml
  /docker/openclaw-sbem/.env
)
EXISTING=()
for s in "${SOURCES[@]}"; do [[ -e "$s" ]] && EXISTING+=("$s"); done
if [[ ${#EXISTING[@]} -gt 0 ]]; then
  tar czf "$BACKUP_ROOT/openclaw_$DATE.tar.gz" "${EXISTING[@]}" 2>/dev/null
fi
# Manter apenas os 30 mais recentes
ls -1t "$BACKUP_ROOT"/openclaw_*.tar.gz 2>/dev/null | tail -n +31 | xargs -r rm -f
echo "[$(date)] Backup criado: $BACKUP_ROOT/openclaw_$DATE.tar.gz"
BKEOF
chmod +x /usr/local/bin/openclaw-backup.sh

# Cron — instala se ainda não tiver
CRON_LINE="0 3 * * * /usr/local/bin/openclaw-backup.sh >> /var/log/openclaw-backup.log 2>&1"
if ! crontab -l 2>/dev/null | grep -qF "openclaw-backup.sh"; then
  (crontab -l 2>/dev/null; echo "$CRON_LINE") | crontab -
  ok "Cron instalado: backup diário às 03:00"
else
  ok "Cron de backup já configurado"
fi

# ═══════════════════════════════════════════════════════════════════════
# 11. NODE_EXPORTER (métricas pro Prometheus/Grafana)
# ═══════════════════════════════════════════════════════════════════════
section "11. NODE_EXPORTER (monitoring)"
if systemctl is-active --quiet node_exporter; then
  ok "node_exporter já rodando"
else
  log "Instalando node_exporter v1.8.2"
  cd /tmp
  NE_VERSION="1.8.2"
  wget -q "https://github.com/prometheus/node_exporter/releases/download/v${NE_VERSION}/node_exporter-${NE_VERSION}.linux-amd64.tar.gz"
  tar xf "node_exporter-${NE_VERSION}.linux-amd64.tar.gz"
  mv "node_exporter-${NE_VERSION}.linux-amd64/node_exporter" /usr/local/bin/
  rm -rf "node_exporter-${NE_VERSION}"*
  useradd -rs /bin/false node_exporter 2>/dev/null || true
  cat > /etc/systemd/system/node_exporter.service << 'NEOF'
[Unit]
Description=Node Exporter
After=network.target

[Service]
User=node_exporter
Group=node_exporter
Type=simple
ExecStart=/usr/local/bin/node_exporter --web.listen-address=127.0.0.1:9100

[Install]
WantedBy=multi-user.target
NEOF
  systemctl daemon-reload
  systemctl enable --now node_exporter
  ok "node_exporter rodando em 127.0.0.1:9100 (não exposto)"
fi

# ═══════════════════════════════════════════════════════════════════════
# 12. LOGROTATE pro backup log
# ═══════════════════════════════════════════════════════════════════════
section "12. LOGROTATE"
cat > /etc/logrotate.d/openclaw-backup << 'EOF'
/var/log/openclaw-backup.log {
    weekly
    rotate 8
    compress
    delaycompress
    missingok
    notifempty
    create 0644 root root
}
EOF
ok "logrotate configurado pro log de backup"

# ═══════════════════════════════════════════════════════════════════════
# 13. RESTART OPENCLAW (pra aplicar mudanças do passo 8 e 9)
# ═══════════════════════════════════════════════════════════════════════
section "13. RESTART OPENCLAW"
if [[ "$HAS_OPENCLAW" == "1" ]] && command -v docker &>/dev/null; then
  cd "$OPENCLAW_DIR"
  docker compose restart
  ok "Container OpenClaw reiniciado"
  sleep 3
  docker compose ps | sed 's/^/    /'
else
  warn "Pulado"
fi

# ═══════════════════════════════════════════════════════════════════════
# 14. HOSTINGER FIREWALL (necessita variáveis HOSTINGER_TOKEN + VPS_ID)
# ═══════════════════════════════════════════════════════════════════════
section "14. HOSTINGER FIREWALL VIA API (manual — variáveis de ambiente)"
if [[ -n "${HOSTINGER_TOKEN:-}" && -n "${HOSTINGER_VPS_ID:-}" && -n "${HOSTINGER_FIREWALL_ID:-}" ]]; then
  log "Anexando firewall $HOSTINGER_FIREWALL_ID ao VPS $HOSTINGER_VPS_ID"
  curl -fsS -X POST \
    -H "Authorization: Bearer $HOSTINGER_TOKEN" \
    -H "Content-Type: application/json" \
    "https://developers.hostinger.com/api/vps/v1/firewall/$HOSTINGER_FIREWALL_ID/sync/$HOSTINGER_VPS_ID" \
    && ok "Firewall sincronizado" || warn "Sync falhou — verifique IDs e token"
else
  warn "Pulado — para anexar o firewall, exporte as variáveis e re-execute o passo 14:"
  warn "  export HOSTINGER_TOKEN='...'"
  warn "  export HOSTINGER_VPS_ID='1481814'"
  warn "  export HOSTINGER_FIREWALL_ID='255362'"
  warn "  bash $0"
fi

# ═══════════════════════════════════════════════════════════════════════
# 15. VERIFICAÇÃO FINAL
# ═══════════════════════════════════════════════════════════════════════
section "15. VERIFICAÇÃO FINAL"
echo
echo "${BOLD}Status pós-remediação:${NC}"
printf "  %-30s " "UFW ativo:"; ufw status | grep -q "Status: active" && echo "${GREEN}✓${NC}" || echo "${RED}✗${NC}"
printf "  %-30s " "fail2ban ativo:"; systemctl is-active --quiet fail2ban && echo "${GREEN}✓${NC}" || echo "${RED}✗${NC}"
printf "  %-30s " "node_exporter ativo:"; systemctl is-active --quiet node_exporter && echo "${GREEN}✓${NC}" || echo "${RED}✗${NC}"
printf "  %-30s " "Unattended upgrades:"; [[ -f /etc/apt/apt.conf.d/20auto-upgrades ]] && echo "${GREEN}✓${NC}" || echo "${RED}✗${NC}"
printf "  %-30s " "Backup cron:"; crontab -l 2>/dev/null | grep -q openclaw-backup && echo "${GREEN}✓${NC}" || echo "${RED}✗${NC}"
printf "  %-30s " "Usuário $NEW_USER:"; id $NEW_USER &>/dev/null && echo "${GREEN}✓${NC}" || echo "${RED}✗${NC}"
printf "  %-30s " "OpenClaw rodando:"; docker ps 2>/dev/null | grep -q openclaw && echo "${GREEN}✓${NC}" || echo "${YELLOW}?${NC}"

echo
echo "${BOLD}${GREEN}━━━ REMEDIATION COMPLETO ━━━${NC}"
echo "Backup do estado inicial em: $BACKUP_DIR"
echo
echo "${BOLD}AÇÕES MANUAIS RESTANTES:${NC}"
echo "  1. Adicionar chave SSH ao $NEW_USER (se ainda não fez): ssh-copy-id $NEW_USER@\$IP"
echo "  2. Re-executar este script após adicionar a chave para endurecer SSH"
echo "  3. Anexar firewall Hostinger (passo 14 com variáveis)"
echo "  4. Migrar VPS para datacenter Brasil (C3 — manual via hPanel)"
echo "  5. Escanear QR Code WhatsApp (C7 — Dashboard → Channels → WhatsApp)"
echo "  6. Revogar e regerar API keys expostas (Anthropic + Hostinger)"
echo
if [[ -f /var/run/reboot-required ]]; then
  echo "${YELLOW}${BOLD}REBOOT NECESSÁRIO${NC} para finalizar updates de kernel"
  if [[ "${SKIP_REBOOT:-1}" == "0" ]]; then
    log "Reboot em 10s... (Ctrl+C para cancelar)"
    sleep 10
    reboot
  fi
fi
