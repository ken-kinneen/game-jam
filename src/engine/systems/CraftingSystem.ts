import { Inventory } from '../entities/components/Inventory';
import type { RecipeDef } from '../schemas/recipe.schema';
import type { ContentRegistry } from '../core/ContentRegistry';

/** Pure-logic crafting: checks inputs, consumes them, produces output. No Phaser dependency. */
export class CraftingSystem {
  constructor(private registry: ContentRegistry) {}

  /** Check if an inventory has the materials to craft a recipe. */
  canCraft(inventory: Inventory, recipe: RecipeDef): boolean {
    for (const input of recipe.inputs) {
      if ('item' in input) {
        if (inventory.count(input.item) < input.qty) return false;
      } else {
        const count = inventory.countByTag(input.tag, (itemId, tag) => {
          const def = this.registry.get('item', itemId);
          return def?.tags.includes(tag) ?? false;
        });
        if (count < input.qty) return false;
      }
    }
    return true;
  }

  /** Execute a craft: consume inputs, add output. Returns true on success. */
  craft(inventory: Inventory, recipe: RecipeDef): boolean {
    if (!this.canCraft(inventory, recipe)) return false;

    for (const input of recipe.inputs) {
      if ('item' in input) {
        inventory.remove(input.item, input.qty);
      } else {
        let remaining = input.qty;
        for (const slot of [...inventory.slots]) {
          if (remaining <= 0) break;
          const def = this.registry.get('item', slot.itemId);
          if (def?.tags.includes(input.tag)) {
            const toRemove = Math.min(remaining, slot.qty);
            inventory.remove(slot.itemId, toRemove);
            remaining -= toRemove;
          }
        }
      }
    }

    const outputDef = this.registry.get('item', recipe.output.item);
    const maxStack = outputDef?.stackSize ?? 99;
    inventory.add(recipe.output.item, recipe.output.qty, maxStack);

    return true;
  }
}
