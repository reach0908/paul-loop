---
type: tool_order
before: { tool: Bash, input_match: 'npm (run )?test|node --test' }
after: { tool: Edit, input_match: '"file_path"\s*:\s*"[^"]*src/price\.js"' }
---
