import PhaserRaycaster from 'phaser-raycaster';
import { configManager } from '../core/ConfigManager';
import type { Entity } from '../entities/Entity';
import type { Animator } from '../entities/components/Animator';
import type { Movement } from '../entities/components/Movement';
import type { LampSystem } from '../systems/LampSystem';
import type { PropShadow } from './zoneManager';
import type { SceneDirector } from './SceneDirector';

const CONE_TEX_SIZE = 512;
const GLOW_TEX_SIZE = 512;
const AMBIENT_TEX_SIZE = 128;
const LAMP_POINT_TEX_SIZE = 64;
const CONE_HALF_ANGLE = (55 * Math.PI) / 180; // 110° total cone

// Backpack lamp geometry — offset from character center
const LAMP_BEHIND = 8; // px behind the character (opposite of facing)
const LAMP_SPREAD = 5; // px apart perpendicular to facing (each side)
const LAMP_POINT_RADIUS = 18; // visible radius of each backpack lamp circle

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

const ANGLE_LERP_SPEED = 8;

const GLOW_COLORS: Record<string, [string, string, string, string]> = {
  default: [
    'rgba(255,200,100,0.35)',
    'rgba(255,180,80,0.2)',
    'rgba(255,150,50,0.06)',
    'rgba(255,120,30,0)',
  ],
  blue: [
    'rgba(100,180,255,0.35)',
    'rgba(80,150,255,0.2)',
    'rgba(50,120,255,0.06)',
    'rgba(30,80,255,0)',
  ],
  purple: [
    'rgba(200,100,255,0.35)',
    'rgba(170,80,255,0.2)',
    'rgba(140,50,220,0.06)',
    'rgba(100,30,180,0)',
  ],
  orange: [
    'rgba(255,140,40,0.4)',
    'rgba(255,110,20,0.25)',
    'rgba(255,80,10,0.08)',
    'rgba(200,50,0,0)',
  ],
};

/** Draws a cone pointing right (angle 0) with soft radial falloff. */
function drawCone(
  ctx: CanvasRenderingContext2D,
  size: number,
  halfAngle: number,
  colorStops: [string, string, string, string] | null,
): void {
  const cx = size * 0.15;
  const cy = size / 2;
  const reach = size * 0.85;

  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, reach);
  if (colorStops) {
    grad.addColorStop(0, colorStops[0]);
    grad.addColorStop(0.3, colorStops[1]);
    grad.addColorStop(0.7, colorStops[2]);
    grad.addColorStop(1, colorStops[3]);
  } else {
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.7, 'rgba(255,255,255,0.5)');
    grad.addColorStop(0.85, 'rgba(255,255,255,0.15)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
  }

  ctx.save();
  ctx.filter = 'blur(8px)';
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, reach, -halfAngle, halfAngle);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();
}

/** Renders fog-of-war darkness, directional lamp cone, and prop shadows. */
export class LampRenderer {
  displayedRadius = 120;
  lampX = 0;
  lampY = 0;
  lampAngle = Math.PI / 2; // facing down initially
  private fow!: Phaser.GameObjects.RenderTexture;
  private coneEraser!: Phaser.GameObjects.Sprite;
  private ambientEraser!: Phaser.GameObjects.Sprite;
  private lampPointEraserL!: Phaser.GameObjects.Sprite;
  private lampPointEraserR!: Phaser.GameObjects.Sprite;
  private lampPointGlowL!: Phaser.GameObjects.Sprite;
  private lampPointGlowR!: Phaser.GameObjects.Sprite;
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
  private facingAngle = Math.PI / 2;
  private targetAngle = Math.PI / 2;

  constructor(
    private readonly scene: Phaser.Scene & { raycasterPlugin: PhaserRaycaster },
    private readonly lampSystem: LampSystem,
    private readonly director: SceneDirector,
    private readonly isCave: boolean,
    private wallGroup: Phaser.Physics.Arcade.StaticGroup | null,
    private player: Entity,
  ) {}

  setWallGroup(wallGroup: Phaser.Physics.Arcade.StaticGroup | null): void {
    this.wallGroup = wallGroup;
  }

  private pointLight: Phaser.GameObjects.Light | null = null;

