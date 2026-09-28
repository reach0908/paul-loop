#!/usr/bin/env bash
set -euo pipefail
commit() { git -c user.name=fixture -c user.email=fixture@localhost commit -qm "$1"; }
mkdir -p src
printf '{ "name": "cart", "version": "1.0.0", "scripts": { "test": "node --test" } }\n' > package.json
cat > src/cart.js <<'EOF'
function total(items) {
  let sum = 0
  for (let i = 0; i < items.length; i++) {
    sum += items[i].price * items[i].qty
  }
  return sum
}

module.exports = { total }
EOF
git init -q -b main
git add -A
commit initial
git switch -q -c feature/cart-discount
cat > src/cart.js <<'EOF'
function total(items, discount = 0) {
  let sum = 0
  for (let i = 0; i <= items.length; i++) {
    sum += items[i].price * items[i].qty
  }
  return sum - discount
}

module.exports = { total }
EOF
git add -A
commit "Support an order-level discount"
# The sandbox cannot run the /usr/bin/git shim (xcrun cannot write its cache), but the real binary
# runs by full path. Point the target's zsh at it, only inside the sandboxed home.
home="$(cd .. && pwd -P)"
if [[ "$home" == /private/tmp/e-*/home ]] && real_git="$(xcrun -f git 2>/dev/null)"; then
  printf 'git() { "%s" "$@"; }\n' "$real_git" > "$home/.zshenv"
fi
