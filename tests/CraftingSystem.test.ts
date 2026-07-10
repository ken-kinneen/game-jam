import { describe, it, expect, beforeEach } from 'vitest';
import { CraftingSystem } from '../src/engine/systems/CraftingSystem';
import { Inventory } from '../src/engine/entities/components/Inventory';
import { ContentRegistry } from '../src/engine/core/ContentRegistry';
import type { RecipeDef } from '../src/engine/schemas/recipe.schema';
import type { ItemDef } from '../src/engine/schemas/item.schema';

describe('CraftingSystem', () => {
  let reg: ContentRegistry;
  let system: CraftingSystem;

  const metalItem: ItemDef = {
    id: 'test:metal_scrap',
    type: 'item',
    name: 'Metal Scrap',
    sprite: 'placeholder',
    stackSize: 99,
    tags: ['metal'],
    value: 1,
    displayScale: 1,
  };

  const outputItem: ItemDef = {
    id: 'test:metal_plate',
    type: 'item',
    name: 'Metal Plate',
    sprite: 'placeholder',
    stackSize: 99,
    tags: ['crafted'],
    value: 5,
    displayScale: 1,
  };

  const exactRecipe: RecipeDef = {
    id: 'test:recipe_plate',
    type: 'recipe',
    station: 'crafting_bench',
    inputs: [{ item: 'test:metal_scrap', qty: 3 }],
    output: { item: 'test:metal_plate', qty: 1 },
  };

  const tagRecipe: RecipeDef = {
    id: 'test:recipe_tag',
    type: 'recipe',
    station: 'crafting_bench',
    inputs: [{ tag: 'metal', qty: 2 }],
    output: { item: 'test:metal_plate', qty: 1 },
  };

  beforeEach(() => {
    reg = new ContentRegistry();
    reg.register('item', metalItem);
    reg.register('item', outputItem);
    reg.register('recipe', exactRecipe);
    reg.register('recipe', tagRecipe);
    system = new CraftingSystem(reg);
  });

  it('canCraft returns true when materials are sufficient (exact item)', () => {
    const inv = new Inventory(10);
    inv.add('test:metal_scrap', 5, 99);
    expect(system.canCraft(inv, exactRecipe)).toBe(true);
  });

  it('canCraft returns false when materials are insufficient', () => {
    const inv = new Inventory(10);
    inv.add('test:metal_scrap', 2, 99);
    expect(system.canCraft(inv, exactRecipe)).toBe(false);
  });

  it('craft consumes inputs and produces output', () => {
    const inv = new Inventory(10);
    inv.add('test:metal_scrap', 5, 99);
    const result = system.craft(inv, exactRecipe);
    expect(result).toBe(true);
    expect(inv.count('test:metal_scrap')).toBe(2);
    expect(inv.count('test:metal_plate')).toBe(1);
  });

  it('canCraft works with tag-based inputs', () => {
    const inv = new Inventory(10);
    inv.add('test:metal_scrap', 2, 99);
    expect(system.canCraft(inv, tagRecipe)).toBe(true);
  });

  it('craft with tags consumes correct items', () => {
    const inv = new Inventory(10);
    inv.add('test:metal_scrap', 3, 99);
    const result = system.craft(inv, tagRecipe);
    expect(result).toBe(true);
    expect(inv.count('test:metal_scrap')).toBe(1);
    expect(inv.count('test:metal_plate')).toBe(1);
  });
});
