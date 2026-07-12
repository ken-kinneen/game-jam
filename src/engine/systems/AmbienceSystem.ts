import {
  Scene,
  Color3,
  Color4,
  HemisphericLight,
  ParticleSystem,
  Texture,
  Vector3,
  DefaultRenderingPipeline,
} from '@babylonjs/core';
import type { Entity } from '../entities/Entity';
import type { CaveMap } from '../generation/caveGenerator';
import { Movement } from '../entities/components/Movement';

/** Cave/home atmosphere: fog, vignette/bloom pipeline, dust + footstep particles. */
export class AmbienceSystem {
  private dust: ParticleSystem | null = null;
  private footsteps: ParticleSystem | null = null;
  private pipeline: DefaultRenderingPipeline | null = null;
  private dustTimer = 0;
  private footstepFrames = 0;

  constructor(
    private scene: Scene,
    private player: Entity,
    private isCave: boolean,
  ) {}

  /** Create lights/fog/particles for the current scene kind. */
  create(_caveMap: CaveMap | null): void {
    this.scene.fogMode = Scene.FOGMODE_NONE;
    const hemi = this.scene.lights.find((l) => l instanceof HemisphericLight) as
      HemisphericLight | undefined;
    if (this.isCave) {
      this.scene.clearColor = new Color4(0.0, 0.0, 0.0, 1);
      this.scene.ambientColor = new Color3(0, 0, 0);
      // No ambient light — the player's lantern is the only source
      if (hemi) hemi.setEnabled(false);
    } else {
      this.scene.clearColor = new Color4(0.25, 0.45, 0.65, 1);
      if (hemi) {
        hemi.setEnabled(true);
        hemi.intensity = 1.4;
        hemi.groundColor = new Color3(0.3, 0.25, 0.2);
      }
    }

    this.pipeline = new DefaultRenderingPipeline('ambience', true, this.scene);
    this.pipeline.bloomEnabled = this.isCave;
    this.pipeline.bloomThreshold = 0.4;
    this.pipeline.bloomWeight = 0.45;
    this.pipeline.imageProcessingEnabled = true;
    if (this.pipeline.imageProcessing) {
      this.pipeline.imageProcessing.vignetteEnabled = true;
      this.pipeline.imageProcessing.vignetteWeight = this.isCave ? 1.2 : 0.3;
      this.pipeline.imageProcessing.vignetteColor = new Color4(0, 0, 0, 0);
    }

    this.dust = this.makeDust();
    this.footsteps = this.makeFootsteps();
  }

  /** Emit dust and footstep particles based on player motion. */
  update(): void {
    this.dustTimer += 1;
    if (this.dust && this.dustTimer >= 11) {
      this.dustTimer = 0;
      const px = this.player.x + (Math.random() - 0.5) * 8;
      const pz = this.player.y + (Math.random() - 0.5) * 8;
      this.dust.emitter = new Vector3(px, 1.5, pz);
      this.dust.manualEmitCount = 1;
    }

    const movement = this.player.getComponent<Movement>('movement');
    const speed = movement ? Math.hypot(movement.velocityX, movement.velocityY) : 0;
    if (this.footsteps && speed > 5) {
      this.footstepFrames++;
      if (this.footstepFrames >= 6) {
        this.footstepFrames = 0;
        this.footsteps.emitter = new Vector3(this.player.x, 0.05, this.player.y);
        this.footsteps.manualEmitCount = 2;
      }
    }
  }

  /** Dispose particle systems and post-process pipeline. */
  destroy(): void {
    this.dust?.dispose();
    this.footsteps?.dispose();
    this.pipeline?.dispose();
    this.dust = null;
    this.footsteps = null;
    this.pipeline = null;
  }

  private makeDust(): ParticleSystem {
    const ps = new ParticleSystem('dust', 40, this.scene);
    ps.particleTexture = this.makeParticleTexture();
    ps.minSize = 0.05;
    ps.maxSize = 0.12;
    ps.minLifeTime = 1.2;
    ps.maxLifeTime = 2.5;
    ps.emitRate = 0;
    ps.color1 = new Color4(1, 1, 1, 0.25);
    ps.color2 = new Color4(0.8, 0.8, 0.9, 0.1);
    ps.colorDead = new Color4(0, 0, 0, 0);
    ps.gravity = new Vector3(0, -0.05, 0);
    ps.direction1 = new Vector3(-0.1, 0.2, -0.1);
    ps.direction2 = new Vector3(0.1, 0.4, 0.1);
    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    ps.start();
    return ps;
  }

  private makeFootsteps(): ParticleSystem {
    const ps = new ParticleSystem('footsteps', 20, this.scene);
    ps.particleTexture = this.makeParticleTexture();
    ps.minSize = 0.04;
    ps.maxSize = 0.08;
    ps.minLifeTime = 0.3;
    ps.maxLifeTime = 0.6;
    ps.emitRate = 0;
    ps.color1 = new Color4(0.5, 0.45, 0.35, 0.35);
    ps.color2 = new Color4(0.4, 0.35, 0.3, 0.15);
    ps.colorDead = new Color4(0, 0, 0, 0);
    ps.gravity = new Vector3(0, 0.2, 0);
    ps.direction1 = new Vector3(-0.2, 0.3, -0.2);
    ps.direction2 = new Vector3(0.2, 0.5, 0.2);
    ps.start();
    return ps;
  }

  private makeParticleTexture(): Texture {
    const size = 16;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return new Texture(
      'data:image/png;base64,' + canvas.toDataURL('image/png').split(',')[1],
      this.scene,
      true,
      false,
      Texture.BILINEAR_SAMPLINGMODE,
    );
  }
}
