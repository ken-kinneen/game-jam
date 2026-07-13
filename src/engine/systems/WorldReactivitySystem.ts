import type { Entity } from '../entities/Entity';

const PROXIMITY_RADIUS = 48;
const SWAY_STRENGTH = 0.06;
const SWAY_RETURN_SPEED = 3;

const MOTH_COUNT = 6;
const MOTH_TEX_SIZE = 8;
const MOTH_ORBIT_MIN = 0.6;
const MOTH_ORBIT_MAX = 1.05;
const MOTH_SPEED_MIN = 1.2;
const MOTH_SPEED_MAX = 2.8;
const MOTH_WOBBLE = 0.15;

interface SwayTarget {
  sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
  baseScaleX: number;
  baseScaleY: number;
  baseAngle: number;
  currentSway: number;
}

interface Moth {
  sprite: Phaser.GameObjects.Image;
  angle: number;
  orbitFactor: number;
  speed: number;
  wobblePhase: number;
}

/**
 * World reactivity: dust reacts to light cone, props sway on proximity,
 * moths orbit the lamp edge, walls flicker with the lamp.
 */
export class WorldReactivitySystem {
  private swayTargets: SwayTarget[] = [];
  private moths: Moth[] = [];
  private dustEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private dustTimer: Phaser.Time.TimerEvent | null = null;

  private wallGroup: Phaser.Physics.Arcade.StaticGroup | null = null;

  constructor(
    private scene: Phaser.Scene,
    private player: Entity,
    private isCave: boolean,
  ) {}

  setWallGroup(wallGroup: Phaser.Physics.Arcade.StaticGroup | null): void {
    this.wallGroup = wallGroup;
  }

  create(): void {
    if (!this.isCave) return;
    this.createLightDust();
    this.createMoths();
  }

  registerProp(sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite): void {
    this.swayTargets.push({
      sprite,
      baseScaleX: sprite.scaleX,
      baseScaleY: sprite.scaleY,
      baseAngle: sprite.angle,
      currentSway: 0,
    });
  }

  update(lampX: number, lampY: number, lampAngle: number, lampRadius: number): void {
    if (!this.isCave) return;
    const dt = this.scene.game.loop.delta / 1000;

    this.updateProximitySway(dt);
    this.updateMoths(lampX, lampY, lampAngle, lampRadius, dt);
    this.updateWallFlicker(lampX, lampY, lampRadius);
    this.updateDustTowardLight(lampX, lampY, lampAngle, lampRadius);
  }

  // -- Dust particles that drift into the light cone --

