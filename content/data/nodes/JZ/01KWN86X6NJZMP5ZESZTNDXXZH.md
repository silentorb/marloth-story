---
title: Articles
alias: Articles
modified_at: 2026-08-01T18:41:00.000Z
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
            "y": 120
          },
          "data": {
            "inputValues": {
              "association": "01KXBNPNJDENZ9BXN5BYZ7JKPT",
              "direction": 1
            }
          }
        },
        {
          "id": "hopOrderedMembers",
          "type": "traverse",
          "position": {
            "x": 220,
            "y": 240
          },
          "data": {
            "inputValues": {
              "association": "01KXBNPNJDENZ9BXN5BYZ7JKPY",
              "direction": 0
            }
          }
        },
        {
          "id": "hopOrderedHubs",
          "type": "traverse",
          "position": {
            "x": 220,
            "y": 360
          },
          "data": {
            "inputValues": {
              "association": "01KXBNPNJDENZ9BXN5BYZ7JKPY",
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
          "id": "exceptOrderedMembers",
          "type": "except",
          "position": {
            "x": 920,
            "y": 160
          },
          "data": {
            "inputValues": {}
          }
        },
        {
          "id": "exceptOrderedHubs",
          "type": "except",
          "position": {
            "x": 1140,
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
            "x": 1360,
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
            "x": 1580,
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
            "x": 1800,
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
          "id": "e_in_hopOrderedMembers",
          "source": "in",
          "target": "hopOrderedMembers",
          "sourceHandle": "value",
          "targetHandle": "collection"
        },
        {
          "id": "e_in_hopOrderedHubs",
          "source": "in",
          "target": "hopOrderedHubs",
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
          "id": "e_keep_exceptOrderedMembers",
          "source": "exceptHubs",
          "target": "exceptOrderedMembers",
          "sourceHandle": "collection",
          "targetHandle": "collection"
        },
        {
          "id": "e_excl_ordered_members",
          "source": "hopOrderedMembers",
          "target": "exceptOrderedMembers",
          "sourceHandle": "collection",
          "targetHandle": "exclude"
        },
        {
          "id": "e_keep_exceptOrderedHubs",
          "source": "exceptOrderedMembers",
          "target": "exceptOrderedHubs",
          "sourceHandle": "collection",
          "targetHandle": "collection"
        },
        {
          "id": "e_excl_ordered_hubs",
          "source": "hopOrderedHubs",
          "target": "exceptOrderedHubs",
          "sourceHandle": "collection",
          "targetHandle": "exclude"
        },
        {
          "id": "e_sort",
          "source": "exceptOrderedHubs",
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
