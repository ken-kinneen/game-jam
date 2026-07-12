import type { Scene } from '@babylonjs/core';
import type { ContentRegistry } from '../core/ContentRegistry';
import type { CaveMap } from '../generation/caveGenerator';
import type { PickupSystem } from '../systems/PickupSystem';
import { MeshFactory } from '../rendering/MeshFactory';
import { assetStore } from '../rendering/AssetStore';
import { WORLD_SCALE } from '../entities/EntityFactory';

const ITEM_DISPLAY_SIZE = 16;
const CAVE_TILE_PX = 16;

/** Spawns trash items randomly within pixel bounds. */
export function spawnGroundItems(
  scene: Scene,
  registry: ContentRegistry,
  pickupSystem: PickupSystem,
  pixelWidth: number,
  pixelHeight: number,
): void {
  const trashItems = registry.getByTag('item', 'trash');
  if (trashItems.length === 0) return;

  const margin = 32;
  const count = 12;

  for (let i = 0; i < count; i++) {
    const itemDef = trashItems[i % trashItems.length];
    const x = rand(margin, pixelWidth - margin);
    const y = rand(margin, pixelHeight - margin);
    const mesh = createItemMesh(scene, x, y, itemDef);
    pickupSystem.addGroundItem(mesh, x, y, itemDef.id, 1);
  }
}

/** Spawns fuel items randomly within pixel bounds. */
export function spawnFuelItems(
  scene: Scene,
  registry: ContentRegistry,
  pickupSystem: PickupSystem,
  pixelWidth: number,
  pixelHeight: number,
): void {
  const fuelItems = registry.getByTag('item', 'fuel');
  if (fuelItems.length === 0) return;

  const margin = 32;
  const count = 6;

  for (let i = 0; i < count; i++) {
    const itemDef = fuelItems[i % fuelItems.length];
    const x = rand(margin, pixelWidth - margin);
    const y = rand(margin, pixelHeight - margin);
    const mesh = createItemMesh(scene, x, y, itemDef);
    pickupSystem.addGroundItem(mesh, x, y, itemDef.id, 1);
  }
}

/** Spawns pickups at procedural cave item positions. */
export function spawnProceduralItems(
  scene: Scene,
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
    const mesh = createItemMesh(scene, x, y, itemDef);
    pickupSystem.addGroundItem(mesh, x, y, itemDef.id, 1);
  }
}

/** Creates a ground-item billboard scaled by the def's displayScale. */
function createItemMesh(
  scene: Scene,
  pixelX: number,
  pixelY: number,
  itemDef: { sprite: string; displayScale?: number },
) {
  const textureKey =
    itemDef.sprite !== 'placeholder' && assetStore.hasTexture(itemDef.sprite)
      ? itemDef.sprite
      : '__placeholder';

  const sz = ITEM_DISPLAY_SIZE * (itemDef.displayScale ?? 1) * WORLD_SCALE;
  const mesh = MeshFactory.createBillboard(scene, `item_${itemDef.sprite}`, textureKey, sz);
  mesh.position.x = pixelX * WORLD_SCALE;
  mesh.position.z = pixelY * WORLD_SCALE;
  return mesh;
}

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
