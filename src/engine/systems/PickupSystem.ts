import type { Entity } from '../entities/Entity';
import { Inventory } from '../entities/components/Inventory';
import type { StatSheet } from '../stats/StatSheet';
import type { ContentRegistry } from '../core/ContentRegistry';
import { type EventBus } from '../core/EventBus';

interface GroundItem {
  sprite: Phaser.Physics.Arcade.Sprite;
  itemId: string;
  qty: number;
}

/** Detects overlap between player pickup radius and ground items, adds to inventory. */
export class PickupSystem {
  private groundItems: GroundItem[] = [];

  constructor(
    private registry: ContentRegistry,
    private eventBus: EventBus,
  ) {}

  /** Register a ground item sprite for pickup detection. */
  addGroundItem(sprite: Phaser.Physics.Arcade.Sprite, itemId: string, qty: number): void {
    this.groundItems.push({ sprite, itemId, qty });
    sprite.setData('groundItem', { itemId, qty });
  }

  /** Check pickups for a player entity. Call each frame. */
  update(player: Entity): void {
    const inventory = player.getComponent<Inventory>('inventory');
    if (!inventory) return;

    const stats = player.getComponent<StatSheet>('stats');
    const pickupRadius = stats ? stats.get('pickupRadius') : 32;

    const px = player.sprite.x;
    const py = player.sprite.y;

    for (let i = this.groundItems.length - 1; i >= 0; i--) {
      const item = this.groundItems[i];
      if (!item.sprite.active) {
        this.groundItems.splice(i, 1);
        continue;
      }

      const dx = item.sprite.x - px;
      const dy = item.sprite.y - py;
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
            item.sprite.destroy();
            this.groundItems.splice(i, 1);
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

  /** Remove all tracked ground items (scene teardown). */
  clear(): void {
    this.groundItems = [];
  }

  get itemCount(): number {
    return this.groundItems.length;
  }
}
