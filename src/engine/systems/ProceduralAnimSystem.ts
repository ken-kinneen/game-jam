import type { Entity } from '../entities/Entity';
import { Movement } from '../entities/components/Movement';
import { Animator } from '../entities/components/Animator';
import type { ConfigManager } from '../core/ConfigManager';

const MOVING_THRESHOLD = 4;
const ACCEL_THRESHOLD = 30;

/** Procedural squash/stretch/bob overlays on top of spritesheet animation. */
export class ProceduralAnimSystem {
  constructor(private configManager: ConfigManager) {}

  update(entity: Entity, dt: number): void {
    if (entity.getComponent('modelAnim')) return;

    if (!this.configManager.get<boolean>('animation', 'enabled')) {
      this.resetTransforms(entity);
      return;
    }

    const movement = entity.getComponent<Movement>('movement');
    const animator = entity.getComponent<Animator>('animator');
    if (!movement || !animator) return;

    const speed = Math.hypot(movement.velocityX, movement.velocityY);
    const isMoving = speed > MOVING_THRESHOLD;

    let offsetY = 0;
    let scaleMultX = 1;
    let scaleMultY = 1;

    if (!isMoving) {
      const breathSpeed = this.configManager.get<number>('animation', 'breathSpeed');
      const breathScale = this.configManager.get<number>('animation', 'breathScaleAmt');
      animator.breathPhase += breathSpeed * dt;
      const breathSin = Math.sin(animator.breathPhase * Math.PI * 2);
      scaleMultY += breathSin * breathScale;
      scaleMultX -= breathSin * breathScale * 0.5;
    } else {
      animator.breathPhase = 0;
    }

    if (isMoving) {
      const walkBobAmt = this.configManager.get<number>('animation', 'walkBobAmt');
      const animFps = entity.animFps || 8;
      const bobFreqHz = animFps / 2;
      animator.bobPhase += bobFreqHz * dt;
      const bobSin = Math.abs(Math.sin(animator.bobPhase * Math.PI));
      const bobSquash = bobSin * walkBobAmt * 0.01;
      scaleMultY -= bobSquash;
      scaleMultX += bobSquash * 0.5;
    } else {
      animator.bobPhase = 0;
      animator.bobOffsetY = 0;
    }

    if (!isMoving && animator.wasMoving) {
      const settleKick = this.configManager.get<number>('animation', 'settleKick');
      const speedRatio = Math.min(animator.prevSpeed / movement.maxSpeed, 1);
      animator.settleVelocity = settleKick * speedRatio;
      animator.settleOffsetY = 0;
    }

    if (Math.abs(animator.settleOffsetY) > 0.01 || Math.abs(animator.settleVelocity) > 0.1) {
      const stiffness = this.configManager.get<number>('animation', 'settleStiffness');
      const damping = this.configManager.get<number>('animation', 'settleDamping');
      const springForce = -stiffness * animator.settleOffsetY;
      const dampForce = -damping * animator.settleVelocity;
      animator.settleVelocity += (springForce + dampForce) * dt;
      animator.settleOffsetY += animator.settleVelocity * dt;
      offsetY += animator.settleOffsetY;
      const settleSquash = animator.settleVelocity * 0.002;
      scaleMultY += settleSquash;
      scaleMultX -= settleSquash * 0.5;
    } else {
      animator.settleOffsetY = 0;
      animator.settleVelocity = 0;
    }

    const speedDelta = speed - animator.prevSpeed;
    const intensity = this.configManager.get<number>('animation', 'squashIntensity');
    const recovery = this.configManager.get<number>('animation', 'squashRecovery');

    if (speedDelta > ACCEL_THRESHOLD) {
      animator.squashX = 1 - intensity;
      animator.squashY = 1 + intensity;
    } else if (speedDelta < -ACCEL_THRESHOLD) {
      animator.squashX = 1 + intensity;
      animator.squashY = 1 - intensity;
    }

    animator.squashX = lerp(animator.squashX, 1, recovery * dt);
    animator.squashY = lerp(animator.squashY, 1, recovery * dt);
    scaleMultX *= animator.squashX;
    scaleMultY *= animator.squashY;

    const leanFactor = this.configManager.get<number>('animation', 'leanFactor');
    const leanSmoothing = this.configManager.get<number>('animation', 'leanSmoothing');
    const targetLean = movement.velocityX * leanFactor * (1 / movement.maxSpeed);
    animator.leanAngle = lerp(animator.leanAngle, targetLean, leanSmoothing * dt);

    const finalScaleY = animator.baseScaleY * scaleMultY;
    entity.setScale(animator.baseScaleX * scaleMultX, finalScaleY);

    const baseHeight = entity.displayHeight * animator.baseScaleY;
    const currentHeight = entity.displayHeight * finalScaleY;
    const scaleCompensation = -(currentHeight - baseHeight) / 2;
    const totalOffsetY = offsetY + scaleCompensation;

    animator.appliedOffsetY = totalOffsetY;
    entity.appliedOffsetY = totalOffsetY;
    entity.leanRotation = animator.leanAngle;

    animator.wasMoving = isMoving;
    animator.prevSpeed = speed;
  }

  private resetTransforms(entity: Entity): void {
    const animator = entity.getComponent<Animator>('animator');
    if (!animator) return;
    animator.squashX = 1;
    animator.squashY = 1;
    animator.leanAngle = 0;
    animator.settleOffsetY = 0;
    animator.settleVelocity = 0;
    animator.breathPhase = 0;
    animator.bobPhase = 0;
    animator.appliedOffsetY = 0;
    entity.appliedOffsetY = 0;
    entity.setScale(animator.baseScaleX, animator.baseScaleY);
    entity.leanRotation = 0;
  }
}

function lerp(current: number, target: number, rate: number): number {
  const t = Math.min(rate, 1);
  return current + (target - current) * t;
}
