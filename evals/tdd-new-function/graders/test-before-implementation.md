---
type: tool_order
before: { tool: Write, input_match: '"file_path"\s*:\s*"[^"]*slug[^"]*\.test\.js"' }
after: { tool: Write, input_match: '"file_path"\s*:\s*"[^"]*src/slug\.js"' }
---
