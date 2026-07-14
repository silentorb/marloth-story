---
title: Merge several tables into a new Entities table
alias: Merge several tables into a new Entities table
---
# Merge several tables into a new Entities table

# Overview

Increasingly I’m running into cases where a group is also a location and—similar to how I’ve found it best to model user/group systems—there is practically no difference between characters and groups—they share all the same properties except a character is an endpoint.

It would probably be better to merge the following tables together into a single table:

- Characters
- Groups
- Locations

> ❗ I am a little nervous about making this change because it will be hard to undo if it ever turns out to be a mistake.

Distinction can be handled with tags.  I can still create separate views which are filtered by tags.

# Notes

> 💡 This will simplify the scene relationship, where it can have a single `Entities` property.  It’s kind of nice having that broken out but I’m not using the property that way much.

> 💡 This is how the first few Marloth databases were structured.
