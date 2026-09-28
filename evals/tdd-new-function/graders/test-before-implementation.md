---
type: tool_order
before: { tool: Write, input_match: 'slug[^"]*\.test\.js' }
after: { tool: Write, input_match: 'src/slug\.js' }
---