  private createLightDust(): void {
    const tex = this.getOrCreateDustTexture();
    this.dustEmitter = this.scene.add.particles(0, 0, tex, {
      lifespan: { min: 3000, max: 6000 },
      speed: { min: 1, max: 5 },
      scale: { start: 0.35, end: 0.0 },
      alpha: { start: 0.0, end: 0 },
      frequency: -1,
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    this.dustEmitter.setDepth(801);

    this.dustTimer = this.scene.time.addEvent({
      delay: 120,
      loop: true,
      callback: () => this.emitLightDust(),
    });
  }

  private emitLightDust(): void {
    if (!this.dustEmitter) return;
    const cam = this.scene.cameras.main;
    const spread = Math.max(cam.width, cam.height) / (2 * cam.zoom);
    const cx = cam.scrollX + cam.width / (2 * cam.zoom);
    const cy = cam.scrollY + cam.height / (2 * cam.zoom);
    const x = cx + (Math.random() - 0.5) * spread * 2;
    const y = cy + (Math.random() - 0.5) * spread * 2;
    this.dustEmitter.emitParticleAt(x, y, 1);
  }

  private updateDustTowardLight(
    lampX: number,
    lampY: number,
    lampAngle: number,
    lampRadius: number,
  ): void {
    if (!this.dustEmitter) return;

    const halfAngle = (55 * Math.PI) / 180;

    this.dustEmitter.forEachAlive((p: Phaser.GameObjects.Particles.Particle) => {
      const dx = p.x - lampX;
      const dy = p.y - lampY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 1) return;

      const angleToPart = Math.atan2(dy, dx);
      let angleDiff = angleToPart - lampAngle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      const inCone = Math.abs(angleDiff) < halfAngle && dist < lampRadius;

      if (inCone) {
        const proximity = 1 - dist / lampRadius;
        const coneCenter = Math.max(0, 1 - Math.abs(angleDiff) / halfAngle);
        p.alpha = 0.15 + proximity * coneCenter * 0.45;
        p.scaleX = 0.2 + proximity * coneCenter * 0.4;
        p.scaleY = p.scaleX;
      } else {
        p.alpha = Math.max(p.alpha - 0.01, 0.02);
        const driftX = (lampX - p.x) * 0.0003;
        const driftY = (lampY - p.y) * 0.0003;
        p.velocityX += driftX;
        p.velocityY += driftY;
      }
    }, this);
  }

  // -- Props sway when player is nearby --

  private updateProximitySway(dt: number): void {
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    const body = this.player.sprite.body as Phaser.Physics.Arcade.Body | null;
    const playerSpeed = body
      ? Math.sqrt(body.velocity.x * body.velocity.x + body.velocity.y * body.velocity.y)
      : 0;

    for (const target of this.swayTargets) {
      if (!target.sprite.active) continue;

      const dx = target.sprite.x - px;
      const dy = target.sprite.y - py;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < PROXIMITY_RADIUS && playerSpeed > 5) {
        const proximity = 1 - dist / PROXIMITY_RADIUS;
        const pushDir = Math.atan2(dy, dx);
        const swayAmount = proximity * SWAY_STRENGTH * Math.min(playerSpeed / 80, 1);

        target.currentSway = Phaser.Math.Linear(target.currentSway, swayAmount, 0.15);

        const angleSway = Math.sin(pushDir) * target.currentSway * 8;
        const scaleXSway = 1 + Math.cos(pushDir) * target.currentSway * 0.3;
        const scaleYSway = 1 - Math.cos(pushDir) * target.currentSway * 0.15;

        target.sprite.setAngle(target.baseAngle + angleSway);
        target.sprite.setScale(target.baseScaleX * scaleXSway, target.baseScaleY * scaleYSway);
      } else {
        target.currentSway = Phaser.Math.Linear(target.currentSway, 0, SWAY_RETURN_SPEED * dt);
        if (target.currentSway < 0.001) {
          target.sprite.setAngle(target.baseAngle);
          target.sprite.setScale(target.baseScaleX, target.baseScaleY);
        } else {
          const decay = target.currentSway;
          target.sprite.setAngle(
            target.baseAngle + Math.sin(this.scene.time.now * 0.008) * decay * 4,
          );
          target.sprite.setScale(
            target.baseScaleX * (1 + Math.sin(this.scene.time.now * 0.006) * decay * 0.15),
            target.baseScaleY,
          );
        }
      }
    }
  }

  // -- Moths orbiting at the edge of the light cone --

  private createMoths(): void {
    const tex = this.getOrCreateMothTexture();
    for (let i = 0; i < MOTH_COUNT; i++) {
      const sprite = this.scene.add.image(0, 0, tex);
      sprite.setBlendMode(Phaser.BlendModes.ADD);
      sprite.setDepth(801);
      sprite.setAlpha(0);
      sprite.setScale(0.5 + Math.random() * 0.5);

      this.moths.push({
        sprite,
        angle: Math.random() * Math.PI * 2,
        orbitFactor: MOTH_ORBIT_MIN + Math.random() * (MOTH_ORBIT_MAX - MOTH_ORBIT_MIN),
        speed: MOTH_SPEED_MIN + Math.random() * (MOTH_SPEED_MAX - MOTH_SPEED_MIN),
        wobblePhase: Math.random() * Math.PI * 2,
      });
    }
  }

