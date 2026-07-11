import type { Entity } from '../entities/Entity';
import type { CaveMap } from '../generation/caveGenerator';

const CAVE_TILE_PX = 16;

/**
 * Visual ambience: camera post-FX, floating dust particles,
 * footstep dust, and wall ambient-occlusion overlay.
 */
export class AmbienceSystem {
  private dustEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private footstepEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private dustTimer: Phaser.Time.TimerEvent | null = null;

  constructor(
    private scene: Phaser.Scene,
    private player: Entity,
    private isCave: boolean,
  ) {}

  create(caveMap: CaveMap | null): void {
    this.applyCameraFX();
    if (this.isCave) {
      this.createDustParticles();
      this.createFootstepParticles();
      if (caveMap) {
        this.paintAmbientOcclusion(caveMap);
      }
    }
  }

  update(): void {
    this.updateFootsteps();
  }

  // -- camera post-FX ---------------------------------------------------

  private applyCameraFX(): void {
    const cam = this.scene.cameras.main;
    if (!cam.postFX) return;

    try {
      cam.postFX.addVignette(0.5, 0.5, 0.88, 0.38);
      if (this.isCave) {
        cam.postFX.addBloom(0xffffff, 1, 1, 0.6, 1.15);
      }
    } catch {
      // PostFX not available (Canvas renderer or missing pipeline)
    }
  }

  // -- floating dust motes -----------------------------------------------

  private createDustParticles(): void {
    const tex = this.getOrCreateDustTexture();
    this.dustEmitter = this.scene.add.particles(0, 0, tex, {
      lifespan: { min: 4000, max: 8000 },
      speed: { min: 2, max: 8 },
      scale: { start: 0.3, end: 0.0 },
      alpha: { start: 0.25, end: 0 },
      angle: { min: 0, max: 360 },
      frequency: -1,
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    this.dustEmitter.setDepth(801);
    this.dustTimer = this.scene.time.addEvent({
      delay: 180,
      loop: true,
      callback: () => this.emitDustMote(),
    });
  }

  private emitDustMote(): void {
    if (!this.dustEmitter) return;
    const cam = this.scene.cameras.main;
    const spread = Math.max(cam.width, cam.height) / (2 * cam.zoom);
    const cx = cam.scrollX + cam.width / (2 * cam.zoom);
    const cy = cam.scrollY + cam.height / (2 * cam.zoom);
    const x = cx + (Math.random() - 0.5) * spread * 2;
    const y = cy + (Math.random() - 0.5) * spread * 2;
    this.dustEmitter.emitParticleAt(x, y, 1);
  }

  // -- footstep dust -----------------------------------------------------

  private createFootstepParticles(): void {
    const tex = this.getOrCreateDustTexture();
    this.footstepEmitter = this.scene.add.particles(0, 0, tex, {
      lifespan: 600,
      speed: { min: 4, max: 14 },
      scale: { start: 0.4, end: 0.0 },
      alpha: { start: 0.35, end: 0 },
      angle: { min: 160, max: 200 },
      gravityY: 8,
      frequency: -1,
      quantity: 2,
      tint: 0x998877,
    });
    this.footstepEmitter.setDepth(9);
  }

  private updateFootsteps(): void {
    if (!this.footstepEmitter) return;
    const body = this.player.sprite.body as Phaser.Physics.Arcade.Body | null;
    if (!body) return;
    const moving = Math.abs(body.velocity.x) > 5 || Math.abs(body.velocity.y) > 5;

    if (moving) {
      const px = this.player.sprite.x;
      const py = this.player.sprite.y + this.player.sprite.displayHeight * 0.35;
      if (this.scene.time.now % 6 < 2) {
        this.footstepEmitter.emitParticleAt(px, py, 2);
      }
    }
  }

  // -- wall ambient occlusion -------------------------------------------

  private paintAmbientOcclusion(caveMap: CaveMap): void {
    const T = CAVE_TILE_PX;
    const aoRadius = 3;

    const gfx = this.scene.add.graphics();
    gfx.setDepth(-1);

    for (let gy = 0; gy < caveMap.height; gy++) {
      for (let gx = 0; gx < caveMap.width; gx++) {
        if (caveMap.grid[gy][gx] !== 1) continue;

        let wallNeighbors = 0;
        for (let dy = -aoRadius; dy <= aoRadius; dy++) {
          for (let dx = -aoRadius; dx <= aoRadius; dx++) {
            if (dx === 0 && dy === 0) continue;
            const ny = gy + dy;
            const nx = gx + dx;
            if (ny < 0 || ny >= caveMap.height || nx < 0 || nx >= caveMap.width) {
              wallNeighbors++;
            } else if (caveMap.grid[ny][nx] === 0) {
              const dist = Math.sqrt(dx * dx + dy * dy);
              wallNeighbors += 1 / dist;
            }
          }
        }

        if (wallNeighbors > 0.5) {
          const maxInfluence = 6;
          const intensity = Math.min(wallNeighbors / maxInfluence, 1);
          const alpha = intensity * 0.35;
          gfx.fillStyle(0x000000, alpha);
          gfx.fillRect(gx * T, gy * T, T, T);
        }
      }
    }
  }

  // -- shared texture ----------------------------------------------------

  private getOrCreateDustTexture(): string {
    const key = '__dust_mote';
    if (this.scene.textures.exists(key)) return key;

    const size = 16;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d')!;
    const half = size / 2;
    const g = ctx.createRadialGradient(half, half, 0, half, half, half);
    g.addColorStop(0, 'rgba(255,255,255,0.8)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.3)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    this.scene.textures.addCanvas(key, c);
    return key;
  }
}
