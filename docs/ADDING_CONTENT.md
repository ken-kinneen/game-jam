# Adding Content to TRASHED

All game content lives in `mods/`. The base game is `mods/core/`.
You should **never** need to touch `src/engine/` when adding items, enemies, upgrades,
recipes, or scenes that use mechanics already supported by the content schemas.

## Content vs. New Mechanics

The mods-only rule applies to content that fits the existing JSON schemas and engine behavior.
Adding a genuinely new mechanic may require an engine change—for example, a new interaction
action, quest type, AI behavior, or rendering capability.

When a mechanic requires engine work:

1. Keep assets, placements, labels, and tuning values in `mods/`.
2. Add generic, reusable schema fields instead of hardcoding a particular scene or asset ID.
3. Put substantial behavior in its own system under `src/engine/systems/`.
4. Keep scene and zone managers focused on orchestration and delegation.
5. Add focused tests for stateful behavior.
6. Include the engine and mod changes together, and explain why a mods-only change was not possible.

If the desired behavior can already be expressed in JSON, a PR should still touch **only** `mods/`.

## Quick Start

1. Pick the content type you want to add (see sections below)
2. Copy an existing JSON file of the same type as a template
3. Change the `id` to `core:your_snake_case_name` (the prefix must match the mod)
4. Add a sprite entry to `mods/core/assets/manifest.json` (or use `"placeholder"`)
5. Run `npm run validate` — fix any errors
6. Open a PR touching **only** `mods/` when using existing mechanics

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

Scenes can opt into an engine-supported quest through a typed `quest` block. For example:

```json
"quest": {
  "type": "activate_all_transformers",
  "title": "Restore the power grid",
  "completionText": "POWER GRID RESTORED",
  "exitTitle": "Return to the cave entrance",
  "completionScene": "core:home",
  "minimapUnlockAt": 2,
  "powerCable": {
    "sampleDistance": 18,
    "poweredRadius": 30,
    "fuelBurnMultiplier": 0.5
  }
}
```

The scene keeps its labels and destination in `mods/`; the reusable quest behavior lives in its
dedicated engine system. `powerCable` adds a loose player trail that locks and becomes energized
at each transformer. Players within `poweredRadius` consume fuel at the configured multiplier.
`minimapUnlockAt` keeps both the minimap and Tab map offline until that many transformers are active.
After the last transformer, the quest changes to `exitTitle`; completion occurs only when the player
uses the cave exit.

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

## Sounds

Location: `mods/core/sounds/`

```json
{
  "id": "core:your_sound",
  "type": "sound",
  "name": "Your Sound",
  "asset": "sfx/your_sound",
  "volume": 0.8,
  "pitchRange": [0.9, 1.1],
  "cooldown": 100,
  "triggers": [
    { "event": "item:picked_up" },
    { "event": "scene:enter", "filter": { "sceneId": "core:cave" } }
  ]
}
```

**Fields:**

- `id` — Globally unique, namespaced.
- `type` — Always `"sound"`.
- `name` — Human-readable label.
- `asset` — Key matching the audio asset in `assets/manifest.json`. If no real file exists, the engine generates a procedural placeholder.
- `volume` — Base volume (0–1), multiplied by master and SFX channel volumes.
- `pitchRange` — `[min, max]` playback rate range for randomized pitch variation.
- `cooldown` — Minimum milliseconds between plays (prevents sound spam).
- `triggers` — Array of events that play this sound. Each trigger has:
  - `event` — An EventBus event name (see `src/engine/core/EventBus.ts` for the full list).
  - `filter` (optional) — Object of key/value pairs that must match the event data.

**Tips:**

- Multiple triggers on one sound = plays on any matching event.
- Use `filter` to scope sounds to specific scenes, items, or entities.
- A `pitchRange` like `[0.9, 1.1]` adds subtle variation so repeated plays don't sound robotic.
- Set `cooldown` > 0 for frequently-fired events (e.g., item pickups) to avoid stacking.

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
