---
title: Inspiration
created_at: 2026-10-10T16:02:44.583Z
modified_at: 2026-10-10T18:19:25.532Z
predicate:
  nodes:
    - id: association
      type: literal
      inputs:
        value: 01KXBNPNJDENZ9BXN5BYZ7JKPR
    - id: direction
      type: literal
      inputs:
        value: 0
    - id: hosts
      type: hosts_projection
      inputs: {}
  edges:
    - id: e1
      from:
        node: association
        port: value
      to:
        node: hosts
        port: association
    - id: e2
      from:
        node: direction
        port: value
      to:
        node: hosts
        port: direction
---
