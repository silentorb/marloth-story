---
title: Articles
alias: Articles
modified_at: 2026-08-01T17:01:05.223Z
created_at: 2026-07-18T05:48:56.497Z
---
```tome-block
{
  "componentId": "tome-query.block",
  "data": {
    "version": 1,
    "reactFlow": {
      "nodes": [
        {
          "id": "in",
          "type": "input",
          "position": {
            "x": 0,
            "y": 160
          },
          "data": {
            "inputValues": {}
          }
        },
        {
          "id": "hopMembers",
          "type": "traverse",
          "position": {
            "x": 220,
            "y": 0
          },
          "data": {
            "inputValues": {
              "association": "01KXBNPNJDENZ9BXN5BYZ7JKPT",
              "direction": 0
            }
          }
        },
        {
          "id": "hopHubs",
          "type": "traverse",
          "position": {
            "x": 220,
            "y": 280
          },
          "data": {
            "inputValues": {
              "association": "01KXBNPNJDENZ9BXN5BYZ7JKPT",
              "direction": 1
            }
          }
        },
        {
          "id": "exceptMembers",
          "type": "except",
          "position": {
            "x": 480,
            "y": 160
          },
          "data": {
            "inputValues": {}
          }
        },
        {
          "id": "exceptHubs",
          "type": "except",
          "position": {
            "x": 700,
            "y": 160
          },
          "data": {
            "inputValues": {}
          }
        },
        {
          "id": "sort",
          "type": "sort",
          "position": {
            "x": 920,
            "y": 160
          },
          "data": {
            "inputValues": {
              "column": "title",
              "direction": "asc"
            }
          }
        },
        {
          "id": "project",
          "type": "project",
          "position": {
            "x": 1140,
            "y": 160
          },
          "data": {
            "inputValues": {
              "columns": "id"
            }
          }
        },
        {
          "id": "out",
          "type": "output",
          "position": {
            "x": 1360,
            "y": 160
          },
          "data": {
            "inputValues": {}
          }
        }
      ],
      "edges": [
        {
          "id": "e_in_hopMembers",
          "source": "in",
          "target": "hopMembers",
          "sourceHandle": "value",
          "targetHandle": "collection"
        },
        {
          "id": "e_in_hopHubs",
          "source": "in",
          "target": "hopHubs",
          "sourceHandle": "value",
          "targetHandle": "collection"
        },
        {
          "id": "e_in_exceptMembers",
          "source": "in",
          "target": "exceptMembers",
          "sourceHandle": "value",
          "targetHandle": "collection"
        },
        {
          "id": "e_excl_members",
          "source": "hopMembers",
          "target": "exceptMembers",
          "sourceHandle": "collection",
          "targetHandle": "exclude"
        },
        {
          "id": "e_keep_exceptHubs",
          "source": "exceptMembers",
          "target": "exceptHubs",
          "sourceHandle": "collection",
          "targetHandle": "collection"
        },
        {
          "id": "e_excl_hubs",
          "source": "hopHubs",
          "target": "exceptHubs",
          "sourceHandle": "collection",
          "targetHandle": "exclude"
        },
        {
          "id": "e_sort",
          "source": "exceptHubs",
          "target": "sort",
          "sourceHandle": "collection",
          "targetHandle": "collection"
        },
        {
          "id": "e_project",
          "source": "sort",
          "target": "project",
          "sourceHandle": "collection",
          "targetHandle": "collection"
        },
        {
          "id": "e_out",
          "source": "project",
          "target": "out",
          "sourceHandle": "collection",
          "targetHandle": "value"
        }
      ]
    }
  }
}
```
