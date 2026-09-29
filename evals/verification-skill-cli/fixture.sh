#!/usr/bin/env bash
set -euo pipefail
mkdir -p bin
printf '{ "name": "todo", "version": "1.0.0", "bin": { "todo": "bin/todo.js" } }\n' > package.json
cat > bin/todo.js <<'JS'
#!/usr/bin/env node
// Minimal todo list. Data lives in $TODO_FILE (default ./todo.json).
const fs = require('node:fs')
const file = process.env.TODO_FILE || 'todo.json'
const load = () => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [])
const save = items => fs.writeFileSync(file, JSON.stringify(items, null, 2) + '\n')
const [cmd, ...args] = process.argv.slice(2)
const items = load()
if (cmd === 'add' && args.length) {
  items.push({ id: items.length + 1, text: args.join(' '), done: false })
  save(items)
  console.log(`added #${items.length}`)
} else if (cmd === 'list') {
  for (const i of items) console.log(`${i.done ? '[x]' : '[ ]'} #${i.id} ${i.text}`)
} else if (cmd === 'done' && args[0]) {
  const item = items.find(i => i.id === Number(args[0]))
  if (!item) { console.error(`no item #${args[0]}`); process.exit(1) }
  item.done = true
  save(items)
  console.log(`done #${item.id}`)
} else {
  console.error('usage: todo add <text> | list | done <id>')
  process.exit(2)
}
JS
chmod +x bin/todo.js
cat > README.md <<'MD'
# todo

A small todo list CLI.

    node bin/todo.js add "buy milk"
    node bin/todo.js list
    node bin/todo.js done 1

Items are stored in `$TODO_FILE` (default `./todo.json`).
MD
git init -q && git add -A && git -c user.name=fixture -c user.email=fixture@example.invalid commit -qm init
