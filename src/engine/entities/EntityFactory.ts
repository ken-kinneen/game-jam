import { Entity } from './Entity';
import { Health } from './components/Health';
import { Movement } from './components/Movement';
import { Inventory } from './components/Inventory';
import { Animator } from './components/Animator';
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

    if (comps.animations) {
      const animIdPrefix = def.id.replace(/[^a-z0-9]/gi, '_');
      EntityFactory.registerAnimations(scene, textureKey, animIdPrefix, comps.animations);
      entity.setComponent('animator', new Animator(animIdPrefix));
      // Land on a real frame immediately — otherwise the sprite shows frame 0 of
      // whatever texture Phaser defaults to until the first AnimationSystem.update().
      sprite.play(`${animIdPrefix}_idle_${comps.animations.directions[0]}`, true);
    }

    return entity;
  }

  /**
   * Builds idle/walk Phaser animations for every direction row in a spritesheet, per
   * docs/09's layout convention: row = direction, frame 0 in the row = idle, the rest
   * = the walk cycle. Registered once per (texture, def) pair — safe to call on every
   * spawn since scene.anims is keyed and create() is skipped if the key exists.
   */
  private static registerAnimations(
    scene: Phaser.Scene,
    textureKey: string,
    animIdPrefix: string,
    anim: NonNullable<EntityDef['components']['animations']>,
  ): void {
    anim.directions.forEach((direction, row) => {
      const rowOffset = row * anim.framesPerRow;

      const idleKey = `${animIdPrefix}_idle_${direction}`;
      if (!scene.anims.exists(idleKey)) {
        scene.anims.create({
          key: idleKey,
          frames: [{ key: textureKey, frame: rowOffset + anim.idleFrame }],
          frameRate: 1,
        });
      }

      const walkKey = `${animIdPrefix}_walk_${direction}`;
      if (!scene.anims.exists(walkKey)) {
        scene.anims.create({
          key: walkKey,
          frames: anim.walkFrames.map((f) => ({ key: textureKey, frame: rowOffset + f })),
          frameRate: anim.frameRate,
          repeat: -1,
        });
      }
    });
  }
}
