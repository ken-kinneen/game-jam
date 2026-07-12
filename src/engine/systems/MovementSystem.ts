import type { Entity } from '../entities/Entity';
import { Movement } from '../entities/components/Movement';
import type { StatSheet } from '../stats/StatSheet';
import type { CollisionWorld } from '../rendering/CollisionWorld';
import { WORLD_SCALE } from '../entities/EntityFactory';

/**
 * Isaac-style movement: velocity-based with acceleration toward intent, friction on release.
 * Applies position via CollisionWorld slide (XZ plane). Speeds are in old pixel units/sec.
 */
export class MovementSystem {
  private collision: CollisionWorld | null = null;
  private bodyRadius = 0.35;

  /** Attach the shared collision world used for wall sliding. */
  setCollisionWorld(world: CollisionWorld, bodyRadiusWorld = 0.35): void {
    this.collision = world;
    this.bodyRadius = bodyRadiusWorld;
  }

  /** Update an entity's movement toward the given intent vector (normalized or zero). */
  update(entity: Entity, intentX: number, intentY: number, dt: number): void {
    const movement = entity.getComponent<Movement>('movement');
    if (!movement) return;

    const stats = entity.getComponent<StatSheet>('stats');
    const maxSpeed = stats ? stats.get('moveSpeed') : movement.maxSpeed;

    const desiredX = intentX * maxSpeed;
    const desiredY = intentY * maxSpeed;

    if (intentX !== 0 || intentY !== 0) {
      movement.velocityX = moveToward(movement.velocityX, desiredX, movement.acceleration * dt);
      movement.velocityY = moveToward(movement.velocityY, desiredY, movement.acceleration * dt);
    } else {
      movement.velocityX = moveToward(movement.velocityX, 0, movement.friction * dt);
      movement.velocityY = moveToward(movement.velocityY, 0, movement.friction * dt);
    }

    const dx = movement.velocityX * dt * WORLD_SCALE;
    const dz = movement.velocityY * dt * WORLD_SCALE;

    if (this.collision) {
      const next = this.collision.moveCircle(entity.x, entity.y, this.bodyRadius, dx, dz);
      entity.x = next.x;
      entity.y = next.z;
    } else {
      entity.x += dx;
      entity.y += dz;
    }

    // Keep feet on ground (billboards centered on Y; GLB models already grounded)
    if (!entity.getComponent('modelAnim')) {
      const h = entity.displayHeight * Math.abs(entity.mesh.scaling.y);
      entity.mesh.position.y = h / 2 + entity.appliedOffsetY * WORLD_SCALE;
    }
  }

  /** Apply a knockback impulse to an entity's velocity. */
  applyKnockback(entity: Entity, forceX: number, forceY: number): void {
    const movement = entity.getComponent<Movement>('movement');
    if (!movement) return;
    movement.velocityX += forceX;
    movement.velocityY += forceY;
  }
}

/** Move a value toward a target by at most maxDelta. */
function moveToward(current: number, target: number, maxDelta: number): number {
  if (Math.abs(target - current) <= maxDelta) return target;
  return current + Math.sign(target - current) * maxDelta;
}
