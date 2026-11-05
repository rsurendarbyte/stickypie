#!/bin/zsh
# Quiet Mac banner for every new paid order on stickypie.in (scripts/order-alert.mjs):
# starts at login and keeps running.
#
#   zsh scripts/order-alert-service.sh          install / restart
#   zsh scripts/order-alert-service.sh stop     remove it
set -e
LABEL=in.stickypie.order-alert
PLIST=~/Library/LaunchAgents/$LABEL.plist
LOG=~/Library/Logs/stickypie/order-alert.log
NODE_BIN=$(dirname "$(command -v node)")
DOMAIN=gui/$(id -u)

launchctl bootout $DOMAIN/$LABEL 2>/dev/null || true
if [[ $1 == stop ]]; then
  rm -f $PLIST
  echo "Order alerts removed."
  exit 0
fi

mkdir -p ~/Library/LaunchAgents ~/Library/Logs/stickypie
cat > $PLIST <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>WorkingDirectory</key><string>/Users/bft/Documents/Stickypie</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE_BIN/node</string><string>scripts/order-alert.mjs</string><string>--prod</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>30</integer>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
EOF
launchctl bootstrap $DOMAIN $PLIST
echo "Order alerts on. Log: $LOG"
