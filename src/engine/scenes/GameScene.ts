import PhaserRaycaster from 'phaser-raycaster';
import { Entity } from '../entities/Entity';
import { EntityFactory } from '../entities/EntityFactory';
import { Movement } from '../entities/components/Movement';
import { MovementSystem } from '../systems/MovementSystem';
import { AnimationSystem } from '../systems/AnimationSystem';
import { PickupSystem } from '../systems/PickupSystem';
import { LampSystem } from '../systems/LampSystem';
import { SoundSystem } from '../systems/SoundSystem';
import { InputMap } from '../input/InputMap';
import { SceneDirector } from './SceneDirector';
import { eventBus } from '../core/EventBus';
import { registry } from '../core/ContentRegistry';
import { configManager } from '../core/ConfigManager';
import { inventoryManager } from '../core/InventoryManager';
import type { CaveMap } from '../generation/caveGenerator';
import type { StatSheet } from '../stats/StatSheet';
import type { SceneDef } from '../schemas/scene.schema';
import { spawnFxStatues } from './spawnFxStatues';
import { ZoneManager } from './zoneManager';
import { buildSceneRoom } from './roomBuilder';
import { LampRenderer } from './lampRenderer';
import { spawnGroundItems, spawnFuelItems, spawnProceduralItems } from './itemSpawner';
import { AmbienceSystem } from '../systems/AmbienceSystem';

/**
 * ONE generic GameScene configured by a SceneDef.
 * No HomeScene.ts, no Cave1Scene.ts — just data-driven setup.
 */
export class GameScene extends Phaser.Scene {
  private player!: Entity;
  private movementSystem!: MovementSystem;
  private animationSystem!: AnimationSystem;
  private pickupSystem!: PickupSystem;
  private lampSystem!: LampSystem;
  private soundSystem!: SoundSystem;
  private inputMap!: InputMap;
  private director!: SceneDirector;
  private zoneManager!: ZoneManager;
  private lampRenderer!: LampRenderer;
  private ambienceSystem!: AmbienceSystem;

  private sceneDefId = 'core:home';
  private sceneDef: SceneDef | undefined;
  private wallLayer: Phaser.Tilemaps.TilemapLayer | null = null;
  private wallGroup: Phaser.Physics.Arcade.StaticGroup | null = null;
  private proceduralCaveMap: CaveMap | null = null;
  private proceduralEntry: { x: number; y: number } | null = null;

  private unsubConfig: (() => void) | null = null;
  private unsubFuel: (() => void) | null = null;
  private unsubInventory: (() => void) | null = null;
  private unsubShop: (() => void)[] = [];
  private shopOpen = false;
  private isCave = false;

