import { Entity } from '../entities/Entity';
import { EntityFactory } from '../entities/EntityFactory';
import { Movement } from '../entities/components/Movement';
import { MovementSystem } from '../systems/MovementSystem';
import { PickupSystem } from '../systems/PickupSystem';
import { LampSystem } from '../systems/LampSystem';
import { InputMap } from '../input/InputMap';
import { SceneDirector } from './SceneDirector';
import { eventBus } from '../core/EventBus';
import { registry } from '../core/ContentRegistry';
import { configManager } from '../core/ConfigManager';
import type { StatSheet } from '../stats/StatSheet';
import type { SceneDef } from '../schemas/scene.schema';

interface ExitZone {
  sprite: Phaser.Physics.Arcade.Sprite;
  label: Phaser.GameObjects.Text;
  to: string;
  displayLabel: string;
}

/**
 * ONE generic GameScene configured by a SceneDef.
 * No HomeScene.ts, no Cave1Scene.ts — just data-driven setup.
 */
export class GameScene extends Phaser.Scene {
  private player!: Entity;
  private movementSystem!: MovementSystem;
  private pickupSystem!: PickupSystem;
  private lampSystem!: LampSystem;
  private inputMap!: InputMap;
  private director!: SceneDirector;
  private sceneDefId = 'core:home';
  private sceneDef: SceneDef | undefined;
  private wallLayer: Phaser.Tilemaps.TilemapLayer | null = null;
  private unsubConfig: (() => void) | null = null;
  private unsubFuel: (() => void) | null = null;
  private displayedRadius = 120;
  private darknessRT!: Phaser.GameObjects.RenderTexture;
  private visionImage!: Phaser.GameObjects.Image;
  private warmGlow!: Phaser.GameObjects.Sprite;

  private exitZones: ExitZone[] = [];
  private activeExit: ExitZone | null = null;
  private promptText!: Phaser.GameObjects.Text;