  private updateMoths(
    lampX: number,
    lampY: number,
    lampAngle: number,
    lampRadius: number,
    dt: number,
  ): void {
    if (lampRadius <= 0) {
      for (const moth of this.moths) moth.sprite.setAlpha(0);
      return;
    }

    const t = this.scene.time.now * 0.001;

    for (const moth of this.moths) {
      moth.angle += moth.speed * dt;
      moth.wobblePhase += dt * 3;

      const orbitR = lampRadius * moth.orbitFactor;
      const wobble = Math.sin(moth.wobblePhase) * lampRadius * MOTH_WOBBLE;
      const r = orbitR + wobble;

      const coneForwardX = Math.cos(lampAngle);
      const coneForwardY = Math.sin(lampAngle);
      const coneCenterX = lampX + coneForwardX * r * 0.4;
      const coneCenterY = lampY + coneForwardY * r * 0.4;

      const mx = coneCenterX + Math.cos(moth.angle) * r;
      const my = coneCenterY + Math.sin(moth.angle) * r;

      moth.sprite.setPosition(mx, my);

      const distToLamp = Math.sqrt((mx - lampX) * (mx - lampX) + (my - lampY) * (my - lampY));
      const edgeDist = Math.abs(distToLamp - lampRadius);
      const edgeFade = Math.max(0, 1 - edgeDist / (lampRadius * 0.4));

      moth.sprite.setAlpha(edgeFade * (0.15 + Math.sin(t + moth.wobblePhase) * 0.08));
      moth.sprite.setScale(0.4 + edgeFade * 0.3);
    }
  }

  // -- Wall tiles flicker with lamp --

  private updateWallFlicker(lampX: number, lampY: number, lampRadius: number): void {
    if (lampRadius <= 0) return;

    if (!this.wallGroup) return;
    const wallGroup = this.wallGroup;

    const children = wallGroup.getChildren() as Phaser.GameObjects.Image[];
    const t = this.scene.time.now;
    const flicker = Math.sin(t * 0.003) * 0.5 + Math.sin(t * 0.011) * 0.3;
    const flickerNorm = (flicker + 0.8) / 1.6; // normalize to ~0.0 - 1.0

    for (const tile of children) {
      const dx = tile.x - lampX;
      const dy = tile.y - lampY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > lampRadius * 1.5) continue;

      const proximity = Math.max(0, 1 - dist / (lampRadius * 1.2));
      const tintShift = Math.floor(proximity * flickerNorm * 25);

      const baseR = 0x3a;
      const baseG = 0x3a;
      const baseB = 0x4a;

      const r = Math.min(255, baseR + tintShift * 2);
      const g = Math.min(255, baseG + tintShift);
      const b = Math.min(255, baseB + tintShift);

      tile.setTint((r << 16) | (g << 8) | b);
    }
  }

  // -- Textures --

  private getOrCreateDustTexture(): string {
    const key = '__react_dust';
    if (this.scene.textures.exists(key)) return key;

    const size = 16;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d')!;
    const half = size / 2;
    const g = ctx.createRadialGradient(half, half, 0, half, half, half);
    g.addColorStop(0, 'rgba(255,240,200,0.9)');
    g.addColorStop(0.3, 'rgba(255,220,160,0.4)');
    g.addColorStop(1, 'rgba(255,200,100,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    this.scene.textures.addCanvas(key, c);
    return key;
  }

  private getOrCreateMothTexture(): string {
    const key = '__moth';
    if (this.scene.textures.exists(key)) return key;

    const S = MOTH_TEX_SIZE;
    const c = document.createElement('canvas');
    c.width = S;
    c.height = S;
    const ctx = c.getContext('2d')!;
    const half = S / 2;
    const g = ctx.createRadialGradient(half, half, 0, half, half, half);
    g.addColorStop(0, 'rgba(255,240,220,0.8)');
    g.addColorStop(0.5, 'rgba(255,220,180,0.3)');
    g.addColorStop(1, 'rgba(255,200,150,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    this.scene.textures.addCanvas(key, c);
    return key;
  }

  destroy(): void {
    this.dustTimer?.destroy();
    for (const moth of this.moths) moth.sprite.destroy();
    this.moths.length = 0;
    this.swayTargets.length = 0;
  }
}
