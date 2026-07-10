# Adding Content to TRASHED

All game content lives in `mods/`. The base game is `mods/core/`.
You should **never** need to touch `src/engine/` to add items, enemies, upgrades, recipes, or scenes.

## Quick Start

1. Pick the content type you want to add (see sections below)
2. Copy an existing JSON file of the same type as a template
3. Change the `id` to `core:your_snake_case_name` (the prefix must match the mod)
4. Add a sprite entry to `mods/core/assets/manifest.json` (or use `"placeholder"`)
5. Run `npm run validate` — fix any errors
6. Open a PR touching **only** `mods/`

---

## Items

Location: `mods/core/items/`

```json
{
  "id": "core:your_item",
  "type": "item",
  "name": "Your Item",
  "sprite": "items/your_item",
  "stackSize": 99,
  "tags": ["trash", "metal"],
  "value": 5
}
```

**Fields:**

- `id` — Globally unique, namespaced. Never rename after merge.
- `type` — Always `"item"`.
- `name` — Display name.
- `sprite` — Key from `assets/manifest.json`. Use `"placeholder"` if art isn't ready.
- `stackSize` — Max per inventory slot.
- `tags` — Used by recipes, upgrades, and systems. Prefer tags over hardcoding IDs.
- `value` — Base scrap/currency value.

---

## Entities (Enemies, NPCs, Destructibles)

Location: `mods/core/entities/`

```json
{
  "id": "core:your_enemy",
  "type": "entity",
  "name": "Your Enemy",
  "sprite": "enemies/your_enemy",
  "components": {
    "health": { "max": 20 },
    "movement": { "maxSpeed": 60 },
    "ai": { "behavior": "chase_player", "aggroRange": 140 },
    "loot": { "table": "core:some_loot_table" },
    "contactDamage": { "amount": 5 }
  }
}
```

Components are mix-and-match. Only include the ones your entity needs.

---

## Upgrades

Location: `mods/core/upgrades/`

```json
{
  "id": "core:your_upgrade",
  "type": "upgrade",
  "name": "Your Upgrade",
  "sprite": "upgrades/your_upgrade",
  "rarity": "common",
  "cost": { "core:scrap_metal": 10 },
  "effects": [{ "kind": "stat", "stat": "moveSpeed", "mod": "increased", "value": 0.2 }],
  "requires": []
}
```

Effect kinds: `"stat"` (modifies a stat) or `"behavior"` (triggers a registered behavior).

---

## Recipes

Location: `mods/core/recipes/`

```json
{
  "id": "core:recipe_your_thing",
  "type": "recipe",
  "station": "crafting_bench",
  "inputs": [{ "tag": "metal", "qty": 3 }],
  "output": { "item": "core:your_output", "qty": 1 }
}
```

Inputs can reference exact items (`"item"`) or tags (`"tag"`).

---

## Scenes

Location: `mods/core/scenes/`

```json
{
  "id": "core:your_scene",
  "type": "scene",
  "kind": "cave",
  "tileset": "tilesets/cave",
  "music": "audio/cave_theme",
  "generation": {
    "method": "rooms",
    "roomCount": [6, 9],
    "spawnTables": {
      "enemies": "core:cave_enemies",
      "trash": "core:cave_trash"
    }
  },
  "exits": [{ "to": "core:home", "condition": "always" }]
}
```

---

## Loot Tables

Location: `mods/core/loot-tables/`

```json
{
  "id": "core:your_loot_table",
  "type": "loot-table",
  "entries": [
    { "item": "core:rusty_can", "weight": 10, "qty": [1, 3] },
    { "tag": "organic", "weight": 5, "qty": [1, 1] }
  ]
}
```

---

## Assets

Every sprite/sound must be registered in `mods/core/assets/manifest.json`:

```json
{
  "items/your_item": { "file": "sprites/items/your_item.png", "type": "image" }
}
```

- Files go in the matching subfolder under `assets/`
- Sprites: 16px grid, `snake_case.png`
- Use `"placeholder"` as the sprite key in defs until art is ready — renders as magenta box

---

## Validation

Always run before committing:

```bash
npm run validate
```

This checks every def against its Zod schema and verifies all asset references exist.
**Red validate = do not commit.**
