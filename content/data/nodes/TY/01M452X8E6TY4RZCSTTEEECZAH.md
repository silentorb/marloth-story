---
title: Inspiration
created_at: 2026-10-10T16:02:44.583Z
modified_at: 2026-10-10T18:19:25.532Z
---
```json {type="node-filter"}
{
  "nodes": {
    "association": {
      "id": "association",
      "type": "literal",
      "inputs": {
        "value": "01KXBNPNJDENZ9BXN5BYZ7JKPR"
      }
    },
    "direction": {
      "id": "direction",
      "type": "literal",
      "inputs": {
        "value": 0
      }
    },
    "hosts": {
      "id": "hosts",
      "type": "hosts_projection",
      "inputs": {}
    }
  },
  "edges": {
    "e1": {
      "from": {
        "node": "association",
        "port": "value"
      },
      "to": {
        "node": "hosts",
        "port": "association"
      }
    },
    "e2": {
      "from": {
        "node": "direction",
        "port": "value"
      },
      "to": {
        "node": "hosts",
        "port": "direction"
      }
    }
  }
}
```

