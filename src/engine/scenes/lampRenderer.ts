import PhaserRaycaster from 'phaser-raycaster';
import { configManager } from '../core/ConfigManager';
import type { Entity } from '../entities/Entity';
import type { LampSystem } from '../systems/LampSystem';
import type { PropShadow } from './zoneManager';
import type { SceneDirector } from './SceneDirector';

const GLOW_TEX_SIZE = 256;

/** Damped spring for lamp sway — reacts to player acceleration. */
interface LampSway {
  offsetX: number;
  offsetY: number;
  velX: number;
  velY: number;
}

const SWAY_STIFFNESS = 35;
const SWAY_DAMPING = 8;
const SWAY_FORCE_SCALE = 0.6;
const SWAY_MAX_OFFSET = 8;

const GLOW_COLORS: Record<string, [string, string, string, string]> = {
  default: [
    'rgba(255,200,100,0.4)',
    'rgba(255,180,80,0.25)',
    'rgba(255,150,50,0.08)',
    'rgba(255,120,30,0)',
  ],
  blue: [
    'rgba(100,180,255,0.4)',
    'rgba(80,150,255,0.25)',
    'rgba(50,120,255,0.08)',
    'rgba(30,80,255,0)',
  ],
  purple: [
    'rgba(200,100,255,0.4)',
    'rgba(170,80,255,0.25)',
    'rgba(140,50,220,0.08)',
    'rgba(100,30,180,0)',
  ],
  orange: [
    'rgba(255,140,40,0.45)',
    'rgba(255,110,20,0.3)',
    'rgba(255,80,10,0.1)',
    'rgba(200,50,0,0)',
  ],
};

/** Renders fog-of-war darkness, warm lamp glow, and prop shadows. */
export class LampRenderer {
  displayedRadius = 120;
  private fow!: Phaser.GameObjects.RenderTexture;
  private fowEraser!: Phaser.GameObjects.Sprite;
  private darknessAlpha = 0.88;
  private raycaster!: PhaserRaycaster.Raycaster;
  private ray!: PhaserRaycaster.Raycaster.Ray;
  private warmGlow!: Phaser.GameObjects.Sprite;
  private lampColor = 'default';
  private sway: LampSway = { offsetX: 0, offsetY: 0, velX: 0, velY: 0 };
  private prevPlayerX = 0;
  private prevPlayerY = 0;
  private prevVelX = 0;
  private prevVelY = 0;

  constructor(
    private readonly scene: Phaser.Scene & { raycasterPlugin: PhaserRaycaster },
    private readonly lampSystem: LampSystem,
    private readonly director: SceneDirector,
    private readonly isCave: boolean,
    private wallGroup: Phaser.Physics.Arcade.StaticGroup | null,
    private player: Entity,
  ) {}

  /** Sets the wall group used for raycast obstacles. */
  setWallGroup(wallGroup: Phaser.Physics.Arcade.StaticGroup | null): void {
    this.wallGroup = wallGroup;
  }

  private pointLight: Phaser.GameObjects.Light | null = null;

