export interface InventorySlot {
  itemId: string;
  qty: number;
}

/** Fixed-capacity item inventory for an entity. */
export class Inventory {
  readonly slots: InventorySlot[] = [];
  readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
  }

  /** Try to add items. Returns the quantity actually added (may be less if full). */
  add(itemId: string, qty: number, maxStack: number): number {
    let remaining = qty;

    for (const slot of this.slots) {
      if (slot.itemId === itemId && slot.qty < maxStack) {
        const canAdd = Math.min(remaining, maxStack - slot.qty);
        slot.qty += canAdd;
        remaining -= canAdd;
        if (remaining <= 0) return qty;
      }
    }

    while (remaining > 0 && this.slots.length < this.capacity) {
      const toAdd = Math.min(remaining, maxStack);
      this.slots.push({ itemId, qty: toAdd });
      remaining -= toAdd;
    }

    return qty - remaining;
  }

  /** Remove items. Returns the quantity actually removed. */
  remove(itemId: string, qty: number): number {
    let remaining = qty;

    for (let i = this.slots.length - 1; i >= 0; i--) {
      const slot = this.slots[i];
      if (slot.itemId === itemId) {
        const toRemove = Math.min(remaining, slot.qty);
        slot.qty -= toRemove;
        remaining -= toRemove;
        if (slot.qty <= 0) {
          this.slots.splice(i, 1);
        }
        if (remaining <= 0) break;
      }
    }

    return qty - remaining;
  }

  /** Count total quantity of an item. */
  count(itemId: string): number {
    return this.slots.filter((s) => s.itemId === itemId).reduce((sum, s) => sum + s.qty, 0);
  }

  /** Count total quantity of items matching a tag (requires a tag lookup function). */
  countByTag(tag: string, hasTag: (itemId: string, tag: string) => boolean): number {
    return this.slots.filter((s) => hasTag(s.itemId, tag)).reduce((sum, s) => sum + s.qty, 0);
  }

  get isFull(): boolean {
    return this.slots.length >= this.capacity;
  }

  get totalItems(): number {
    return this.slots.reduce((sum, s) => sum + s.qty, 0);
  }
}
