import type { Scene } from '@babylonjs/core';
import { Entity } from './Entity';
import { Health } from './components/Health';
import { Movement } from './components/Movement';
import { Inventory } from './components/Inventory';
import { Animator } from './components/Animator';
import { StatSheet } from '../stats/StatSheet';
import type { EntityDef } from '../schemas/entity.schema';
import { MeshFactory } from '../rendering/MeshFactory';
import { assetStore } from '../rendering/AssetStore';
import { instantiateScaledModel } from './ModelAnimator';

let nextEntityId = 0;

/** Generates a unique runtime ID for each entity. */
function generateId(): string {
  return `e_${nextEntityId++}`;
}

/** World-unit scale: old Phaser pixels → Babylon units (16px tile = 1 unit). */
export const WORLD_SCALE = 1 / 16;

/** Default player height in world units when using a 3D model. */
const DEFAULT_MODEL_HEIGHT = 2.2;

/** Spawns an Entity from a def, attaching components based on def data. */
export class EntityFactory {
  /**
   * Create an entity from its def at game-plane (x, y).
   * Uses preloaded AssetContainer.instantiateModelsToScene when `def.model` is set.
   */
  static async create(
    scene: Scene,
    def: EntityDef,
    pixelX: number,
    pixelY: number,
  ): Promise<Entity> {
    void scene;
    const worldH = DEFAULT_MODEL_HEIGHT * (def.displayScale ?? 1);
    let entity: Entity;

    const container = def.model ? assetStore.getModelContainer(def.model) : undefined;
    if (container) {
      const { root, animator } = instantiateScaledModel(container, def.id, worldH);
      root.position.x = pixelX * WORLD_SCALE;
      root.position.z = pixelY * WORLD_SCALE;
      entity = new Entity(generateId(), def.id, root as never);
      entity.displayWidth = worldH * 0.5;
      entity.displayHeight = worldH;
      root.metadata = { ...(root.metadata ?? {}), entity, isModel: true };
      entity.setComponent('modelAnim', animator);
    } else {
      const textureKey = def.sprite === 'placeholder' ? '__placeholder' : def.sprite;
      const billboardH = 85 * WORLD_SCALE * (def.displayScale ?? 1);
      const mesh = MeshFactory.createBillboard(scene, def.id, textureKey, billboardH);
      mesh.position.x = pixelX * WORLD_SCALE;
      mesh.position.z = pixelY * WORLD_SCALE;
      entity = new Entity(generateId(), def.id, mesh);
      entity.displayWidth = (mesh.metadata?.displayWidth as number) ?? billboardH;
      entity.displayHeight = (mesh.metadata?.displayHeight as number) ?? billboardH;
      mesh.metadata = { ...(mesh.metadata ?? {}), entity };
      entity.setComponent('textureKey', textureKey);
    }

    attachComponents(entity, def);
    return entity;
  }
}

/** Attach JSON-defined components onto a freshly spawned entity. */
function attachComponents(entity: Entity, def: EntityDef): void {
  const comps = def.components;
  const textureKey = entity.getComponent<string>('textureKey') ?? def.sprite;

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

  if (comps.ai) entity.setComponent('ai', { ...comps.ai });
  if (comps.loot) entity.setComponent('loot', { ...comps.loot });
  if (comps.contactDamage) entity.setComponent('contactDamage', { ...comps.contactDamage });

  if (comps.animations && !entity.getComponent('modelAnim')) {
    const animIdPrefix = def.id.replace(/[^a-z0-9]/gi, '_');
    entity.setComponent('animator', new Animator(animIdPrefix));
    entity.setComponent('animDef', comps.animations);
    entity.setComponent('textureKey', textureKey);
    const sheet = assetStore.getSpritesheet(textureKey);
    if (sheet) {
      const frame = comps.animations.idleFrame;
      entity.frameIndex = frame;
      MeshFactory.applyFrame(entity.mesh as never, frame, sheet.columns, sheet.rows);
    }
  }
}
