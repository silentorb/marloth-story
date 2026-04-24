---
title: "Merge several tables into a new Entities table"
notion_id: "70911bb1f9c54521bc0ff1dd413e1de8"
aliases:
  - "Merge several tables into a new Entities table"
source_export: "external/notion/Marloth/Archive/Tasks/Merge several tables into a new Entities table 70911bb1f9c54521bc0ff1dd413e1de8.md"
inferred_notion_path: "Marloth/Archive/Tasks"
status: "Not started"
---
# Merge several tables into a new Entities table


# Overview

Increasingly I’m running into cases where a group is also a location and—similar to how I’ve found it best to model user/group systems—there is practically no difference between characters and groups—they share all the same properties except a character is an endpoint.

It would probably be better to merge the following tables together into a single table:

- Characters
- Groups
- Locations

<aside>
❗ I am a little nervous about making this change because it will be hard to undo if it ever turns out to be a mistake.

</aside>

Distinction can be handled with tags.  I can still create separate views which are filtered by tags.

# Notes

<aside>
💡 This will simplify the scene relationship, where it can have a single `Entities` property.  It’s kind of nice having that broken out but I’m not using the property that way much.

</aside>

<aside>
💡 This is how the first few Marloth databases were structured.

</aside>