import type { Scene } from '@babylonjs/core';
import { Entity } from '../entities/Entity';
import { EntityFactory, WORLD_SCALE } from '../entities/EntityFactory';
import { Movement } from '../entities/components/Movement';
import { Animator } from '../entities/components/Animator';
import { MovementSystem } from '../systems/MovementSystem';
import { AnimationSystem } from '../systems/AnimationSystem';
import { ProceduralAnimSystem } from '../systems/ProceduralAnimSystem';
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
import { ZoneManager } from './zoneManager';
import { buildSceneRoom } from './roomBuilder';
import { LampRenderer } from './lampRenderer';
import { spawnGroundItems, spawnFuelItems, spawnProceduralItems } from './itemSpawner';
import { AmbienceSystem } from '../systems/AmbienceSystem';
import type { IsometricCamera } from '../rendering/IsometricCamera';
import { CollisionWorld } from '../rendering/CollisionWorld';
import { WallFader } from '../rendering/WallFader';

export interface GameSceneOverlays {
  openShop: () => void;
  openUpgrade: () => void;
  setPrompt: (text: string | null) => void;
  ensureHud: (sceneId: string) => void;
}

/**
 * ONE generic GameScene configured by a SceneDef.
 * Builds a Babylon scene graph from JSON — no HomeScene/CaveScene classes.
 */
export class GameScene {
  private player!: Entity;
  private movementSystem!: MovementSystem;
  private animationSystem!: AnimationSystem;
  private proceduralAnimSystem!: ProceduralAnimSystem;
  private pickupSystem!: PickupSystem;
  private lampSystem!: LampSystem;
  private soundSystem!: SoundSystem;
  private inputMap!: InputMap;
  private director!: SceneDirector;
  private zoneManager!: ZoneManager;
  private lampRenderer!: LampRenderer;
  private ambienceSystem!: AmbienceSystem;
  private collision = new CollisionWorld();
  private wallFader: WallFader | null = null;

  private sceneDefId = 'core:home';
  private sceneDef: SceneDef | undefined;
  private proceduralCaveMap: CaveMap | null = null;
  private proceduralEntry: { x: number; y: number } | null = null;
  private pixelWidth = 640;
  private pixelHeight = 480;
  private roomDisposables: { dispose: () => void }[] = [];

  private unsubConfig: (() => void) | null = null;
  private unsubFuel: (() => void) | null = null;
  private unsubInventory: (() => void) | null = null;
  private unsubShop: (() => void)[] = [];
  private shopOpen = false;
  private isCave = false;
  private alive = false;

  constructor(
    private babylonScene: Scene,
    private camera: IsometricCamera,
    private overlays: GameSceneOverlays,
    director: SceneDirector,
  ) {
    this.director = director;
  }

  /** Load / rebuild the world for a scene def id. */
  async start(sceneId: string): Promise<void> {
    this.shutdown();
    this.sceneDefId = sceneId;
    this.alive = true;

    this.movementSystem = new MovementSystem();
    this.animationSystem = new AnimationSystem(configManager);
    this.proceduralAnimSystem = new ProceduralAnimSystem(configManager);
    this.pickupSystem = new PickupSystem(registry, eventBus, configManager);
    this.lampSystem = new LampSystem(eventBus, configManager);
    this.soundSystem = new SoundSystem(this.babylonScene, eventBus, configManager, registry);
    this.inputMap = new InputMap();

    this.sceneDef = registry.get('scene', this.sceneDefId);
    this.isCave = this.sceneDef?.kind === 'cave';
    this.director.syncState(this.sceneDefId, this.isCave);
    this.camera.setCaveMode(this.isCave);
    this.shopOpen = false;

    console.log('[GameScene] Building room for:', this.sceneDefId, 'isCave:', this.isCave);
    const room = buildSceneRoom(this.babylonScene, this.sceneDef, this.isCave);
    this.proceduralCaveMap = room.caveMap;
    this.proceduralEntry = room.caveEntry;
    this.pixelWidth = room.pixelWidth;
    this.pixelHeight = room.pixelHeight;
    this.roomDisposables = room.disposables;
    this.collision.setWalls(room.walls);
    this.collision.setBounds(0, room.pixelWidth * WORLD_SCALE, 0, room.pixelHeight * WORLD_SCALE);
    console.log(
      '[GameScene] Room built:',
      room.pixelWidth,
      'x',
      room.pixelHeight,
      'walls:',
      room.walls.length,
      'meshes:',
      this.babylonScene.meshes.length,
    );

    this.zoneManager = new ZoneManager(
      this.babylonScene,
      this.sceneDef,
      this.director,
      undefined,
      this.overlays,
      this.collision,
    );
    this.zoneManager.reset();

    await this.spawnPlayer(this.sceneDef);
    console.log(
      '[GameScene] Player at:',
      this.player.x.toFixed(2),
      this.player.y.toFixed(2),
      'mesh Y:',
      this.player.mesh.position.y.toFixed(2),
    );
    this.zoneManager.setPlayer(this.player);

    const radiusPct = configManager.get<number>('player', 'bodyRadiusPercent');
    const bodyR = Math.min(this.player.displayWidth, this.player.displayHeight) * radiusPct * 0.5;
    this.movementSystem.setCollisionWorld(this.collision, Math.max(0.15, bodyR));

    if (this.isCave) {
      if (this.proceduralCaveMap) {
        spawnProceduralItems(
          this.babylonScene,
          registry,
          this.pickupSystem,
          this.proceduralCaveMap,
        );
      } else {
        spawnGroundItems(
          this.babylonScene,
          registry,
          this.pickupSystem,
          this.pixelWidth,
          this.pixelHeight,
        );
        spawnFuelItems(
          this.babylonScene,
          registry,
          this.pickupSystem,
          this.pixelWidth,
          this.pixelHeight,
        );
      }
    }

    this.zoneManager.spawnAll();

    this.lampRenderer = new LampRenderer(
      this.babylonScene,
      this.lampSystem,
      this.director,
      this.isCave,
      this.player,
      room.wallMeshes,
    );
    this.lampRenderer.create();

    this.ambienceSystem = new AmbienceSystem(this.babylonScene, this.player, this.isCave);
    this.ambienceSystem.create(this.proceduralCaveMap);

    if (room.wallMeshes.length > 0) {
      this.wallFader = new WallFader(this.babylonScene, room.wallMeshes);
    }

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

    const savedColor = configManager.get<string>('lamp', 'glowColorName');
    if (savedColor && savedColor !== 'default') {
      this.lampRenderer.setLampColor(savedColor);
    }

    this.unsubConfig = configManager.onChange((sectionId, key) => {
      if (sectionId === 'camera') this.applyCameraConfig();
      if (sectionId === 'player') this.applyPlayerConfig();
      if (sectionId === 'lamp' && key === 'glowColorName') {
        this.lampRenderer.setLampColor(configManager.get<string>('lamp', 'glowColorName'));
      }
      if (sectionId === 'lamp' && key === 'darknessAlpha') {
        this.lampRenderer.applyDarknessAlpha();
      }
    });

    this.overlays.ensureHud(this.sceneDefId);
    eventBus.emit('scene:enter', { sceneId: this.sceneDefId });
  }

