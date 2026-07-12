import type { Entity } from '../entities/Entity';
import { Movement } from '../entities/components/Movement';
import { Animator } from '../entities/components/Animator';
import type { ConfigManager } from '../core/ConfigManager';
import type { EventBus } from '../core/EventBus';

const MOVING_THRESHOLD = 4;
const ACCEL_THRESHOLD = 30;

export class ProceduralAnimSystem {
  private fuelRatio = 1;
  private prevBobPhase = 0;

  constructor(
    private configManager: ConfigManager,
    private eventBus?: EventBus,
  ) {}

  setFuelRatio(ratio: number): void {
    this.fuelRatio = ratio;
  }

  update(entity: Entity, dt: number): void {
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

    // --- Idle breathing (speeds up under stress / low fuel) ---
    if (!isMoving) {
      const baseBreathSpeed = this.configManager.get<number>('animation', 'breathSpeed');
      const breathScale = this.configManager.get<number>('animation', 'breathScaleAmt');

      // Breath quickens as fuel drops: 1x at full, up to 2.2x when critical
      const stressMult = 1 + (1 - this.fuelRatio) * 1.2;
      const breathSpeed = baseBreathSpeed * stressMult;

      animator.breathPhase += breathSpeed * dt;
      const breathSin = Math.sin(animator.breathPhase * Math.PI * 2);

      const stressScale = breathScale * (1 + (1 - this.fuelRatio) * 0.5);
      scaleMultY += breathSin * stressScale;
      scaleMultX -= breathSin * stressScale * 0.5;
    } else {
      animator.breathPhase = 0;
    }

    // --- Walk bob ---
    if (isMoving) {
      const walkBobAmt = this.configManager.get<number>('animation', 'walkBobAmt');
      const msPerFrame = entity.sprite.anims.msPerFrame || 125;
      const animFps = 1000 / msPerFrame;
      const bobFreqHz = animFps / 2;
      animator.bobPhase += bobFreqHz * dt;

      // Emit footstep event on each bob cycle (foot hits ground)
      const prevCycle = Math.floor(this.prevBobPhase);
      const curCycle = Math.floor(animator.bobPhase);
      if (curCycle > prevCycle && this.eventBus) {
        this.eventBus.emit('player:footstep', {});
      }
      this.prevBobPhase = animator.bobPhase;

      // Squash scaleY down on foot contact — feet stay planted via compensation
      const bobSin = Math.abs(Math.sin(animator.bobPhase * Math.PI));
      const bobSquash = bobSin * walkBobAmt * 0.01;
      scaleMultY -= bobSquash;
      scaleMultX += bobSquash * 0.5;
    } else {
      animator.bobPhase = 0;
      animator.bobOffsetY = 0;
    }

    // --- Stop settle (damped spring) ---
    if (!isMoving && animator.wasMoving) {
      // Just stopped — kick the spring based on how fast we were going
      const settleKick = this.configManager.get<number>('animation', 'settleKick');
      const speedRatio = Math.min(animator.prevSpeed / movement.maxSpeed, 1);
      animator.settleVelocity = settleKick * speedRatio;
      animator.settleOffsetY = 0;
    }

    if (Math.abs(animator.settleOffsetY) > 0.01 || Math.abs(animator.settleVelocity) > 0.1) {
      const stiffness = this.configManager.get<number>('animation', 'settleStiffness');
      const damping = this.configManager.get<number>('animation', 'settleDamping');

      // Spring force pulls back to 0, damping slows it down
      const springForce = -stiffness * animator.settleOffsetY;
      const dampForce = -damping * animator.settleVelocity;
      animator.settleVelocity += (springForce + dampForce) * dt;
      animator.settleOffsetY += animator.settleVelocity * dt;

      offsetY += animator.settleOffsetY;

      // Squash/stretch from settle motion
      const settleSquash = animator.settleVelocity * 0.002;
      scaleMultY += settleSquash;
      scaleMultX -= settleSquash * 0.5;
    } else {
      animator.settleOffsetY = 0;
      animator.settleVelocity = 0;
    }

    // --- Squash/stretch from accel/decel ---
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

    // --- Lean (weighted character leans into direction of travel) ---
    const leanFactor = this.configManager.get<number>('animation', 'leanFactor');
    const leanSmoothing = this.configManager.get<number>('animation', 'leanSmoothing');
    const targetLean = movement.velocityX * leanFactor * (1 / movement.maxSpeed);
    animator.leanAngle = lerp(animator.leanAngle, targetLean, leanSmoothing * dt);

    // Forward pitch: very subtle scaleY compression when moving (carrying weight)
    if (isMoving) {
      const speedRatio = speed / movement.maxSpeed;
      scaleMultY -= speedRatio * 0.003;
    }

    // --- Apply all transforms ---
    const finalScaleY = animator.baseScaleY * scaleMultY;
    entity.sprite.setScale(animator.baseScaleX * scaleMultX, finalScaleY);

    // Compensate Y so feet stay planted: when scaleY grows, the sprite expands
    // equally up and down from its center origin. Shift Y up by half the height
    // difference to keep the bottom edge (feet) at the same position.
    const baseHeight = entity.sprite.height * animator.baseScaleY;
    const currentHeight = entity.sprite.height * finalScaleY;
    const scaleCompensation = -(currentHeight - baseHeight) / 2;

    const totalOffsetY = offsetY + scaleCompensation;

    entity.sprite.y -= animator.appliedOffsetY;
    entity.sprite.y += totalOffsetY;
    animator.appliedOffsetY = totalOffsetY;

    entity.sprite.setRotation(animator.leanAngle);

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
    entity.sprite.y -= animator.appliedOffsetY;
    animator.appliedOffsetY = 0;
    entity.sprite.setScale(animator.baseScaleX, animator.baseScaleY);
    entity.sprite.setRotation(0);
  }
}

function lerp(current: number, target: number, rate: number): number {
  const t = Math.min(rate, 1);
  return current + (target - current) * t;
}
