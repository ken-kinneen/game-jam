import { Entity } from './Entity';
import { Health } from './components/Health';
import { Movement } from './components/Movement';
import { Inventory } from './components/Inventory';
import { StatSheet } from '../stats/StatSheet';
import type { EntityDef } from '../schemas/entity.schema';

let nextEntityId = 0;

/** Generates a unique runtime ID for each entity. */
function generateId(): string {
  return `e_${nextEntityId++}`;
}

/** Spawns an Entity from a def, attaching the correct components based on def data. */
export class EntityFactory {
  /**
   * Create an entity from its def, placing it at (x, y) in the given scene.
   * The sprite uses a circle body for smoother corner-sliding (Isaac-style).
   */
  static create(scene: Phaser.Scene, def: EntityDef, x: number, y: number): Entity {
    const textureKey = def.sprite === 'placeholder' ? '__placeholder' : def.sprite;
    const sprite = scene.physics.add.sprite(x, y, textureKey);

    if (!scene.textures.exists(textureKey)) {
      sprite.setTexture('__placeholder');
    }

    const entity = new Entity(generateId(), def.id, sprite);
    sprite.setData('entity', entity);

    const comps = def.components;

    if (comps.stats) {
      const sheet = new StatSheet();
      const s = comps.stats;
      if (s.maxHealth !== undefined) sheet.setBase('maxHealth', s.maxHealth);
      if (s.moveSpeed !== undefined) sheet.setBase('moveSpeed', s.moveSpeed);
      if (s.damage !== undefined) sheet.setBase('damage', s.damage);
      if (s.attackSpeed !== undefined) sheet.setBase('attackSpeed', s.attackSpeed);
      if (s.pickupRadius !== undefined) sheet.setBase('pickupRadius', s.pickupRadius);
      if (s.carryCapacity !== undefined) sheet.setBase('carryCapacity', s.carryCapacity);
      if (s.luck !== undefined) sheet.setBase('luck', s.luck);
      entity.setComponent('stats', sheet);
    }

    if (comps.health) {
      const stats = entity.getComponent<StatSheet>('stats');
      const maxHp = stats ? stats.get('maxHealth') : comps.health.max;
      entity.setComponent('health', new Health(maxHp));
    }

    if (comps.movement) {
      const stats = entity.getComponent<StatSheet>('stats');
      const speed = stats ? stats.get('moveSpeed') : comps.movement.maxSpeed;
      entity.setComponent('movement', new Movement(speed));
    }

    if (comps.inventory) {
      const stats = entity.getComponent<StatSheet>('stats');
      const cap = comps.inventory.capacity ?? (stats ? stats.get('carryCapacity') : 20);
      entity.setComponent('inventory', new Inventory(cap));
    }

    if (comps.ai) {
      entity.setComponent('ai', { ...comps.ai });
    }

    if (comps.loot) {
      entity.setComponent('loot', { ...comps.loot });
    }

    if (comps.contactDamage) {
      entity.setComponent('contactDamage', { ...comps.contactDamage });
    }

    return entity;
  }
}
