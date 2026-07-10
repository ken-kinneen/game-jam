import type { Entity } from '../entities/Entity';
import { Movement } from '../entities/components/Movement';
import type { StatSheet } from '../stats/StatSheet';

/**
 * Isaac-style movement: velocity-based with acceleration toward intent, friction on release.
 * All tuning numbers come from the entity's StatSheet/Movement component, never hardcoded.
 */
export class MovementSystem {
  /** Update an entity's movement toward the given intent vector (should be normalized or zero). */
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

    const body = entity.sprite.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.setVelocity(movement.velocityX, movement.velocityY);
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