  create(): void {
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

    this.createConeEraserTexture();
    this.createAmbientEraserTexture();
    this.createLampPointTexture();
    this.createConeGlowTexture();

    this.coneEraser = this.scene.make.sprite({
      x: 0,
      y: 0,
      key: '__cone_eraser',
      add: false,
    });
    this.coneEraser.setOrigin(0.15, 0.5);

    this.ambientEraser = this.scene.make.sprite({
      x: 0,
      y: 0,
      key: '__ambient_eraser',
      add: false,
    });
    this.ambientEraser.setOrigin(0.5, 0.5);

    this.lampPointEraserL = this.scene.make.sprite({ x: 0, y: 0, key: '__lamp_point', add: false });
    this.lampPointEraserL.setOrigin(0.5, 0.5);
    this.lampPointEraserR = this.scene.make.sprite({ x: 0, y: 0, key: '__lamp_point', add: false });
    this.lampPointEraserR.setOrigin(0.5, 0.5);

    this.lampPointGlowL = this.scene.add.sprite(0, 0, '__lamp_point');
    this.lampPointGlowL.setBlendMode(Phaser.BlendModes.ADD);
    this.lampPointGlowL.setDepth(799);
    this.lampPointGlowL.setOrigin(0.5, 0.5);
    this.lampPointGlowL.setTint(0xffc864);

    this.lampPointGlowR = this.scene.add.sprite(0, 0, '__lamp_point');
    this.lampPointGlowR.setBlendMode(Phaser.BlendModes.ADD);
    this.lampPointGlowR.setDepth(799);
    this.lampPointGlowR.setOrigin(0.5, 0.5);
    this.lampPointGlowR.setTint(0xffc864);

    this.warmGlow = this.scene.add.sprite(0, 0, '__cone_glow');
    this.warmGlow.setBlendMode(Phaser.BlendModes.ADD);
    this.warmGlow.setDepth(799);
    this.warmGlow.setOrigin(0.15, 0.5);

    this.displayedRadius = configManager.get<number>('lamp', 'glowRadiusMax');

    this.setupPointLight();
  }

  private createConeEraserTexture(): void {
    if (this.scene.textures.exists('__cone_eraser')) return;
    const S = CONE_TEX_SIZE;
    const c = document.createElement('canvas');
    c.width = S;
    c.height = S;
    const ctx = c.getContext('2d')!;
    drawCone(ctx, S, CONE_HALF_ANGLE, null);
    this.scene.textures.addCanvas('__cone_eraser', c);
  }

  private createAmbientEraserTexture(): void {
    if (this.scene.textures.exists('__ambient_eraser')) return;
    const S = AMBIENT_TEX_SIZE;
    const c = document.createElement('canvas');
    c.width = S;
    c.height = S;
    const ctx = c.getContext('2d')!;
    const half = S / 2;
    const g = ctx.createRadialGradient(half, half, 0, half, half, half);
    g.addColorStop(0, 'rgba(255,255,255,0.7)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.3)');
    g.addColorStop(0.8, 'rgba(255,255,255,0.08)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    this.scene.textures.addCanvas('__ambient_eraser', c);
  }

  private createLampPointTexture(): void {
    if (this.scene.textures.exists('__lamp_point')) return;
    const S = LAMP_POINT_TEX_SIZE;
    const c = document.createElement('canvas');
    c.width = S;
    c.height = S;
    const ctx = c.getContext('2d')!;
    const half = S / 2;
    const g = ctx.createRadialGradient(half, half, 0, half, half, half);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.8)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.4)');
    g.addColorStop(0.85, 'rgba(255,255,255,0.1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    this.scene.textures.addCanvas('__lamp_point', c);
  }

  private createConeGlowTexture(): void {
    if (this.scene.textures.exists('__cone_glow')) return;
    const S = GLOW_TEX_SIZE;
    const c = document.createElement('canvas');
    c.width = S;
    c.height = S;
    const ctx = c.getContext('2d')!;
    const stops = GLOW_COLORS[this.lampColor] ?? GLOW_COLORS['default'];
    drawCone(ctx, S, CONE_HALF_ANGLE, stops);
    this.scene.textures.addCanvas('__cone_glow', c);
  }

  private setupPointLight(): void {
    try {
      this.scene.lights.enable();
      this.scene.lights.setAmbientColor(0x222222);
      this.pointLight = this.scene.lights.addLight(
        this.player.sprite.x,
        this.player.sprite.y,
        configManager.get<number>('lamp', 'glowRadiusMax') * 0.6,
        0xffc864,
        1.2,
      );
    } catch {
      this.pointLight = null;
    }
  }

