import { describe, it, expect } from 'vitest';
import { Inventory } from '../src/engine/entities/components/Inventory';

describe('Inventory', () => {
  it('adds items to empty inventory', () => {
    const inv = new Inventory(5);
    const added = inv.add('core:rusty_can', 3, 99);
    expect(added).toBe(3);
    expect(inv.count('core:rusty_can')).toBe(3);
  });

  it('stacks items up to max stack size', () => {
    const inv = new Inventory(5);
    inv.add('core:rusty_can', 10, 10);
    const added = inv.add('core:rusty_can', 5, 10);
    expect(added).toBe(5);
    expect(inv.count('core:rusty_can')).toBe(15);
  });

  it('respects capacity limit', () => {
    const inv = new Inventory(2);
    inv.add('core:item_a', 1, 1);
    inv.add('core:item_b', 1, 1);
    const added = inv.add('core:item_c', 1, 1);
    expect(added).toBe(0);
    expect(inv.isFull).toBe(true);
  });

  it('removes items correctly', () => {
    const inv = new Inventory(5);
    inv.add('core:rusty_can', 5, 99);
    const removed = inv.remove('core:rusty_can', 3);
    expect(removed).toBe(3);
    expect(inv.count('core:rusty_can')).toBe(2);
  });

  it('removes partial when not enough items', () => {
    const inv = new Inventory(5);
    inv.add('core:rusty_can', 2, 99);
    const removed = inv.remove('core:rusty_can', 5);
    expect(removed).toBe(2);
    expect(inv.count('core:rusty_can')).toBe(0);
  });

  it('cleans up empty slots on remove', () => {
    const inv = new Inventory(5);
    inv.add('core:item_a', 1, 99);
    inv.add('core:item_b', 1, 99);
    inv.remove('core:item_a', 1);
    expect(inv.slots.length).toBe(1);
    expect(inv.slots[0].itemId).toBe('core:item_b');
  });

  it('counts total items', () => {
    const inv = new Inventory(5);
    inv.add('core:item_a', 3, 99);
    inv.add('core:item_b', 2, 99);
    expect(inv.totalItems).toBe(5);
  });
});
