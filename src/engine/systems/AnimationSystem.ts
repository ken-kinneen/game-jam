import type { Entity } from '../entities/Entity';
import { Movement } from '../entities/components/Movement';
import { Animator } from '../entities/components/Animator';

const MOVING_THRESHOLD = 4; // px/s — below this, treat as idle (avoids animation jitter near zero)

/**
 * Derives facing direction from an entity's current velocity (not input intent, so
 * it reflects acceleration/friction the same way movement itself does — no separate
 * "facing" state to fall out of sync) and plays the matching idle/walk animation.
 * No-ops for entities without both a Movement and an Animator component, so this is
 * safe to run over every entity unconditionally.
 */
export class AnimationSystem {
  update(entity: Entity): void {
    const movement = entity.getComponent<Movement>('movement');
    const animator = entity.getComponent<Animator>('animator');
    if (!movement || !animator) return;

    const speed = Math.hypot(movement.velocityX, movement.velocityY);
    const isMoving = speed > MOVING_THRESHOLD;

    if (isMoving) {
      // Predominant axis decides direction; a diagonal move still needs one
      // unambiguous facing, matching the sheet's 3 rows (down/up/side).
      if (Math.abs(movement.velocityY) >= Math.abs(movement.velocityX)) {
        animator.direction = movement.velocityY > 0 ? 'down' : 'up';
      } else {
        animator.direction = 'side';
        animator.facingRight = movement.velocityX > 0;
      }
    }

    if (animator.direction === 'side') {
      entity.sprite.setFlipX(!animator.facingRight);
    } else {
      entity.sprite.setFlipX(false);
    }

    const state = isMoving ? 'walk' : 'idle';
    const key = `${animator.animIdPrefix}_${state}_${animator.direction}`;

    if (animator.currentAnimKey !== key) {
      entity.sprite.play(key, true);
      animator.currentAnimKey = key;
    }
  }
}