  enableLightPipeline(sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite): void {
    try {
      sprite.setPipeline('Light2D');
    } catch {
      // Pipeline not available
    }
  }

  update(propShadows: PropShadow[]): void {
    const ratio = this.lampSystem.ratio;
    const critical = configManager.get<number>('lamp', 'criticalThreshold');
    const rMax = configManager.get<number>('lamp', 'glowRadiusMax');
    const rMin = configManager.get<number>('lamp', 'glowRadiusMin');
    const t = this.scene.time.now;
    const dt = this.scene.game.loop.delta / 1000;

    const curved = Math.pow(ratio, 2.5);
    let targetRadius = rMin + (rMax - rMin) * curved;

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
    this.updateFacingAngle(dt);

    const lampX = px + this.sway.offsetX;
    const lampY = py + this.sway.offsetY;
    this.lampX = lampX;
    this.lampY = lampY;
    this.lampAngle = this.facingAngle;

    // Two backpack lamp positions — behind the character, spread perpendicular
    const backDx = -Math.cos(this.facingAngle) * LAMP_BEHIND;
    const backDy = -Math.sin(this.facingAngle) * LAMP_BEHIND;
    const perpDx = -Math.sin(this.facingAngle) * LAMP_SPREAD;
    const perpDy = Math.cos(this.facingAngle) * LAMP_SPREAD;

    const lL = { x: lampX + backDx + perpDx, y: lampY + backDy + perpDy };
    const lR = { x: lampX + backDx - perpDx, y: lampY + backDy - perpDy };
    // Cone origin — midpoint between the two lamps
    const coneOriginX = (lL.x + lR.x) / 2;
    const coneOriginY = (lL.y + lR.y) / 2;

    const wb = this.scene.physics.world.bounds;
    this.fow.clear();
    this.fow.fill(0x000000, this.darknessAlpha);

    if (this.displayedRadius > 0) {
      // Ambient backlight spill around the player
      const ambientScale = (this.displayedRadius * 0.5) / (AMBIENT_TEX_SIZE / 2);
      this.ambientEraser.setScale(ambientScale);
      this.fow.erase(this.ambientEraser, lampX - wb.x, lampY - wb.y);

      // Two lamp-point circles at the backpack positions
      const lpScale = (LAMP_POINT_RADIUS * 2) / LAMP_POINT_TEX_SIZE;
      this.lampPointEraserL.setScale(lpScale);
      this.lampPointEraserR.setScale(lpScale);
      this.fow.erase(this.lampPointEraserL, lL.x - wb.x, lL.y - wb.y);
      this.fow.erase(this.lampPointEraserR, lR.x - wb.x, lR.y - wb.y);

      // Directional cone from between the two lamps
      const coneScale = (this.displayedRadius * 2) / (CONE_TEX_SIZE * 0.85);
      this.coneEraser.setScale(coneScale);
      this.coneEraser.setRotation(this.facingAngle);
      this.fow.erase(this.coneEraser, coneOriginX - wb.x, coneOriginY - wb.y);
    }

    this.updatePropShadows(propShadows, lampX, lampY, this.displayedRadius);

    // Position warm glow cone from between the lamps
    this.warmGlow.setPosition(coneOriginX, coneOriginY);
    const glowScale = (this.displayedRadius * 2) / (GLOW_TEX_SIZE * 0.85);
    this.warmGlow.setScale(Math.max(glowScale, 0.01));
    this.warmGlow.setRotation(this.facingAngle);
    this.warmGlow.setAlpha(ratio > 0 ? 0.65 : 0);

    // Lamp point glows at backpack positions
    const lpGlowScale = (LAMP_POINT_RADIUS * 3) / LAMP_POINT_TEX_SIZE;
    this.lampPointGlowL.setPosition(lL.x, lL.y);
    this.lampPointGlowL.setScale(lpGlowScale);
    this.lampPointGlowL.setAlpha(ratio > 0 ? 0.5 : 0);
    this.lampPointGlowR.setPosition(lR.x, lR.y);
    this.lampPointGlowR.setScale(lpGlowScale);
    this.lampPointGlowR.setAlpha(ratio > 0 ? 0.5 : 0);

    if (this.pointLight) {
      const plOffset = 12;
      this.pointLight.setPosition(
        coneOriginX + Math.cos(this.facingAngle) * plOffset,
        coneOriginY + Math.sin(this.facingAngle) * plOffset,
      );
      this.pointLight.radius = this.displayedRadius * 0.6;
      this.pointLight.intensity = ratio > 0 ? 1.2 + Math.sin(t * 0.004) * 0.05 : 0;
    }
  }

