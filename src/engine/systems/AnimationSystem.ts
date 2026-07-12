import type { Entity } from '../entities/Entity';
import { Movement } from '../entities/components/Movement';
import { Animator } from '../entities/components/Animator';
import type { ConfigManager } from '../core/ConfigManager';

const MOVING_THRESHOLD = 4;
const DECEL_HOLD_MS = 120;

export class AnimationSystem {
  private decelTimer = 0;

  constructor(private configManager?: ConfigManager) {}

  update(entity: Entity, dt: number): void {
    const movement = entity.getComponent<Movement>('movement');
    const animator = entity.getComponent<Animator>('animator');
    if (!movement || !animator) return;

    const speed = Math.hypot(movement.velocityX, movement.velocityY);
    const isMoving = speed > MOVING_THRESHOLD;

    if (isMoving) {
      this.decelTimer = 0;
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

    // Hold the walk animation briefly after stopping so it doesn't snap mid-stride
    const wasWalking = animator.currentAnimKey?.includes('_walk_') ?? false;
    if (!isMoving && wasWalking && this.decelTimer < DECEL_HOLD_MS) {
      this.decelTimer += dt * 1000;
      // Slow the walk to minimum fps during decel hold
      if (this.configManager) {
        const minFps = this.configManager.get<number>('animation', 'walkFpsMin');
        entity.sprite.anims.msPerFrame = 1000 / minFps;
      }
      return;
    }

    const state = isMoving ? 'walk' : 'idle';
    const key = `${animator.animIdPrefix}_${state}_${animator.direction}`;

    if (animator.currentAnimKey !== key) {
      entity.sprite.play(key, true);
      animator.currentAnimKey = key;
    }

    if (state === 'walk' && this.configManager) {
      const minFps = this.configManager.get<number>('animation', 'walkFpsMin');
      const maxFps = this.configManager.get<number>('animation', 'walkFpsMax');
      const speedRatio = Math.min(speed / movement.maxSpeed, 1);
      const fps = minFps + speedRatio * (maxFps - minFps);
      entity.sprite.anims.msPerFrame = 1000 / fps;
    }
  }
}
