import type { AbstractMesh } from '@babylonjs/core';
import type { Entity } from '../entities/Entity';
import { Inventory } from '../entities/components/Inventory';
import type { StatSheet } from '../stats/StatSheet';
import type { ContentRegistry } from '../core/ContentRegistry';
import { type EventBus } from '../core/EventBus';
import type { ConfigManager } from '../core/ConfigManager';
import { WORLD_SCALE } from '../entities/EntityFactory';

interface GroundItem {
  mesh: AbstractMesh;
  /** Pixel-space position for distance checks (matches pickup radius units). */
  x: number;
  y: number;
  itemId: string;
  qty: number;
  flying: boolean;
  flyT: number;
  flyDuration: number;
  startX: number;
  startY: number;
  startScale: number;
}

/** Detects overlap between player pickup radius and ground items, adds to inventory. */
export class PickupSystem {
  private groundItems: GroundItem[] = [];

  constructor(
    private registry: ContentRegistry,
    private eventBus: EventBus,
    private configManager?: ConfigManager,
  ) {}

  /** Register a ground item mesh for pickup detection (positions in pixel space). */
  addGroundItem(
    mesh: AbstractMesh,
    pixelX: number,
    pixelY: number,
    itemId: string,
    qty: number,
  ): void {
    this.groundItems.push({
      mesh,
      x: pixelX,
      y: pixelY,
      itemId,
      qty,
      flying: false,
      flyT: 0,
      flyDuration: 0,
      startX: pixelX,
      startY: pixelY,
      startScale: Math.abs(mesh.scaling.x),
    });
  }

  /** Check pickups for a player entity. Call each frame. */
  update(player: Entity, dt = 1 / 60): void {
    this.updateFlights(player, dt);

    const inventory = player.getComponent<Inventory>('inventory');
    if (!inventory) return;

    const stats = player.getComponent<StatSheet>('stats');
    const pickupRadius = stats ? stats.get('pickupRadius') : 32;

    const px = player.x / WORLD_SCALE;
    const py = player.y / WORLD_SCALE;

    for (let i = this.groundItems.length - 1; i >= 0; i--) {
      const item = this.groundItems[i];
      if (item.flying) continue;
      if (!item.mesh || item.mesh.isDisposed()) {
        this.groundItems.splice(i, 1);
        continue;
      }

      const dx = item.x - px;
      const dy = item.y - py;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= pickupRadius) {
        const def = this.registry.get('item', item.itemId);
        const maxStack = def?.stackSize ?? 99;
        const added = inventory.add(item.itemId, item.qty, maxStack);

        if (added > 0) {
          this.eventBus.emit('item:picked_up', {
            entityId: player.id,
            itemId: item.itemId,
            qty: added,
          });

          if (added >= item.qty) {
            this.startFly(item);
          } else {
            item.qty -= added;
          }
        } else {
          this.eventBus.emit('inventory:full', {
            entityId: player.id,
            itemId: item.itemId,
          });
        }
      }
    }
  }

  private startFly(item: GroundItem): void {
    item.flying = true;
    item.flyT = 0;
    item.flyDuration = this.configManager?.get<number>('animation', 'pickupFlyDuration') ?? 200;
    item.startX = item.x;
    item.startY = item.y;
    item.startScale = Math.abs(item.mesh.scaling.x);
  }

  private updateFlights(player: Entity, dt: number): void {
    const px = player.x / WORLD_SCALE;
    const py = player.y / WORLD_SCALE - 8;

    for (let i = this.groundItems.length - 1; i >= 0; i--) {
      const item = this.groundItems[i];
      if (!item.flying) continue;

      item.flyT += dt * 1000;
      const t = Math.min(1, item.flyT / item.flyDuration);
      const ease = t * t;
      item.x = item.startX + (px - item.startX) * ease;
      item.y = item.startY + (py - item.startY) * ease;
      item.mesh.position.x = item.x * WORLD_SCALE;
      item.mesh.position.z = item.y * WORLD_SCALE;
      const s = item.startScale * (1 - ease * 0.7);
      item.mesh.scaling.x = s;
      item.mesh.scaling.y = s;
      if (item.mesh.material && 'alpha' in item.mesh.material) {
        (item.mesh.material as { alpha: number }).alpha = 1 - ease;
      }

      if (t >= 1) {
        item.mesh.dispose();
        this.groundItems.splice(i, 1);
      }
    }
  }

  /** Remove all tracked ground items (scene teardown). */
  clear(): void {
    for (const item of this.groundItems) {
      if (!item.mesh.isDisposed()) item.mesh.dispose();
    }
    this.groundItems = [];
  }

  get itemCount(): number {
    return this.groundItems.length;
  }
}
