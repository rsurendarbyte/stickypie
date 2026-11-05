#!/bin/zsh
# Keeps the production admin running on this Mac at http://localhost:3200:
# starts it at login and restarts it if it stops. Runs from Stickypie-main
# (the prod code), so dev work never reaches it.
#
#   zsh scripts/admin-prod-service.sh          install / restart
#   zsh scripts/admin-prod-service.sh stop     remove it
set -e
LABEL=in.stickypie.admin-prod
PLIST=~/Library/LaunchAgents/$LABEL.plist
LOG=~/Library/Logs/stickypie/admin-prod.log
NODE_BIN=$(dirname "$(command -v npm)")
DOMAIN=gui/$(id -u)

launchctl bootout $DOMAIN/$LABEL 2>/dev/null || true
if [[ $1 == stop ]]; then
  rm -f $PLIST
  echo "Admin prod service removed."
  exit 0
fi

mkdir -p ~/Library/LaunchAgents ~/Library/Logs/stickypie
cat > $PLIST <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>WorkingDirectory</key><string>/Users/bft/Documents/Stickypie-main</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE_BIN/npm</string><string>run</string><string>admin:prod</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>$NODE_BIN:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>30</integer>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
EOF
launchctl bootstrap $DOMAIN $PLIST
echo "Admin prod starting at http://localhost:3200 (build takes about a minute). Log: $LOG"
