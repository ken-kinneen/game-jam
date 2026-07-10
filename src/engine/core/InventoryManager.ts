import { eventBus } from './EventBus';

const PLAYER_ENTITY_ID = 'player';

/** Persistent player resource store that survives scene transitions. */
export class InventoryManager {
  private items = new Map<string, number>();

  /** Add items to the persistent inventory. */
  add(itemId: string, qty: number): void {
    if (qty <= 0) return;
    const current = this.items.get(itemId) ?? 0;
    this.items.set(itemId, current + qty);
    this.emitChanged();
  }

  /** Check whether the player can afford a cost map. */
  canAfford(cost: Record<string, number>): boolean {
    for (const [itemId, qty] of Object.entries(cost)) {
      if (this.count(itemId) < qty) return false;
    }
    return true;
  }

  /** Deduct a cost map atomically. Returns false if the player cannot afford it. */
  spend(cost: Record<string, number>): boolean {
    if (!this.canAfford(cost)) return false;

    for (const [itemId, qty] of Object.entries(cost)) {
      const remaining = this.count(itemId) - qty;
      if (remaining <= 0) {
        this.items.delete(itemId);
      } else {
        this.items.set(itemId, remaining);
      }
    }

    this.emitChanged();
    return true;
  }

  /** Count total quantity of an item. */
  count(itemId: string): number {
    return this.items.get(itemId) ?? 0;
  }

  /** Return all stored items as a flat list. */
  getAll(): { itemId: string; qty: number }[] {
    return Array.from(this.items.entries()).map(([itemId, qty]) => ({ itemId, qty }));
  }

  /** Sum of all item quantities. */
  totalCount(): number {
    let total = 0;
    for (const qty of this.items.values()) {
      total += qty;
    }
    return total;
  }

  /** Clear all stored items (new game). */
  reset(): void {
    this.items.clear();
    this.emitChanged();
  }

  private emitChanged(): void {
    eventBus.emit('inventory:changed', { entityId: PLAYER_ENTITY_ID });
  }
}

export const inventoryManager = new InventoryManager();
