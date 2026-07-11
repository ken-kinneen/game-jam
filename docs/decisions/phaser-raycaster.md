# phaser-raycaster

**Added:** 2026-07-11  
**Package:** `phaser-raycaster` (v0.11.x)  
**Purpose:** Shadow-casting visibility for the lamp lighting system.

## Why

We needed light from the player's lamp to be blocked by cave walls and props,
creating immersive shadows. A custom raycaster had coordinate/scaling bugs and
lacked edge-case handling for Phaser's game object shapes.

`phaser-raycaster` is a mature Phaser 3 scene plugin that handles raycasting
against rectangles, sprites, tilemaps, circles, polygons, and Matter bodies
out of the box. It provides `castCircle()` which returns intersection points
suitable for filling a `GeometryMask` — exactly our use case.

## How it's used

- Registered as a scene plugin in the Phaser game config.
- In `GameScene.createLampLight()`, wall bodies and prop sprites are mapped.
- Each frame, `ray.castCircle()` produces a visibility polygon drawn into a
  `GeometryMask` that clips the fog-of-war darkness layer.
- Works in both cave (dynamic lamp radius, fuel drain) and home (fixed radius,
  moody prop shadows).

## Alternatives considered

- Custom raycaster utility (`visibilityPolygon.ts`) — worked partially but had
  scaling/coordinate bugs with Phaser's camera system and required manual
  segment merging.
- Phaser Light2D pipeline — doesn't support light occlusion by walls.
