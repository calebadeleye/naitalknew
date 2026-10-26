#!/bin/bash
# Installs the Naitalk Call business tools on mail.naitalk.com, next to the
# media server that cradle/deploy/livekit/install.sh set up:
#   - /opt/naitalk-call/{lib,sync,router}.mjs
#   - naitalk-call-router.service  (webhooks, 127.0.0.1:7890, user naitalk-call)
#   - naitalk-call-sync.timer      (pulls keys from Naitalk every 5 minutes, as root)
#   - /etc/naitalk-call/sync.env   (API address and sync token; root:naitalk-call 0640)
#
# Safe to run again. It does not edit livekit.yaml or restart naitalk-call:
# the first sync does that, and only while no one is in a call.
# Usage (as root, from this folder):  bash install.sh
set -euo pipefail

SRC=$(cd "$(dirname "$0")" && pwd)
OPT=/opt/naitalk-call
CONF_DIR=/etc/naitalk-call
ENV_FILE=$CONF_DIR/sync.env
SVC=naitalk-call

[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }
id $SVC >/dev/null 2>&1 || { echo "user $SVC is missing; install the media server first" >&2; exit 1; }
[ -f $CONF_DIR/livekit.yaml ] || { echo "$CONF_DIR/livekit.yaml is missing" >&2; exit 1; }

NODE=$(command -v node || true)
[ -n "$NODE" ] || { echo "node is not installed" >&2; exit 1; }
"$NODE" -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 18 ? 0 : 1)' || { echo "node 18 or newer is needed (found $("$NODE" -v))" >&2; exit 1; }

# 1. Code -----------------------------------------------------------------------
install -d -m 0755 $OPT
install -m 0644 "$SRC/lib.mjs" "$SRC/router.mjs" $OPT/
install -m 0755 "$SRC/sync.mjs" $OPT/

# 2. Settings (first run only) ----------------------------------------------------
if [ ! -f $ENV_FILE ]; then
  cat > $ENV_FILE <<'EOF'
# Naitalk Call server tools. The token must match NAITALK_CALL_SYNC_TOKEN in
# the Naitalk Laravel .env.
NAITALK_API_URL=https://www.naitalk.com/api/v1
NAITALK_CALL_SYNC_TOKEN=
EOF
fi
chown root:$SVC $ENV_FILE
chmod 0640 $ENV_FILE

# 3. Services ---------------------------------------------------------------------
cat > /etc/systemd/system/naitalk-call-router.service <<EOF
[Unit]
Description=Naitalk Call webhook router (sends each business its own room events)
After=network-online.target
Wants=network-online.target

[Service]
User=$SVC
Group=$SVC
EnvironmentFile=$ENV_FILE
ExecStart=$NODE $OPT/router.mjs
Restart=always
RestartSec=2
MemoryMax=128M
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/naitalk-call-sync.service <<EOF
[Unit]
Description=Naitalk Call key sync (Naitalk API -> livekit.yaml)
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=$NODE $OPT/sync.mjs
EOF

cat > /etc/systemd/system/naitalk-call-sync.timer <<'EOF'
[Unit]
Description=Run the Naitalk Call key sync every 5 minutes

[Timer]
OnBootSec=2min
OnUnitActiveSec=5min

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload

if grep -q '^NAITALK_CALL_SYNC_TOKEN=.\+' $ENV_FILE; then
  # Router first: the sync may point LiveKit's webhooks at it straight away.
  # (It writes routes.json before it touches livekit.yaml.)
  systemctl enable naitalk-call-router
  systemctl restart naitalk-call-router
  sleep 1
  curl -fsS http://127.0.0.1:${ROUTER_PORT:-7890}/healthz && echo " <- router answering"
  # First sync now; it waits (status "deferred") if anyone is in a call.
  $NODE $OPT/sync.mjs || true
  systemctl enable --now naitalk-call-sync.timer
  systemctl list-timers naitalk-call-sync.timer --no-pager
else
  echo
  echo "Set NAITALK_CALL_SYNC_TOKEN in $ENV_FILE (the same value as in Naitalk's .env), then run this script again."
fi
