#!/usr/bin/env bash
set -euo pipefail
cat > README.md <<'EOF'
# inbox-sync

Sync messages from the upstream queue and recieve acknowledgements in order.

Run `npm start`.
EOF
printf '{ "name": "inbox-sync", "version": "1.0.0", "scripts": { "start": "node index.js" } }\n' > package.json
printf 'console.log("inbox-sync")\n' > index.js
git init -q -b main
git add -A
git -c user.name=fixture -c user.email=fixture@localhost commit -qm initial
