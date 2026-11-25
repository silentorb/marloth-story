---
title: Articles
alias: Articles
modified_at: 2026-08-01T18:41:00.000Z
created_at: 2026-07-18T05:48:56.497Z
---
```json {type="query"}
{
  "version": 1,
  "graph": {
    "nodes": [
      {
        "id": "in",
        "type": "input",
        "inputs": {}
      },
      {
        "id": "hopMembers",
        "type": "traverse",
        "inputs": {
          "association": "01KXBNPNJDENZ9BXN5BYZ7JKPT",
          "direction": 0
        }
      },
      {
        "id": "hopHubs",
        "type": "traverse",
        "inputs": {
          "association": "01KXBNPNJDENZ9BXN5BYZ7JKPT",
          "direction": 1
        }
      },
      {
        "id": "hopOrderedMembers",
        "type": "traverse",
        "inputs": {
          "association": "01KXBNPNJDENZ9BXN5BYZ7JKPY",
          "direction": 0
        }
      },
      {
        "id": "hopOrderedHubs",
        "type": "traverse",
        "inputs": {
          "association": "01KXBNPNJDENZ9BXN5BYZ7JKPY",
          "direction": 1
        }
      },
      {
        "id": "exceptMembers",
        "type": "except",
        "inputs": {}
      },
      {
        "id": "exceptHubs",
        "type": "except",
        "inputs": {}
      },
      {
        "id": "exceptOrderedMembers",
        "type": "except",
        "inputs": {}
      },
      {
        "id": "exceptOrderedHubs",
        "type": "except",
        "inputs": {}
      },
      {
        "id": "sort",
        "type": "sort",
        "inputs": {
          "column": "title",
          "direction": "asc"
        }
      },
      {
        "id": "project",
        "type": "project",
        "inputs": {
          "columns": "id"
        }
      },
      {
        "id": "out",
        "type": "output",
        "inputs": {}
      }
    ],
    "edges": [
      {
        "id": "e_in_hopMembers",
        "from": {
          "node": "in",
          "port": "value"
        },
        "to": {
          "node": "hopMembers",
          "port": "collection"
        }
      },
      {
        "id": "e_in_hopHubs",
        "from": {
          "node": "in",
          "port": "value"
        },
        "to": {
          "node": "hopHubs",
          "port": "collection"
        }
      },
      {
        "id": "e_in_hopOrderedMembers",
        "from": {
          "node": "in",
          "port": "value"
        },
        "to": {
          "node": "hopOrderedMembers",
          "port": "collection"
        }
      },
      {
        "id": "e_in_hopOrderedHubs",
        "from": {
          "node": "in",
          "port": "value"
        },
        "to": {
          "node": "hopOrderedHubs",
          "port": "collection"
        }
      },
      {
        "id": "e_in_exceptMembers",
        "from": {
          "node": "in",
          "port": "value"
        },
        "to": {
          "node": "exceptMembers",
          "port": "collection"
        }
      },
      {
        "id": "e_excl_members",
        "from": {
          "node": "hopMembers",
          "port": "collection"
        },
        "to": {
          "node": "exceptMembers",
          "port": "exclude"
        }
      },
      {
        "id": "e_keep_exceptHubs",
        "from": {
          "node": "exceptMembers",
          "port": "collection"
        },
        "to": {
          "node": "exceptHubs",
          "port": "collection"
        }
      },
      {
        "id": "e_excl_hubs",
        "from": {
          "node": "hopHubs",
          "port": "collection"
        },
        "to": {
          "node": "exceptHubs",
          "port": "exclude"
        }
      },
      {
        "id": "e_keep_exceptOrderedMembers",
        "from": {
          "node": "exceptHubs",
          "port": "collection"
        },
        "to": {
          "node": "exceptOrderedMembers",
          "port": "collection"
        }
      },
      {
        "id": "e_excl_ordered_members",
        "from": {
          "node": "hopOrderedMembers",
          "port": "collection"
        },
        "to": {
          "node": "exceptOrderedMembers",
          "port": "exclude"
        }
      },
      {
        "id": "e_keep_exceptOrderedHubs",
        "from": {
          "node": "exceptOrderedMembers",
          "port": "collection"
        },
        "to": {
          "node": "exceptOrderedHubs",
          "port": "collection"
        }
      },
      {
        "id": "e_excl_ordered_hubs",
        "from": {
          "node": "hopOrderedHubs",
          "port": "collection"
        },
        "to": {
          "node": "exceptOrderedHubs",
          "port": "exclude"
        }
      },
      {
        "id": "e_sort",
        "from": {
          "node": "exceptOrderedHubs",
          "port": "collection"
        },
        "to": {
          "node": "sort",
          "port": "collection"
        }
      },
      {
        "id": "e_project",
        "from": {
          "node": "sort",
          "port": "collection"
        },
        "to": {
          "node": "project",
          "port": "collection"
        }
      },
      {
        "id": "e_out",
        "from": {
          "node": "project",
          "port": "collection"
        },
        "to": {
          "node": "out",
          "port": "value"
        }
      }
    ]
  },
  "layout": {
    "in": {
      "x": 0,
      "y": 160
    },
    "hopMembers": {
      "x": 220,
      "y": 0
    },
    "hopHubs": {
      "x": 220,
      "y": 120
    },
    "hopOrderedMembers": {
      "x": 220,
      "y": 240
    },
    "hopOrderedHubs": {
      "x": 220,
      "y": 360
    },
    "exceptMembers": {
      "x": 480,
      "y": 160
    },
    "exceptHubs": {
      "x": 700,
      "y": 160
    },
    "exceptOrderedMembers": {
      "x": 920,
      "y": 160
    },
    "exceptOrderedHubs": {
      "x": 1140,
      "y": 160
    },
    "sort": {
      "x": 1360,
      "y": 160
    },
    "project": {
      "x": 1580,
      "y": 160
    },
    "out": {
      "x": 1800,
      "y": 160
    }
  }
}
```