  private updateFacingAngle(dt: number): void {
    const movement = this.player.getComponent<Movement>('movement');
    if (movement) {
      const speed = Math.sqrt(
        movement.velocityX * movement.velocityX + movement.velocityY * movement.velocityY,
      );
      if (speed > 4) {
        this.targetAngle = Math.atan2(movement.velocityY, movement.velocityX);
      }
    } else {
      const animator = this.player.getComponent<Animator>('animator');
      if (animator) {
        if (animator.direction === 'down') this.targetAngle = Math.PI / 2;
        else if (animator.direction === 'up') this.targetAngle = -Math.PI / 2;
        else this.targetAngle = animator.facingRight ? 0 : Math.PI;
      }
    }

    let diff = this.targetAngle - this.facingAngle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    this.facingAngle += diff * Math.min(ANGLE_LERP_SPEED * dt, 1);
  }

  private updateSway(px: number, py: number, dt: number): void {
    const velX = (px - this.prevPlayerX) / Math.max(dt, 0.001);
    const velY = (py - this.prevPlayerY) / Math.max(dt, 0.001);

    const accelX = velX - (this.prevVelX ?? 0);
    const accelY = velY - (this.prevVelY ?? 0);
    this.prevPlayerX = px;
    this.prevPlayerY = py;
    this.prevVelX = velX;
    this.prevVelY = velY;

    const forceX = -accelX * SWAY_FORCE_SCALE;
    const forceY = -accelY * SWAY_FORCE_SCALE;

    const springX = -SWAY_STIFFNESS * this.sway.offsetX;
    const springY = -SWAY_STIFFNESS * this.sway.offsetY;

    const dampX = -SWAY_DAMPING * this.sway.velX;
    const dampY = -SWAY_DAMPING * this.sway.velY;

    this.sway.velX += (springX + dampX + forceX) * dt;
    this.sway.velY += (springY + dampY + forceY) * dt;
    this.sway.offsetX += this.sway.velX * dt;
    this.sway.offsetY += this.sway.velY * dt;

    this.sway.offsetX = Phaser.Math.Clamp(this.sway.offsetX, -SWAY_MAX_OFFSET, SWAY_MAX_OFFSET);
    this.sway.offsetY = Phaser.Math.Clamp(this.sway.offsetY, -SWAY_MAX_OFFSET, SWAY_MAX_OFFSET);
  }

  setLampColor(color: string): void {
    if (this.lampColor === color) return;
    this.lampColor = color;

    if (configManager.get<string>('lamp', 'glowColorName') !== color) {
      configManager.set('lamp', 'glowColorName', color);
    }

    this.rebuildGlowTexture();
    if (this.warmGlow) {
      this.warmGlow.setTexture('__cone_glow');
    }
  }

  applyDarknessAlpha(): void {
    const base = configManager.get<number>('lamp', 'darknessAlpha');
    this.darknessAlpha = this.isCave ? base : Math.min(base, 0.88);
    if (this.fow) {
      this.fow.setAlpha(this.darknessAlpha);
    }
  }

  handleLampOut(): void {
    this.scene.cameras.main.fade(1500, 0, 0, 0, false, (_cam: unknown, progress: number) => {
      if (progress >= 1) {
        this.lampSystem.reset();
        this.director.returnHome(this.scene);
      }
    });
  }

  private getLightObstacles(): Phaser.GameObjects.GameObject[] {
    const obstacles: Phaser.GameObjects.GameObject[] = [];
    if (this.wallGroup) {
      obstacles.push(...this.wallGroup.getChildren());
    }
    return obstacles;
  }

  private rebuildGlowTexture(): void {
    const S = GLOW_TEX_SIZE;
    const stops = GLOW_COLORS[this.lampColor] ?? GLOW_COLORS['default'];

    if (this.scene.textures.exists('__cone_glow')) {
      this.scene.textures.remove('__cone_glow');
    }

    const c = document.createElement('canvas');
    c.width = S;
    c.height = S;
    const ctx = c.getContext('2d')!;
    drawCone(ctx, S, CONE_HALF_ANGLE, stops);
    this.scene.textures.addCanvas('__cone_glow', c);
  }

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
