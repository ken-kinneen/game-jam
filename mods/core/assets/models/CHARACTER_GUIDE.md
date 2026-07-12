# 3D Character Setup

## Quick Start

1. Create/find your character model
2. Upload to [Mixamo](https://www.mixamo.com/) for animations
3. Download as **GLB** format (not FBX)
4. Save as `mods/core/assets/models/character.glb`
5. Run the game — the 3D model replaces the sprite automatically

## Mixamo Animation Names

The system looks for these animation names (fuzzy match, case-insensitive):

| Game State | Searches for                          |
| ---------- | ------------------------------------- |
| Idle       | `idle`, `breathing idle`, `standing`  |
| Walk       | `walk`, `walking`, `locomotion`       |
| Interact   | `interact`, `reach`, `grab`, `pickup` |
| Death      | `death`, `dying`, `collapse`          |

Download each animation and **include all in a single GLB file** using Blender:

1. Import each FBX from Mixamo into Blender
2. Rename actions to `idle`, `walk`, `interact`, `death`
3. Export as GLB with "Include > Animation" checked

Or download a single FBX with one animation — the system falls back to the first clip it finds.

## Recommended Mixamo Animations

For an old electrical technician:

- **Idle**: "Breathing Idle" or "Standing Idle"
- **Walk**: "Walking" (slow, weighted) — NOT running
- **Interact**: "Standing Reach" or "Crouching"
- **Death**: "Dying Backwards" or "Collapse"

## Technical Notes

- Model is auto-scaled to fit the camera frustum (1.6 units)
- Camera is orthographic, top-down — model viewed from directly above
- Lighting: warm ambient (lamp color) + directional from above-front + subtle rim
- The 3D render outputs to a 128x128 canvas texture
- Physics body, depth sort, Light2D — all still work on the Phaser sprite
- If the GLB fails to load, the game falls back to the existing sprite animation silently

## Troubleshooting

- **Model looks too small/large**: The auto-scaler uses the bounding box. If the model has stray geometry far from the body, it'll scale wrong. Clean up the model in Blender first.
- **Animation not playing**: Check console — it logs available clip names on load. Rename clips to match the expected names.
- **Model faces wrong direction**: The system auto-rotates based on velocity. If the model's "forward" isn't -Z in the model space, rotate it 180° in Blender before export.