  /** Per-frame update. */
  update(dt: number): void {
    if (!this.alive) return;

    if (this.isCave) {
      this.lampSystem.update(dt);
    }

    if (!this.shopOpen) {
      const raw = this.inputMap.getMoveVector();
      const move = this.camera.rotateInput(raw.x, raw.y);
      this.movementSystem.update(this.player, move.x, move.y, dt);
      this.animationSystem.update(this.player, dt);
      this.proceduralAnimSystem.update(this.player, dt);
      this.pickupSystem.update(this.player, dt);

      this.zoneManager.checkExitOverlap();
      this.zoneManager.checkInteractOverlap();

      if (this.inputMap.justPressed('interact')) {
        this.zoneManager.handleInteractPress();
      }
    }

    this.zoneManager.updateGlow(dt);
    this.lampRenderer.update(this.zoneManager.propShadows);
    this.ambienceSystem.update();
    this.wallFader?.update(this.player.x, this.player.displayHeight * 0.5, this.player.y, dt);
    this.camera.update();
    this.inputMap.endFrame();
  }

  /** Expose player stats so shop UI can apply upgrades. */
  getPlayerStats(): StatSheet {
    const stats = this.player.getComponent<StatSheet>('stats');
    if (!stats) throw new Error('Player has no stats component');
    return stats;
  }

  /** Tear down the current world. */
  shutdown(): void {
    if (!this.alive && !this.player) return;
    this.alive = false;
    this.unsubConfig?.();
    this.unsubFuel?.();
    this.unsubInventory?.();
    this.soundSystem?.destroy();
    this.inputMap?.destroy();
    this.lampRenderer?.destroy();
    this.ambienceSystem?.destroy();
    this.wallFader?.dispose();
    this.wallFader = null;
    this.pickupSystem?.clear();
    this.zoneManager?.reset();
    for (const unsub of this.unsubShop) unsub();
    this.unsubShop = [];
    for (const d of this.roomDisposables) d.dispose();
    this.roomDisposables = [];
    this.player?.destroy();
  }

  private async spawnPlayer(sceneDef: SceneDef | undefined): Promise<void> {
    const playerDef = registry.getOrThrow('entity', 'core:player');
    const spawnX = this.proceduralEntry?.x ?? sceneDef?.playerSpawn?.x ?? 320;
    const spawnY = this.proceduralEntry?.y ?? sceneDef?.playerSpawn?.y ?? 240;

    this.player = await EntityFactory.create(this.babylonScene, playerDef, spawnX, spawnY);
    this.player.setComponent('playerControlled', true);

    if (this.isStaticCamera()) {
      this.camera.centerOn(
        (this.pixelWidth * WORLD_SCALE) / 2,
        (this.pixelHeight * WORLD_SCALE) / 2,
      );
    } else {
      this.camera.follow(this.player.mesh);
    }
  }

  private isStaticCamera(): boolean {
    return this.sceneDef?.generation.method === 'background';
  }

  private applyCameraConfig(): void {
    this.camera.applyConfig();
  }

  private applyPlayerConfig(): void {
    if (!this.player) return;

    // GLB models keep their fitted scale; only tune speed/stats/collision
    if (!this.player.getComponent('modelAnim')) {
      const targetHeightPx =
        this.sceneDef?.playerHeight ?? configManager.get<number>('player', 'height');
      const worldH = targetHeightPx * WORLD_SCALE;
      const baseH = this.player.displayHeight || worldH;
      const scale = worldH / baseH;
      this.player.displayHeight = worldH;
      this.player.displayWidth = (this.player.displayWidth / baseH) * worldH;
      this.player.setScale(scale, scale);

      const animator = this.player.getComponent<Animator>('animator');
      if (animator) {
        animator.baseScaleX = scale;
        animator.baseScaleY = scale;
      }
    }

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

    const radiusPct = configManager.get<number>('player', 'bodyRadiusPercent');
    const bodyR = Math.min(this.player.displayWidth, this.player.displayHeight) * radiusPct * 0.5;
    this.movementSystem.setCollisionWorld(this.collision, Math.max(0.15, bodyR));
  }
}