  declare raycasterPlugin: PhaserRaycaster;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: { sceneId?: string }) {
    this.sceneDefId = data.sceneId ?? 'core:home';
  }

  create() {
    this.movementSystem = new MovementSystem();
    this.animationSystem = new AnimationSystem();
    this.pickupSystem = new PickupSystem(registry, eventBus);
    this.lampSystem = new LampSystem(eventBus, configManager);
    this.soundSystem = new SoundSystem(this, eventBus, configManager, registry);
    this.inputMap = new InputMap(this);
    this.director = new SceneDirector(registry, eventBus);

    this.sceneDef = registry.get('scene', this.sceneDefId);
    this.isCave = this.sceneDef?.kind === 'cave';
    this.shopOpen = false;

    const room = buildSceneRoom(this, this.sceneDef, this.isCave);
    this.wallLayer = room.wallLayer;
    this.wallGroup = room.wallGroup;
    this.proceduralCaveMap = room.caveMap;
    this.proceduralEntry = room.caveEntry;

    this.zoneManager = new ZoneManager(this, this.sceneDef, this.director, undefined);
    this.zoneManager.reset();

    this.spawnPlayer(this.sceneDef);
    this.zoneManager.setPlayer(this.player);

    if (this.isCave) {
      if (this.proceduralCaveMap) {
        spawnProceduralItems(this, registry, this.pickupSystem, this.proceduralCaveMap);
      } else {
        spawnGroundItems(this, registry, this.pickupSystem);
        spawnFuelItems(this, registry, this.pickupSystem);
      }
    }

    this.setupCollisions();

    if (this.sceneDef?.kind === 'demo') {
      spawnFxStatues(this);
    }

    this.zoneManager.spawnAll();

    this.lampRenderer = new LampRenderer(
      this,
      this.lampSystem,
      this.director,
      this.isCave,
      this.wallGroup,
      this.player,
    );
    this.lampRenderer.create();

    this.ambienceSystem = new AmbienceSystem(this, this.player, this.isCave);

    if (this.isCave) {
      this.unsubFuel = eventBus.on('item:picked_up', ({ itemId }) => {
        const def = registry.get('item', itemId);
        if (def && def.tags.includes('fuel')) {
          const fuelAmount = configManager.get<number>('lamp', 'fuelPerPickup');
          this.lampSystem.addFuel(fuelAmount);
        }
      });

      eventBus.on('lamp:extinguished', () => {
        this.lampRenderer.handleLampOut();
      });
    }

    this.unsubInventory = eventBus.on('item:picked_up', ({ itemId, qty }) => {
      inventoryManager.add(itemId, qty);
    });

    this.unsubShop = [
      eventBus.on('shop:opened', () => {
        this.shopOpen = true;
      }),
      eventBus.on('shop:closed', () => {
        this.shopOpen = false;
      }),
      eventBus.on('lamp:color_changed', ({ color }) => {
        this.lampRenderer.setLampColor(color);
      }),
    ];

    this.applyCameraConfig();
    this.applyPlayerConfig();
    this.applyAudioConfig();

    this.ambienceSystem.create(this.proceduralCaveMap);

    const savedColor = configManager.get<string>('lamp', 'glowColorName');
    if (savedColor && savedColor !== 'default') {
      this.lampRenderer.setLampColor(savedColor);
    }

    this.unsubConfig = configManager.onChange((sectionId, key) => {
      if (sectionId === 'camera') this.applyCameraConfig();
      if (sectionId === 'player') this.applyPlayerConfig();
      if (sectionId === 'audio') this.applyAudioConfig();
      if (sectionId === 'lamp' && key === 'glowColorName') {
        this.lampRenderer.setLampColor(configManager.get<string>('lamp', 'glowColorName'));
      }
      if (sectionId === 'lamp' && key === 'darknessAlpha') {
        this.lampRenderer.applyDarknessAlpha();
      }
    });

    if (!this.scene.isActive('UIScene')) {
      this.scene.launch('UIScene', { sceneId: this.sceneDefId });
    }

    this.input.keyboard?.on('keydown-F3', () => {
      this.physics.world.debugGraphic?.setVisible(!this.physics.world.debugGraphic?.visible);
      if (!this.physics.world.debugGraphic) {
        this.physics.world.createDebugGraphic();
      }
    });

    eventBus.emit('scene:enter', { sceneId: this.sceneDefId });
  }

  update(_time: number, delta: number) {
    const dt = delta / 1000;

    if (this.isCave) {
      this.lampSystem.update(dt);
    }

    if (!this.shopOpen) {
      const move = this.inputMap.getMoveVector();
      this.movementSystem.update(this.player, move.x, move.y, dt);
      this.animationSystem.update(this.player);
      this.pickupSystem.update(this.player);

      this.zoneManager.checkExitOverlap();
      this.zoneManager.checkInteractOverlap();

      if (this.inputMap.justPressed('interact')) {
        this.zoneManager.handleInteractPress();
      }
    }

    this.lampRenderer.update(this.zoneManager.propShadows);
    this.ambienceSystem.update();
  }

  /** Expose player stats so ShopScene can apply upgrades. */
  getPlayerStats(): StatSheet {
    const stats = this.player.getComponent<StatSheet>('stats');
    if (!stats) throw new Error('Player has no stats component');
    return stats;
  }

  shutdown() {
    this.unsubConfig?.();
    this.unsubFuel?.();
    this.unsubInventory?.();
    this.soundSystem?.destroy();
    for (const unsub of this.unsubShop) unsub();
    this.unsubShop = [];
  }

  private spawnPlayer(sceneDef: SceneDef | undefined): void {
    const playerDef = registry.getOrThrow('entity', 'core:player');
    const spawnX = this.proceduralEntry?.x ?? sceneDef?.playerSpawn?.x ?? 320;
    const spawnY = this.proceduralEntry?.y ?? sceneDef?.playerSpawn?.y ?? 240;

    this.player = EntityFactory.create(this, playerDef, spawnX, spawnY);
    this.player.setComponent('playerControlled', true);
    this.player.sprite.setDepth(10);

    this.player.sprite.preFX?.setPadding(10);
    this.player.sprite.preFX?.addShadow(2, 3, 0.1, 0.5, 0x000000, 6, 0.5);

    const body = this.player.sprite.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(true);

    const radiusPct = configManager.get<number>('player', 'bodyRadiusPercent');
    body.setCircle(
      Math.min(this.player.sprite.width, this.player.sprite.height) * radiusPct,
      this.player.sprite.width * ((1 - radiusPct * 2) / 2),
      this.player.sprite.height * ((1 - radiusPct * 2) / 2),
    );

    if (this.isStaticCamera()) {
      this.centerCameraOnRoom(sceneDef);
    } else {
      this.cameras.main.startFollow(this.player.sprite, false, 0.1, 0.1);
    }
  }

  /** Small rooms (shop, home) get a fixed camera instead of player-follow. */
  private isStaticCamera(): boolean {
    return this.sceneDef?.generation.method === 'background';
  }

  /** Centers the camera on the room so the entire background is visible. */
  private centerCameraOnRoom(sceneDef: SceneDef | undefined): void {
    const cam = this.cameras.main;
    cam.stopFollow();

    const gen = sceneDef?.generation;
    if (gen?.method === 'background' && gen.image && this.textures.exists(gen.image)) {
      const frame = this.textures.get(gen.image).getSourceImage();
      const scale = gen.scale ?? 1;
      const roomW = frame.width * scale;
      const roomH = frame.height * scale;
      cam.centerOn(roomW / 2, roomH / 2);
    }
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

    const targetHeight = configManager.get<number>('player', 'height');
    const frameHeight = this.player.sprite.height;
    const scale = targetHeight / frameHeight;
    this.player.sprite.setScale(scale);

    const maxSpeed =
      this.sceneDef?.playerMaxSpeed ?? configManager.get<number>('player', 'maxSpeed');

    const movement = this.player.getComponent<Movement>('movement');
    if (movement) {
      movement.maxSpeed = maxSpeed;
      movement.acceleration = configManager.get<number>('player', 'acceleration');
      movement.friction = configManager.get<number>('player', 'friction');
    }

    const stats = this.player.getComponent<StatSheet>('stats');
    if (stats) {
      stats.setBase('moveSpeed', maxSpeed);
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

  private setupCollisions(): void {
    if (this.wallLayer && this.player) {
      this.physics.add.collider(this.player.sprite, this.wallLayer);
    }
    if (this.wallGroup && this.player) {
      this.physics.add.collider(this.player.sprite, this.wallGroup);
    }
  }
}