  private isCave = false;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: { sceneId?: string }) {
    this.sceneDefId = data.sceneId ?? 'core:home';
  }

  create() {
    this.movementSystem = new MovementSystem();
    this.pickupSystem = new PickupSystem(registry, eventBus);
    this.lampSystem = new LampSystem(eventBus, configManager);
    this.inputMap = new InputMap(this);
    this.director = new SceneDirector(registry, eventBus);

    this.sceneDef = registry.get('scene', this.sceneDefId);
    this.isCave = this.sceneDef?.kind === 'cave';

    this.exitZones = [];
    this.activeExit = null;

    if (this.sceneDef?.generation.method === 'tilemap') {
      this.buildTilemap(this.sceneDef);
    } else {
      this.buildFallbackRoom();
    }

    this.spawnPlayer(this.sceneDef);

    if (this.isCave) {
      this.spawnGroundItems();
      this.spawnFuelItems();
    }

    this.setupCollisions();

    if (this.isCave) {
      this.createLampLight();
      this.displayedRadius = configManager.get<number>('lamp', 'glowRadiusMax');

      this.unsubFuel = eventBus.on('item:picked_up', ({ itemId }) => {
        const def = registry.get('item', itemId);
        if (def && def.tags.includes('fuel')) {
          const fuelAmount = configManager.get<number>('lamp', 'fuelPerPickup');
          this.lampSystem.addFuel(fuelAmount);
        }
      });

      eventBus.on('lamp:extinguished', () => {
        this.handleLampOut();
      });
    }

    this.spawnExitZones();
    this.createPromptText();

    this.applyCameraConfig();
    this.applyPlayerConfig();
    this.applyAudioConfig();

    this.unsubConfig = configManager.onChange((sectionId) => {
      if (sectionId === 'camera') this.applyCameraConfig();
      if (sectionId === 'player') this.applyPlayerConfig();
      if (sectionId === 'audio') this.applyAudioConfig();
    });

    if (!this.scene.isActive('UIScene')) {
      this.scene.launch('UIScene', { sceneId: this.sceneDefId });
    }

    eventBus.emit('scene:enter', { sceneId: this.sceneDefId });
  }

  update(_time: number, delta: number) {
    const dt = delta / 1000;

    if (this.isCave) {
      this.lampSystem.update(dt);
    }

    const move = this.inputMap.getMoveVector();
    this.movementSystem.update(this.player, move.x, move.y, dt);
    this.pickupSystem.update(this.player);

    if (this.isCave) {
      this.updateLampLight();
    }

    this.checkExitOverlap();

    if (this.activeExit && this.inputMap.justPressed('interact')) {
      this.enterExit(this.activeExit);
    }
  }

  shutdown() {
    this.unsubConfig?.();
    this.unsubFuel?.();
  }

  private spawnExitZones(): void {
    const exits = this.sceneDef?.exits ?? [];
    for (const exit of exits) {
      const pos = exit.position ?? { x: 320, y: 32 };
      const displayLabel = exit.label ?? exit.to;

      const zoneSprite = this.physics.add.sprite(pos.x, pos.y, '__placeholder');
      zoneSprite.setDisplaySize(48, 48);
      zoneSprite.setAlpha(0.6);
      zoneSprite.setTint(0x44aaff);
      zoneSprite.setDepth(5);
      const body = zoneSprite.body as Phaser.Physics.Arcade.Body;
      body.setImmovable(true);
      body.setAllowGravity(false);

      const label = this.add.text(pos.x, pos.y - 36, displayLabel, {
        fontFamily: '"Courier New", monospace',
        fontSize: '18px',
        color: '#88ccff',
        stroke: '#000000',
        strokeThickness: 3,
        align: 'center',
      });
      label.setOrigin(0.5, 0.5);
      label.setDepth(10);

      this.exitZones.push({ sprite: zoneSprite, label, to: exit.to, displayLabel });
    }
  }

  private createPromptText(): void {
    const cam = this.cameras.main;
    this.promptText = this.add.text(cam.width / 2, cam.height - 60, '', {
      fontFamily: '"Courier New", monospace',
      fontSize: '24px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
    });
    this.promptText.setOrigin(0.5, 0.5);
    this.promptText.setScrollFactor(0);
    this.promptText.setDepth(900);
    this.promptText.setVisible(false);
  }

  private checkExitOverlap(): void {
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    const threshold = 50;

    let nearest: ExitZone | null = null;
    let nearestDist = Infinity;

    for (const zone of this.exitZones) {
      const dx = px - zone.sprite.x;
      const dy = py - zone.sprite.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < threshold && dist < nearestDist) {
        nearest = zone;
        nearestDist = dist;
      }
    }

    if (nearest && nearest !== this.activeExit) {
      this.activeExit = nearest;
      this.promptText.setText(`[E] Enter ${nearest.displayLabel}`);
      this.promptText.setVisible(true);
      eventBus.emit('exit:nearby', { exitTo: nearest.to, label: nearest.displayLabel });
    } else if (!nearest && this.activeExit) {
      this.activeExit = null;
      this.promptText.setVisible(false);
      eventBus.emit('exit:left', {});
    }
  }

  private enterExit(exit: ExitZone): void {
    this.cameras.main.fade(500, 0, 0, 0, false, (_cam: unknown, progress: number) => {
      if (progress >= 1) {
        this.director.transitionTo(exit.to, this);
      }
    });
  }

  private buildTilemap(sceneDef: SceneDef): void {
    const gen = sceneDef.generation;
    if (gen.method !== 'tilemap') return;

    const mapKey = gen.map;

    if (!this.cache.tilemap.has(mapKey)) {
      this.buildFallbackRoom();
      return;
    }

    const map = this.make.tilemap({ key: mapKey });
    const tilesetKey = sceneDef.tileset ?? 'tileset';
    const tileset = map.addTilesetImage('tileset', tilesetKey);

    if (!tileset) {
      console.error(`Tileset "${tilesetKey}" not found in map`);
      this.buildFallbackRoom();
      return;
    }

    const ground = map.createLayer('ground', tileset);
    if (ground) {
      ground.setDepth(0);
    }

    const walls = map.createLayer('walls', tileset);
    if (walls) {
      walls.setCollisionByProperty({ collides: true });
      walls.setDepth(1);
      this.wallLayer = walls;
    }

    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
  }

  private buildFallbackRoom(): void {
    const width = 640;
    const height = 480;
    const wallThickness = 16;
    const tileSize = 16;

    const gfx = this.add.graphics();

    const isHome = !this.isCave;
    const wallDark = isHome ? 0x3a4a3a : 0x3a3a4a;
    const wallLight = isHome ? 0x334433 : 0x333344;
    const floorDark = isHome ? 0x2a3a2a : 0x2a2a2a;
    const floorLight = isHome ? 0x253525 : 0x252525;

    for (let ty = 0; ty < height; ty += tileSize) {
      for (let tx = 0; tx < width; tx += tileSize) {
        const isWall =
          tx < wallThickness ||
          tx >= width - wallThickness ||
          ty < wallThickness ||
          ty >= height - wallThickness;

        if (isWall) {
          const shade = ((tx + ty) / tileSize) % 2 === 0 ? wallDark : wallLight;
          gfx.fillStyle(shade, 1);
        } else {
          const shade = ((tx + ty) / tileSize) % 2 === 0 ? floorDark : floorLight;
          gfx.fillStyle(shade, 1);
        }
        gfx.fillRect(tx, ty, tileSize, tileSize);
      }
    }

    gfx.setDepth(-1);

    this.physics.world.setBounds(
      wallThickness,
      wallThickness,
      width - wallThickness * 2,
      height - wallThickness * 2,
    );
  }

  private spawnPlayer(sceneDef: SceneDef | undefined): void {
    const playerDef = registry.getOrThrow('entity', 'core:player');
    const spawnX = sceneDef?.playerSpawn?.x ?? 320;
    const spawnY = sceneDef?.playerSpawn?.y ?? 240;

    this.player = EntityFactory.create(this, playerDef, spawnX, spawnY);
    this.player.setComponent('playerControlled', true);

    const body = this.player.sprite.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(true);

    const radiusPct = configManager.get<number>('player', 'bodyRadiusPercent');
    body.setCircle(
      Math.min(this.player.sprite.width, this.player.sprite.height) * radiusPct,
      this.player.sprite.width * ((1 - radiusPct * 2) / 2),
      this.player.sprite.height * ((1 - radiusPct * 2) / 2),
    );

    this.cameras.main.startFollow(this.player.sprite, false, 0.1, 0.1);
  }

  private applyCameraConfig(): void {
    const cam = this.cameras.main;
    cam.setZoom(configManager.get<number>('camera', 'zoom'));
    cam.setLerp(
      configManager.get<number>('camera', 'lerpX'),
      configManager.get<number>('camera', 'lerpY'),
    );
    cam.roundPixels = configManager.get<boolean>('camera', 'roundPixels');

    const dzW = configManager.get<number>('camera', 'deadzoneWidth');
    const dzH = configManager.get<number>('camera', 'deadzoneHeight');
    if (dzW > 0 || dzH > 0) {
      cam.setDeadzone(dzW, dzH);
    } else {
      cam.setDeadzone(undefined as unknown as number, undefined as unknown as number);
    }
  }

  private applyPlayerConfig(): void {
    if (!this.player) return;

    const scale = configManager.get<number>('player', 'scale');
    this.player.sprite.setScale(scale);

    const movement = this.player.getComponent<Movement>('movement');
    if (movement) {
      movement.maxSpeed = configManager.get<number>('player', 'maxSpeed');
      movement.acceleration = configManager.get<number>('player', 'acceleration');
      movement.friction = configManager.get<number>('player', 'friction');
    }

    const stats = this.player.getComponent<StatSheet>('stats');
    if (stats) {
      stats.setBase('moveSpeed', configManager.get<number>('player', 'maxSpeed'));
      stats.setBase('pickupRadius', configManager.get<number>('player', 'pickupRadius'));
    }

    const body = this.player.sprite.body as Phaser.Physics.Arcade.Body;
    if (body) {
      const radiusPct = configManager.get<number>('player', 'bodyRadiusPercent');
      const w = this.player.sprite.width * scale;
      const h = this.player.sprite.height * scale;
      body.setCircle(
        Math.min(w, h) * radiusPct,
        w * ((1 - radiusPct * 2) / 2),
        h * ((1 - radiusPct * 2) / 2),
      );
    }
  }

  private applyAudioConfig(): void {
    if (this.sound) {
      this.sound.volume = configManager.get<number>('audio', 'masterVolume');
      this.sound.mute = configManager.get<boolean>('audio', 'mute');
    }
  }

  private spawnGroundItems(): void {
    const trashItems = registry.getByTag('item', 'trash');
    if (trashItems.length === 0) return;

    const bounds = this.physics.world.bounds;
    const margin = 32;
    const count = 12;

    for (let i = 0; i < count; i++) {
      const itemDef = trashItems[i % trashItems.length];
      const x = Phaser.Math.Between(bounds.x + margin, bounds.right - margin);
      const y = Phaser.Math.Between(bounds.y + margin, bounds.bottom - margin);

      const textureKey =
        itemDef.sprite !== 'placeholder' && this.textures.exists(itemDef.sprite)
          ? itemDef.sprite
          : '__placeholder';

      const sprite = this.physics.add.sprite(x, y, textureKey);
      sprite.setDepth(2);
      const itemBody = sprite.body as Phaser.Physics.Arcade.Body;
      itemBody.setImmovable(true);
      itemBody.setAllowGravity(false);

      this.pickupSystem.addGroundItem(sprite, itemDef.id, 1);
    }
  }

  private spawnFuelItems(): void {
    const fuelItems = registry.getByTag('item', 'fuel');
    if (fuelItems.length === 0) return;

    const bounds = this.physics.world.bounds;
    const margin = 32;
    const count = 6;

    for (let i = 0; i < count; i++) {
      const itemDef = fuelItems[i % fuelItems.length];
      const x = Phaser.Math.Between(bounds.x + margin, bounds.right - margin);
      const y = Phaser.Math.Between(bounds.y + margin, bounds.bottom - margin);

      const textureKey =
        itemDef.sprite !== 'placeholder' && this.textures.exists(itemDef.sprite)
          ? itemDef.sprite
          : '__placeholder';

      const sprite = this.physics.add.sprite(x, y, textureKey);
      sprite.setDepth(2);
      const itemBody = sprite.body as Phaser.Physics.Arcade.Body;
      itemBody.setImmovable(true);
      itemBody.setAllowGravity(false);

      this.pickupSystem.addGroundItem(sprite, itemDef.id, 1);
    }
  }

  private static readonly VISION_TEX_SIZE = 256;
  private static readonly GLOW_TEX_SIZE = 256;

  private createLampLight(): void {
    const VS = GameScene.VISION_TEX_SIZE;
    const GS = GameScene.GLOW_TEX_SIZE;

    if (!this.textures.exists('__vision')) {
      const c = document.createElement('canvas');
      c.width = VS;
      c.height = VS;
      const ctx = c.getContext('2d')!;
      const half = VS / 2;
      const g = ctx.createRadialGradient(half, half, 0, half, half, half);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.4, 'rgba(255,255,255,1)');
      g.addColorStop(0.7, 'rgba(255,255,255,0.5)');
      g.addColorStop(0.85, 'rgba(255,255,255,0.15)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, VS, VS);
      this.textures.addCanvas('__vision', c);
    }

    if (!this.textures.exists('__lamp_glow')) {
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
      this.textures.addCanvas('__lamp_glow', c);
    }

    const cam = this.cameras.main;
    const margin = Math.max(cam.width, cam.height);
    const wb = this.physics.world.bounds;
    const rtX = wb.x - margin;
    const rtY = wb.y - margin;
    const rtW = wb.width + margin * 2;
    const rtH = wb.height + margin * 2;
    this.darknessRT = this.add.renderTexture(rtX, rtY, rtW, rtH);
    this.darknessRT.setOrigin(0, 0);
    this.darknessRT.fill(0x000000, 1);
    this.darknessRT.setDepth(800);

    this.visionImage = this.make.image({
      x: this.player.sprite.x,
      y: this.player.sprite.y,
      key: '__vision',
      add: false,
    });

    const mask = new Phaser.Display.Masks.BitmapMask(this, this.visionImage);
    mask.invertAlpha = true;
    this.darknessRT.setMask(mask);

    this.warmGlow = this.add.sprite(0, 0, '__lamp_glow');
    this.warmGlow.setBlendMode(Phaser.BlendModes.ADD);
    this.warmGlow.setDepth(799);
    this.warmGlow.setOrigin(0.5, 0.5);
  }

  private updateLampLight(): void {
    const ratio = this.lampSystem.ratio;
    const critical = configManager.get<number>('lamp', 'criticalThreshold');
    const rMax = configManager.get<number>('lamp', 'glowRadiusMax');
    const rMin = configManager.get<number>('lamp', 'glowRadiusMin');
    const t = this.time.now;

    const curved = Math.pow(ratio, 2.5);
    let targetRadius = rMin + (rMax - rMin) * curved;

    const baseFlicker =
      Math.sin(t * 0.005) * 1.5 + Math.sin(t * 0.013) * 1.0 + Math.sin(t * 0.029) * 0.5;

    if (ratio > 0 && ratio < critical) {
      const panicFlicker =
        Math.sin(t * 0.04) * 5 + Math.sin(t * 0.071) * 3 + (Math.random() - 0.5) * 4;
      targetRadius += panicFlicker;
    } else if (ratio > 0) {
      targetRadius += baseFlicker;
    }

    if (ratio <= 0) targetRadius = 0;

    const lerpSpeed = ratio < 0.33 ? 0.25 : 0.12;
    this.displayedRadius = Phaser.Math.Linear(this.displayedRadius, targetRadius, lerpSpeed);

    this.visionImage.setPosition(this.player.sprite.x, this.player.sprite.y);

    const visionScale = this.displayedRadius / (GameScene.VISION_TEX_SIZE * 0.5 * 0.4);
    this.visionImage.setScale(Math.max(visionScale, 0.01));

    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    this.warmGlow.setPosition(px, py);
    const glowAlphaFlicker = 0.7 + Math.sin(t * 0.006) * 0.1 + Math.sin(t * 0.017) * 0.08;
    const glowScale = this.displayedRadius / (GameScene.GLOW_TEX_SIZE * 0.25);
    this.warmGlow.setScale(Math.max(glowScale, 0.01));
    this.warmGlow.setAlpha(ratio > 0 ? glowAlphaFlicker : 0);
  }

  private handleLampOut(): void {
    this.cameras.main.fade(1500, 0, 0, 0, false, (_cam: unknown, progress: number) => {
      if (progress >= 1) {
        this.lampSystem.reset();
        this.director.returnHome(this);
      }
    });
  }

  private setupCollisions(): void {
    if (this.wallLayer && this.player) {
      this.physics.add.collider(this.player.sprite, this.wallLayer);
    }
  }
}
