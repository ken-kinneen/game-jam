# babylon-migration

**Added:** 2026-07-12  
**Packages:** `@babylonjs/core`, `@babylonjs/loaders`, `@babylonjs/gui`  
**Purpose:** Replace Phaser 3 with Babylon.js for 3D isometric rendering.

## Why

TRASHED is migrating from a 2D top-down Phaser game to a 3D isometric view.
Babylon.js provides a full WebGL engine with cameras, lights, materials, audio,
and built-in collision — closer to a game engine than Three.js, while staying
TypeScript-first and Vite-friendly.

## What stays

- ContentRegistry / ModLoader / Zod schemas / EventBus
- StatSheet, CraftingSystem, LampSystem, UpgradeSystem, CombatSystem
- caveGenerator (pure grid math)
- All JSON content in `mods/`

## What changes

- Rendering, input, scenes, entities, and boundary systems rewrite for Babylon
- Billboard sprites from existing 2D art first; optional `model` field later
- HUD / shop / upgrade UI stay as DOM overlays
- Physics: manual XZ slide collision against wall AABBs (`moveWithCollisions` / custom)

## Alternatives considered

- **Three.js** — more DIY for physics/audio/GUI; larger glue cost for a game
- **Keep Phaser** — no native 3D isometric path that fits this architecture
