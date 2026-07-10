import { Entity } from '../entities/Entity';
import { EntityFactory } from '../entities/EntityFactory';
import { Movement } from '../entities/components/Movement';
import { MovementSystem } from '../systems/MovementSystem';
import { PickupSystem } from '../systems/PickupSystem';
import { LampSystem } from '../systems/LampSystem';
import { InputMap } from '../input/InputMap';
import { eventBus } from '../core/EventBus';
import { registry } from '../core/ContentRegistry';
import { configManager } from '../core/ConfigManager';
import type { StatSheet } from '../stats/StatSheet';
import type { SceneDef } from '../schemas/scene.schema';

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
  private sceneDefId = 'core:home';
  private wallLayer: Phaser.Tilemaps.TilemapLayer | null = null;
  private unsubConfig: (() => void) | null = null;
  private unsubFuel: (() => void) | null = null;
  private darkness!: Phaser.GameObjects.RenderTexture;
  private lightGfx!: Phaser.GameObjects.Graphics;
  private displayedRadius = 120;

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

    const sceneDef = registry.get('scene', this.sceneDefId);

    if (sceneDef?.generation.method === 'tilemap') {
      this.buildTilemap(sceneDef);
    } else {
      this.buildFallbackRoom();
    }

    this.spawnPlayer(sceneDef);
    this.spawnGroundItems();
    this.spawnFuelItems();
    this.setupCollisions();
    this.createLighting();

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

    this.applyCameraConfig();
    this.applyPlayerConfig();
    this.applyAudioConfig();

    this.unsubConfig = configManager.onChange((sectionId) => {
      if (sectionId === 'camera') this.applyCameraConfig();
      if (sectionId === 'player') this.applyPlayerConfig();
      if (sectionId === 'audio') this.applyAudioConfig();
    });

    if (!this.scene.isActive('UIScene')) {
      this.scene.launch('UIScene');
    }

    eventBus.emit('scene:enter', { sceneId: this.sceneDefId });
  }

  update(_time: number, delta: number) {
    const dt = delta / 1000;

    this.lampSystem.update(dt);

    const move = this.inputMap.getMoveVector();
    this.movementSystem.update(this.player, move.x, move.y, dt);
    this.pickupSystem.update(this.player);

    this.updateLighting();
  }

  shutdown() {
    this.unsubConfig?.();
    this.unsubFuel?.();
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
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
  }

  private buildFallbackRoom(): void {
    const width = 640;
    const height = 480;
    const wallThickness = 16;
    const tileSize = 16;

    const gfx = this.add.graphics();

    for (let ty = 0; ty < height; ty += tileSize) {
      for (let tx = 0; tx < width; tx += tileSize) {
        const isWall =
          tx < wallThickness ||
          tx >= width - wallThickness ||
          ty < wallThickness ||
          ty >= height - wallThickness;

        if (isWall) {
          const shade = ((tx + ty) / tileSize) % 2 === 0 ? 0x3a3a4a : 0x333344;
          gfx.fillStyle(shade, 1);
        } else {
          const shade = ((tx + ty) / tileSize) % 2 === 0 ? 0x2a2a2a : 0x252525;
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
    this.cameras.main.setBounds(0, 0, width, height);
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

    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
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

  private createLighting(): void {
    const cam = this.cameras.main;
    const w = cam.width;
    const h = cam.height;

    this.darkness = this.add.renderTexture(cam.centerX, cam.centerY, w, h);
    this.darkness.setOrigin(0.5, 0.5);
    this.darkness.setScrollFactor(0);
    this.darkness.setDepth(900);
    this.darkness.setBlendMode(Phaser.BlendModes.MULTIPLY);

    this.lightGfx = new Phaser.GameObjects.Graphics(this);

    this.displayedRadius = configManager.get<number>('lamp', 'glowRadiusMax');
  }

  private updateLighting(): void {
    const ratio = this.lampSystem.ratio;
    const critical = configManager.get<number>('lamp', 'criticalThreshold');
    const rMax = configManager.get<number>('lamp', 'glowRadiusMax');
    const rMin = configManager.get<number>('lamp', 'glowRadiusMin');
    const warmth = configManager.get<number>('lamp', 'glowColor');
    const darkAlpha = configManager.get<number>('lamp', 'darknessAlpha');

    let targetRadius = rMin + (rMax - rMin) * ratio;

    if (ratio > 0 && ratio < critical) {
      const flicker = Math.sin(this.time.now * 0.012) * 4 + Math.sin(this.time.now * 0.031) * 2;
      targetRadius += flicker;
    }
    if (ratio <= 0) {
      targetRadius = 0;
    }

    this.displayedRadius = Phaser.Math.Linear(this.displayedRadius, targetRadius, 0.08);

    const cam = this.cameras.main;
    const w = cam.width;
    const h = cam.height;
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.max(0, this.displayedRadius);

    this.lightGfx.clear();

    const darkR = Math.round(darkAlpha * 255);
    const darkG = Math.round(darkAlpha * 255 * (1 - warmth * 0.15));
    const darkB = Math.round(darkAlpha * 255 * (1 - warmth * 0.3));
    const darkColor = (darkR << 16) | (darkG << 8) | darkB;

    this.lightGfx.fillStyle(darkColor, 1);
    this.lightGfx.fillRect(0, 0, w, h);

    if (r > 1) {
      const steps = 20;
      for (let i = steps; i >= 0; i--) {
        const t = i / steps;
        const stepR = r * (1 - t * 0.7);

        const falloff = 1 - t;
        const brightness = falloff * falloff;

        const lr = Math.min(255, Math.round(255 * brightness + warmth * 40 * brightness));
        const lg = Math.min(255, Math.round(255 * brightness + warmth * 20 * brightness));
        const lb = Math.round(255 * brightness * (1 - warmth * 0.3));
        const lc = (lr << 16) | (lg << 8) | lb;

        this.lightGfx.fillStyle(lc, 1);
        this.lightGfx.fillCircle(cx, cy, stepR);
      }
    }

    this.darkness.clear();
    this.darkness.draw(this.lightGfx, 0, 0);
  }

  private handleLampOut(): void {
    this.cameras.main.fade(1500, 0, 0, 0, false, (_cam: unknown, progress: number) => {
      if (progress >= 1) {
        this.lampSystem.reset();
        this.scene.restart({ sceneId: this.sceneDefId });
      }
    });
  }

  private setupCollisions(): void {
    if (this.wallLayer && this.player) {
      this.physics.add.collider(this.player.sprite, this.wallLayer);
    }
  }
}
