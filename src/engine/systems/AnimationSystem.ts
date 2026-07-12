import type { Mesh } from '@babylonjs/core';
import type { Entity } from '../entities/Entity';
import { Movement } from '../entities/components/Movement';
import { Animator } from '../entities/components/Animator';
import type { ConfigManager } from '../core/ConfigManager';
import type { EntityDef } from '../schemas/entity.schema';
import { MeshFactory } from '../rendering/MeshFactory';
import { assetStore } from '../rendering/AssetStore';
import type { ModelAnimator } from '../entities/ModelAnimator';

const MOVING_THRESHOLD = 4;
const DECEL_HOLD_MS = 120;

/** Drives spritesheet frames or GLB AnimationGroups on entities. */
export class AnimationSystem {
  private decelTimer = 0;
  private frameAccum = 0;

  constructor(private configManager?: ConfigManager) {}

  update(entity: Entity, dt: number): void {
    const modelAnim = entity.getComponent<ModelAnimator>('modelAnim');
    if (modelAnim) {
      this.updateModel(entity, modelAnim);
      return;
    }

    const movement = entity.getComponent<Movement>('movement');
    const animator = entity.getComponent<Animator>('animator');
    const animDef = entity.getComponent<EntityDef['components']['animations']>('animDef');
    if (!movement || !animator || !animDef) return;

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

    entity.flipX = animator.direction === 'side' && !animator.facingRight;
    const sx = Math.abs(entity.mesh.scaling.x) || 1;
    const sy = Math.abs(entity.mesh.scaling.y) || 1;
    entity.setScale(sx, sy);

    const wasWalking = animator.currentAnimKey?.includes('_walk_') ?? false;
    if (!isMoving && wasWalking && this.decelTimer < DECEL_HOLD_MS) {
      this.decelTimer += dt * 1000;
      if (this.configManager) {
        entity.animFps = this.configManager.get<number>('animation', 'walkFpsMin');
      }
      this.advanceFrame(entity, animDef, animator, dt);
      return;
    }

    const state = isMoving ? 'walk' : 'idle';
    const key = `${animator.animIdPrefix}_${state}_${animator.direction}`;
    animator.currentAnimKey = key;

    if (state === 'walk' && this.configManager) {
      const minFps = this.configManager.get<number>('animation', 'walkFpsMin');
      const maxFps = this.configManager.get<number>('animation', 'walkFpsMax');
      const speedRatio = Math.min(speed / movement.maxSpeed, 1);
      entity.animFps = minFps + speedRatio * (maxFps - minFps);
    } else {
      entity.animFps = animDef.frameRate;
    }

    this.advanceFrame(entity, animDef, animator, dt);
  }

  /** Drive GLB walk clip + yaw from velocity. */
  private updateModel(entity: Entity, modelAnim: ModelAnimator): void {
    const movement = entity.getComponent<Movement>('movement');
    if (!movement) return;
    const speed = Math.hypot(movement.velocityX, movement.velocityY);
    const isMoving = speed > MOVING_THRESHOLD;
    if (isMoving) {
      const ratio = Math.min(1.4, 0.7 + (speed / Math.max(1, movement.maxSpeed)) * 0.7);
      modelAnim.playWalk(ratio);
      modelAnim.faceVelocity(movement.velocityX, movement.velocityY);
    } else {
      modelAnim.stopWalk();
    }
  }

  private advanceFrame(
    entity: Entity,
    animDef: NonNullable<EntityDef['components']['animations']>,
    animator: Animator,
    dt: number,
  ): void {
    const textureKey = entity.getComponent<string>('textureKey');
    if (!textureKey) return;
    const sheet = assetStore.getSpritesheet(textureKey);
    if (!sheet) return;

    const dirIndex = Math.max(0, animDef.directions.indexOf(animator.direction));
    const rowOffset = dirIndex * animDef.framesPerRow;
    const isWalk = animator.currentAnimKey?.includes('_walk_') ?? false;

    if (isWalk) {
      this.frameAccum += dt * entity.animFps;
      const walkLen = animDef.walkFrames.length;
      const walkIdx = Math.floor(this.frameAccum) % walkLen;
      entity.frameIndex = rowOffset + animDef.walkFrames[walkIdx];
    } else {
      this.frameAccum = 0;
      entity.frameIndex = rowOffset + animDef.idleFrame;
    }

    MeshFactory.applyFrame(entity.mesh as Mesh, entity.frameIndex, sheet.columns, sheet.rows);
  }
}
