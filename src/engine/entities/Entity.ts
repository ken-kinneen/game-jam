import type { EntityDef } from '../schemas/entity.schema';

/** Thin wrapper: Phaser sprite + a components map, identified by def ID. */
export class Entity {
  readonly id: string;
  readonly defId: string;
  readonly components = new Map<string, unknown>();
  sprite: Phaser.Physics.Arcade.Sprite;

  constructor(id: string, defId: string, sprite: Phaser.Physics.Arcade.Sprite) {
    this.id = id;
    this.defId = defId;
    this.sprite = sprite;
  }

  /** Get a typed component by name. */
  getComponent<T>(name: string): T | undefined {
    return this.components.get(name) as T | undefined;
  }

  /** Set a component by name. */
  setComponent<T>(name: string, component: T): void {
    this.components.set(name, component);
  }

  /** Check if entity has a component. */
  hasComponent(name: string): boolean {
    return this.components.has(name);
  }

  /** Destroy the entity's Phaser objects. */
  destroy(): void {
    this.sprite.destroy();
  }
}