  /** Creates FOW render texture, eraser, warm glow sprite, and point light. */
  create(): void {
    const GS = GLOW_TEX_SIZE;
    const wb = this.scene.physics.world.bounds;

    this.raycaster = this.scene.raycasterPlugin.createRaycaster({
      boundingBox: new Phaser.Geom.Rectangle(wb.x, wb.y, wb.width, wb.height),
    });

    const obstacles = this.getLightObstacles();
    if (obstacles.length > 0) {
      this.raycaster.mapGameObjects(obstacles, true);
    }

    this.ray = this.raycaster.createRay({
      origin: { x: this.player.sprite.x, y: this.player.sprite.y },
      autoSlice: true,
    });

    const baseDarkness = configManager.get<number>('lamp', 'darknessAlpha');
    this.darknessAlpha = this.isCave ? baseDarkness : Math.min(baseDarkness, 0.88);

    this.fow = this.scene.add.renderTexture(wb.x, wb.y, wb.width, wb.height);
    this.fow.setOrigin(0, 0);
    this.fow.fill(0x000000, this.darknessAlpha);
    this.fow.setDepth(800);
    this.fow.setScrollFactor(1, 1);

    if (!this.scene.textures.exists('__lamp_eraser')) {
      const ES = 256;
      const c = document.createElement('canvas');
      c.width = ES;
      c.height = ES;
      const ctx = c.getContext('2d')!;
      const half = ES / 2;
      const g = ctx.createRadialGradient(half, half, 0, half, half, half);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.6, 'rgba(255,255,255,0.9)');
      g.addColorStop(0.8, 'rgba(255,255,255,0.4)');
      g.addColorStop(0.9, 'rgba(255,255,255,0.1)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, ES, ES);
      this.scene.textures.addCanvas('__lamp_eraser', c);
    }

    this.fowEraser = this.scene.make.sprite({ x: 0, y: 0, key: '__lamp_eraser', add: false });
    this.fowEraser.setOrigin(0.5, 0.5);

    if (!this.scene.textures.exists('__lamp_glow')) {
      const c = document.createElement('canvas');
      c.width = GS;
      c.height = GS;
      const ctx = c.getContext('2d')!;
      const half = GS / 2;
      const g = ctx.createRadialGradient(half, half, 0, half, half, half);
      g.addColorStop(0, 'rgba(255,200,100,0.4)');
      g.addColorStop(0.3, 'rgba(255,180,80,0.25)');
      g.addColorStop(0.6, 'rgba(255,150,50,0.08)');
      g.addColorStop(1, 'rgba(255,120,30,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, GS, GS);
      this.scene.textures.addCanvas('__lamp_glow', c);
    }

    this.warmGlow = this.scene.add.sprite(0, 0, '__lamp_glow');
    this.warmGlow.setBlendMode(Phaser.BlendModes.ADD);
    this.warmGlow.setDepth(799);
    this.warmGlow.setOrigin(0.5, 0.5);

    this.displayedRadius = configManager.get<number>('lamp', 'glowRadiusMax');

    this.setupPointLight();
  }

  /** Creates a Phaser point light for the Light2D pipeline on supported sprites. */
  private setupPointLight(): void {
    try {
      this.scene.lights.enable();
      this.scene.lights.setAmbientColor(0x222222);
      this.pointLight = this.scene.lights.addLight(
        this.player.sprite.x,
        this.player.sprite.y,
        configManager.get<number>('lamp', 'glowRadiusMax') * 1.5,
        0xffc864,
        1.5,
      );
    } catch {
      this.pointLight = null;
    }
  }

  /** Enable Light2D pipeline on a sprite so it reacts to the point light. */
  enableLightPipeline(sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite): void {
    try {
      sprite.setPipeline('Light2D');
    } catch {
      // Pipeline not available (Canvas renderer fallback)
    }
  }

  /** Updates FOW eraser, warm glow, lamp sway, and prop shadows each frame. */
  update(propShadows: PropShadow[]): void {
    const ratio = this.lampSystem.ratio;
    const critical = configManager.get<number>('lamp', 'criticalThreshold');
    const rMax = configManager.get<number>('lamp', 'glowRadiusMax');
    const rMin = configManager.get<number>('lamp', 'glowRadiusMin');
    const t = this.scene.time.now;
    const dt = this.scene.game.loop.delta / 1000;

    const curved = Math.pow(ratio, 2.5);
    let targetRadius = rMin + (rMax - rMin) * curved;

    // Subtle flicker — barely visible, just enough to feel organic
    const baseFlicker = Math.sin(t * 0.003) * 0.5 + Math.sin(t * 0.011) * 0.3;

    if (ratio > 0 && ratio < critical) {
      const panicFlicker = Math.sin(t * 0.025) * 2 + (Math.random() - 0.5) * 1.5;
      targetRadius += panicFlicker;
    } else if (ratio > 0) {
      targetRadius += baseFlicker;
    }

    if (ratio <= 0) targetRadius = 0;

    const lerpSpeed = ratio < 0.33 ? 0.25 : 0.12;
    this.displayedRadius = Phaser.Math.Linear(this.displayedRadius, targetRadius, lerpSpeed);

    const px = this.player.sprite.x;
    const py = this.player.sprite.y;

    this.updateSway(px, py, dt);

    const lampX = px + this.sway.offsetX;
    const lampY = py + this.sway.offsetY;

    const wb = this.scene.physics.world.bounds;
    this.fow.clear();
    this.fow.fill(0x000000, this.darknessAlpha);
    if (this.displayedRadius > 0) {
      const eraserScale = (this.displayedRadius * 2) / 256;
      this.fowEraser.setScale(eraserScale);
      this.fow.erase(this.fowEraser, lampX - wb.x, lampY - wb.y);
    }

    this.updatePropShadows(propShadows, lampX, lampY, this.displayedRadius);

    this.warmGlow.setPosition(lampX, lampY);
    const glowScale = this.displayedRadius / (GLOW_TEX_SIZE * 0.25);
    this.warmGlow.setScale(Math.max(glowScale, 0.01));
    this.warmGlow.setAlpha(ratio > 0 ? 0.75 : 0);

    if (this.pointLight) {
      this.pointLight.setPosition(lampX, lampY);
      this.pointLight.radius = this.displayedRadius * 1.5;
      this.pointLight.intensity = ratio > 0 ? 1.4 + Math.sin(t * 0.004) * 0.05 : 0;
    }
  }

  /** Damped spring simulation — lamp trails behind player acceleration. */
  private updateSway(px: number, py: number, dt: number): void {
    const velX = (px - this.prevPlayerX) / Math.max(dt, 0.001);
    const velY = (py - this.prevPlayerY) / Math.max(dt, 0.001);

    // React to acceleration (change in velocity), not velocity itself
    const accelX = velX - (this.prevVelX ?? 0);
    const accelY = velY - (this.prevVelY ?? 0);
    this.prevPlayerX = px;
    this.prevPlayerY = py;
    this.prevVelX = velX;
    this.prevVelY = velY;

    // Player acceleration pushes the lamp in the opposite direction
    const forceX = -accelX * SWAY_FORCE_SCALE;
    const forceY = -accelY * SWAY_FORCE_SCALE;

    // Spring pulls lamp back to center
    const springX = -SWAY_STIFFNESS * this.sway.offsetX;
    const springY = -SWAY_STIFFNESS * this.sway.offsetY;

    // Damping resists motion
    const dampX = -SWAY_DAMPING * this.sway.velX;
    const dampY = -SWAY_DAMPING * this.sway.velY;

    this.sway.velX += (springX + dampX + forceX) * dt;
    this.sway.velY += (springY + dampY + forceY) * dt;
    this.sway.offsetX += this.sway.velX * dt;
    this.sway.offsetY += this.sway.velY * dt;

    // Clamp to prevent wild swings on frame spikes
    this.sway.offsetX = Phaser.Math.Clamp(this.sway.offsetX, -SWAY_MAX_OFFSET, SWAY_MAX_OFFSET);
    this.sway.offsetY = Phaser.Math.Clamp(this.sway.offsetY, -SWAY_MAX_OFFSET, SWAY_MAX_OFFSET);
  }

  /** Changes the warm glow color and rebuilds the glow texture. */
  setLampColor(color: string): void {
    if (this.lampColor === color) return;
    this.lampColor = color;

    if (configManager.get<string>('lamp', 'glowColorName') !== color) {
      configManager.set('lamp', 'glowColorName', color);
    }

    this.rebuildGlowTexture();
    if (this.warmGlow) {
      this.warmGlow.setTexture('__lamp_glow');
    }
  }

  /** Applies darkness alpha from config (e.g. debug panel change). */
  applyDarknessAlpha(): void {
    const base = configManager.get<number>('lamp', 'darknessAlpha');
    this.darknessAlpha = this.isCave ? base : Math.min(base, 0.88);
    if (this.fow) {
      this.fow.setAlpha(this.darknessAlpha);
    }
  }

  /** Fades to black and returns home when the lamp runs out. */
  handleLampOut(): void {
    this.scene.cameras.main.fade(1500, 0, 0, 0, false, (_cam: unknown, progress: number) => {
      if (progress >= 1) {
        this.lampSystem.reset();
        this.director.returnHome(this.scene);
      }
    });
  }

  /** Gather wall bodies that should block light via raycasting. */
  private getLightObstacles(): Phaser.GameObjects.GameObject[] {
    const obstacles: Phaser.GameObjects.GameObject[] = [];

    if (this.wallGroup) {
      obstacles.push(...this.wallGroup.getChildren());
    }

    return obstacles;
  }

  private rebuildGlowTexture(): void {
    const GS = GLOW_TEX_SIZE;
    const stops = GLOW_COLORS[this.lampColor] ?? GLOW_COLORS['default'];

    if (this.scene.textures.exists('__lamp_glow')) {
      this.scene.textures.remove('__lamp_glow');
    }

    const c = document.createElement('canvas');
    c.width = GS;
    c.height = GS;
    const ctx = c.getContext('2d')!;
    const half = GS / 2;
    const g = ctx.createRadialGradient(half, half, 0, half, half, half);
    g.addColorStop(0, stops[0]);
    g.addColorStop(0.3, stops[1]);
    g.addColorStop(0.6, stops[2]);
    g.addColorStop(1, stops[3]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, GS, GS);
    this.scene.textures.addCanvas('__lamp_glow', c);
  }

  /** Projects prop shadows away from the lamp based on angle and distance. */
  private updatePropShadows(
    propShadows: PropShadow[],
    lampX: number,
    lampY: number,
    radius: number,
  ): void {
    for (const { shadow, source } of propShadows) {
      const sx = source.x;
      const sy = source.y;
      const dx = sx - lampX;
      const dy = sy - lampY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (radius <= 0 || dist > radius * 1.2) {
        shadow.setAlpha(0);
        continue;
      }

      const angle = Math.atan2(dy, dx);
      const proximity = Phaser.Math.Clamp(1 - dist / radius, 0, 1);
      const shadowLength = 0.3 + proximity * 0.5;
      const offsetDist = 8 + (1 - proximity) * 20;

      shadow.setPosition(sx + Math.cos(angle) * offsetDist, sy + Math.sin(angle) * offsetDist);

      shadow.setScale(source.scaleX * (1 + shadowLength * 0.3), source.scaleY * (1 + shadowLength));
      shadow.setAngle(source.angle);
      shadow.setAlpha(0.6 * proximity);
    }
  }
}
