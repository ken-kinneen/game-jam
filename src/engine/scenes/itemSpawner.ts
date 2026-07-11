import type { ContentRegistry } from '../core/ContentRegistry';
import type { CaveMap } from '../generation/caveGenerator';
import type { PickupSystem } from '../systems/PickupSystem';

const ITEM_DISPLAY_SIZE = 16;
const CAVE_TILE_PX = 16;

/** Spawns trash items randomly within world bounds. */
export function spawnGroundItems(
  scene: Phaser.Scene,
  registry: ContentRegistry,
  pickupSystem: PickupSystem,
): void {
  const trashItems = registry.getByTag('item', 'trash');
  if (trashItems.length === 0) return;

  const bounds = scene.physics.world.bounds;
  const margin = 32;
  const count = 12;

  for (let i = 0; i < count; i++) {
    const itemDef = trashItems[i % trashItems.length];
    const x = Phaser.Math.Between(bounds.x + margin, bounds.right - margin);
    const y = Phaser.Math.Between(bounds.y + margin, bounds.bottom - margin);

    const sprite = createItemSprite(scene, x, y, itemDef);
    pickupSystem.addGroundItem(sprite, itemDef.id, 1);
  }
}

/** Spawns fuel items randomly within world bounds. */
export function spawnFuelItems(
  scene: Phaser.Scene,
  registry: ContentRegistry,
  pickupSystem: PickupSystem,
): void {
  const fuelItems = registry.getByTag('item', 'fuel');
  if (fuelItems.length === 0) return;

  const bounds = scene.physics.world.bounds;
  const margin = 32;
  const count = 6;

  for (let i = 0; i < count; i++) {
    const itemDef = fuelItems[i % fuelItems.length];
    const x = Phaser.Math.Between(bounds.x + margin, bounds.right - margin);
    const y = Phaser.Math.Between(bounds.y + margin, bounds.bottom - margin);

    const sprite = createItemSprite(scene, x, y, itemDef);
    pickupSystem.addGroundItem(sprite, itemDef.id, 1);
  }
}

/** Spawns pickups at procedural cave item positions. */
export function spawnProceduralItems(
  scene: Phaser.Scene,
  registry: ContentRegistry,
  pickupSystem: PickupSystem,
  caveMap: CaveMap,
): void {
  const trashItems = registry.getByTag('item', 'trash');
  const fuelItems = registry.getByTag('item', 'fuel');
  let trashIdx = 0;
  let fuelIdx = 0;

  for (const item of caveMap.items) {
    if (item.placement !== 'open') continue;

    const pool = item.kind === 'fuel' ? fuelItems : trashItems;
    if (pool.length === 0) continue;
    const itemDef =
      item.kind === 'fuel' ? pool[fuelIdx++ % pool.length] : pool[trashIdx++ % pool.length];

    const x = item.x * CAVE_TILE_PX + CAVE_TILE_PX / 2;
    const y = item.y * CAVE_TILE_PX + CAVE_TILE_PX / 2;
    const sprite = createItemSprite(scene, x, y, itemDef);
    pickupSystem.addGroundItem(sprite, itemDef.id, 1);
  }
}

/** Creates a ground-item sprite scaled by the def's displayScale. */
function createItemSprite(
  scene: Phaser.Scene,
  x: number,
  y: number,
  itemDef: { sprite: string; displayScale?: number },
): Phaser.Physics.Arcade.Sprite {
  const textureKey =
    itemDef.sprite !== 'placeholder' && scene.textures.exists(itemDef.sprite)
      ? itemDef.sprite
      : '__placeholder';

  const sprite = scene.physics.add.sprite(x, y, textureKey);
  const sz = ITEM_DISPLAY_SIZE * (itemDef.displayScale ?? 1);
  sprite.setDisplaySize(sz, sz);
  sprite.setDepth(2);
  const body = sprite.body as Phaser.Physics.Arcade.Body;
  body.setImmovable(true);
  body.setAllowGravity(false);
  body.setSize(sz, sz);
  return sprite;
}
