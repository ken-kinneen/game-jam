import type { AbstractMesh } from '@babylonjs/core';
import type { EntityDef } from '../schemas/entity.schema';

/**
 * Thin wrapper: Babylon mesh + components map, identified by def ID.
 * Game-plane accessors `x`/`y` map to mesh position X/Z (Y is up).
 */
export class Entity {
  readonly id: string;
  readonly defId: string;
  readonly components = new Map<string, unknown>();
  mesh: AbstractMesh;

  /** Display size in world units (billboard). */
  displayWidth = 1;
  displayHeight = 1;

  /** Current spritesheet cell for animation systems. */
  frameIndex = 0;
  /** Frames per second for the active walk/idle clip. */
  animFps = 8;
  /** Flip billboard on X for side-facing. */
  flipX = false;
  /** Rotation around up-axis for lean (radians). */
  leanRotation = 0;
  /** Extra Y offset applied by procedural anim (undone next frame). */
  appliedOffsetY = 0;
  /** Whether this entity is still active in the world. */
  active = true;

  constructor(id: string, defId: string, mesh: AbstractMesh) {
    this.id = id;
    this.defId = defId;
    this.mesh = mesh;
  }

  /** Game-plane X (Babylon X). */
  get x(): number {
    return this.mesh.position.x;
  }
  set x(v: number) {
    this.mesh.position.x = v;
  }

  /** Game-plane Y (Babylon Z). */
  get y(): number {
    return this.mesh.position.z;
  }
  set y(v: number) {
    this.mesh.position.z = v;
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

  /** Scale billboard uniformly / non-uniformly. */
  setScale(sx: number, sy?: number): void {
    const y = sy ?? sx;
    this.mesh.scaling.x = this.flipX ? -Math.abs(sx) : Math.abs(sx);
    this.mesh.scaling.y = y;
  }

  /** Destroy the entity's mesh and model animation groups. */
  destroy(): void {
    this.active = false;
    const modelAnim = this.getComponent<{ dispose: () => void }>('modelAnim');
    modelAnim?.dispose();
    this.mesh.dispose();
  }
}

// Re-export for callers that still reference EntityDef through Entity module
export type { EntityDef };
