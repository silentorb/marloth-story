---
title: Articles
alias: Articles
modified_at: 2026-07-30T04:57:41.779Z
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
          "position": { "x": 0, "y": 200 },
          "data": { "inputValues": {} }
        },
        {
          "id": "hopMembersPlain",
          "type": "traverse",
          "position": { "x": 220, "y": 0 },
          "data": {
            "inputValues": {
              "edgeType": "01KXBNPNJDENZ9BXN5BYZ7JKPT:0"
            }
          }
        },
        {
          "id": "hopMembersOrdered",
          "type": "traverse",
          "position": { "x": 220, "y": 100 },
          "data": {
            "inputValues": {
              "edgeType": "01KXBNPNJDENZ9BXN5BYZ7JKPY:0"
            }
          }
        },
        {
          "id": "hopHubsPlain",
          "type": "traverse",
          "position": { "x": 220, "y": 300 },
          "data": {
            "inputValues": {
              "edgeType": "01KXBNPNJDENZ9BXN5BYZ7JKPT:1"
            }
          }
        },
        {
          "id": "hopHubsOrdered",
          "type": "traverse",
          "position": { "x": 220, "y": 400 },
          "data": {
            "inputValues": {
              "edgeType": "01KXBNPNJDENZ9BXN5BYZ7JKPY:1"
            }
          }
        },
        {
          "id": "exceptMembersPlain",
          "type": "except",
          "position": { "x": 480, "y": 160 },
          "data": { "inputValues": {} }
        },
        {
          "id": "exceptMembersOrdered",
          "type": "except",
          "position": { "x": 700, "y": 160 },
          "data": { "inputValues": {} }
        },
        {
          "id": "exceptHubsPlain",
          "type": "except",
          "position": { "x": 920, "y": 160 },
          "data": { "inputValues": {} }
        },
        {
          "id": "exceptHubsOrdered",
          "type": "except",
          "position": { "x": 1140, "y": 160 },
          "data": { "inputValues": {} }
        },
        {
          "id": "out",
          "type": "output",
          "position": { "x": 1360, "y": 160 },
          "data": { "inputValues": {} }
        }
      ],
      "edges": [
        {
          "id": "e_in_hopMembersPlain",
          "source": "in",
          "sourceHandle": "value",
          "target": "hopMembersPlain",
          "targetHandle": "collection"
        },
        {
          "id": "e_in_hopMembersOrdered",
          "source": "in",
          "sourceHandle": "value",
          "target": "hopMembersOrdered",
          "targetHandle": "collection"
        },
        {
          "id": "e_in_hopHubsPlain",
          "source": "in",
          "sourceHandle": "value",
          "target": "hopHubsPlain",
          "targetHandle": "collection"
        },
        {
          "id": "e_in_hopHubsOrdered",
          "source": "in",
          "sourceHandle": "value",
          "target": "hopHubsOrdered",
          "targetHandle": "collection"
        },
        {
          "id": "e_in_exceptMembersPlain",
          "source": "in",
          "sourceHandle": "value",
          "target": "exceptMembersPlain",
          "targetHandle": "collection"
        },
        {
          "id": "e_excl_membersPlain",
          "source": "hopMembersPlain",
          "sourceHandle": "collection",
          "target": "exceptMembersPlain",
          "targetHandle": "exclude"
        },
        {
          "id": "e_keep_exceptMembersOrdered",
          "source": "exceptMembersPlain",
          "sourceHandle": "collection",
          "target": "exceptMembersOrdered",
          "targetHandle": "collection"
        },
        {
          "id": "e_excl_membersOrdered",
          "source": "hopMembersOrdered",
          "sourceHandle": "collection",
          "target": "exceptMembersOrdered",
          "targetHandle": "exclude"
        },
        {
          "id": "e_keep_exceptHubsPlain",
          "source": "exceptMembersOrdered",
          "sourceHandle": "collection",
          "target": "exceptHubsPlain",
          "targetHandle": "collection"
        },
        {
          "id": "e_excl_hubsPlain",
          "source": "hopHubsPlain",
          "sourceHandle": "collection",
          "target": "exceptHubsPlain",
          "targetHandle": "exclude"
        },
        {
          "id": "e_keep_exceptHubsOrdered",
          "source": "exceptHubsPlain",
          "sourceHandle": "collection",
          "target": "exceptHubsOrdered",
          "targetHandle": "collection"
        },
        {
          "id": "e_excl_hubsOrdered",
          "source": "hopHubsOrdered",
          "sourceHandle": "collection",
          "target": "exceptHubsOrdered",
          "targetHandle": "exclude"
        },
        {
          "id": "e_out",
          "source": "exceptHubsOrdered",
          "sourceHandle": "collection",
          "target": "out",
          "targetHandle": "value"
        }
      ]
    }
  }
}
```

[[01KWN86X6NJZMP5ZESZTNDXY3K]]

[Femininity and Epic Wonderland](./01KWN86X6NJZMP5ZESZTNDXY1A.md)

[Epic Wonderland](./01KWN86X6NJZMP5ZESZTNDXY63.md)

[Wonderland](./01KWN86X6NJZMP5ZESZTNDXXXN.md)

[Framework](./01KWN86X6NJZMP5ZESZTNDXY05.md)

[Social relationships](./01KWN86X6MFZQAJ1V36T95928T.md)

[The four categories of fantasy](./01KWN86X6MFZQAJ1V36T9592FY.md)

[Long-running series](./01KWN86X6NJZMP5ZESZTNDXY41.md)

[Old fantasy](./01KWN86X6PZXQP43T36924KCSS.md)

[Contented impetus](./01KWN86X6NJZMP5ZESZTNDXY09.md)

[Analysis of hospitality games](./01KWN86X6MFZQAJ1V36T95928X.md)

[Making paths straight](./01KWN86X6MFZQAJ1V36T959294.md)

[Femininity](./01KWN86X6NJZMP5ZESZTNDXXXV.md)

[Ideas](./01KWN86X6NJZMP5ZESZTNDXXXA.md)

[Christianity](./01KWN86X6MFZQAJ1V36T9592C4.md)

[Handling new story features](./01KWN86X6MFZQAJ1V36T9592CR.md)

[The Marloth technical system](./01KWN86X6MFZQAJ1V36T9592CT.md)

[Immersive survival dark fantasy](./01KWN86X6NJZMP5ZESZTNDXY6K.md)

[Family - Paradigm shift](./01KWN86X6PZXQP43T36924KCSW.md)

[The homes of James and Adelle](./01KWN86X6MFZQAJ1V36T9592EM.md)

[Suffering and Trials](./01KWN86X6MFZQAJ1V36T9592EQ.md)

[Articulate domains by professions](./01KWN86X6MFZQAJ1V36T9592FB.md)

[Design process - Good to bad](./01KWN86X6MFZQAJ1V36T9592FK.md)

[Responsibility](./01KWN86X6MFZQAJ1V36T9592FN.md)

[Article archive](./01KWN86X6MFZQAJ1V36T9592G3.md)

[Excessive Quest](./01KWN86X6MFZQAJ1V36T9592GD.md)

[Millennial narcissism](./01KWN86X6MFZQAJ1V36T9592GF.md)

[Grimdark](./01KWN86X6MFZQAJ1V36T9592GC.md)

[Fantasy economy](./01KWN86X6MFZQAJ1V36T9592GV.md)

[Guilt, doubt, and wicked law](./01KWN86X6NJZMP5ZESZTNDXXVE.md)

[Marloth book style overview](./01KWN86X6NJZMP5ZESZTNDXXVY.md)

[Other narratives](./01KWN86X6NJZMP5ZESZTNDXXX1.md)

[Spatial location rules](./01KWN86X6NJZMP5ZESZTNDXXX2.md)

[Premise decomposition](./01KWN86X6MFZQAJ1V36T9592EF.md)

[Design conflict resolution](./01KWN86X6NJZMP5ZESZTNDXXX6.md)
