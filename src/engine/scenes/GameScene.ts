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
import { generateCave, type CaveMap } from '../generation/caveGenerator';
import { buildTileFloorGraphics } from '../generation/floorTileGenerator';
import type { StatSheet } from '../stats/StatSheet';
import type { SceneDef } from '../schemas/scene.schema';
import { spawnFxStatues } from './spawnFxStatues';

interface ExitZone {
  sprite: Phaser.Physics.Arcade.Sprite;
  label: Phaser.GameObjects.Text;
  tooltip: Phaser.GameObjects.Text;
  to: string;
  displayLabel: string;
}

interface InteractZone {
  sprite: Phaser.Physics.Arcade.Sprite;
  label: Phaser.GameObjects.Text;
  tooltip: Phaser.GameObjects.Text;
  displayLabel: string;
  action: string;
}

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
  private sceneDefId = 'core:home';
  private sceneDef: SceneDef | undefined;
  private wallLayer: Phaser.Tilemaps.TilemapLayer | null = null;
  private wallGroup: Phaser.Physics.Arcade.StaticGroup | null = null;
  private proceduralCaveMap: CaveMap | null = null;
  private proceduralEntry: { x: number; y: number } | null = null;
  private unsubConfig: (() => void) | null = null;
  private unsubFuel: (() => void) | null = null;
  private unsubInventory: (() => void) | null = null;
  private displayedRadius = 120;
  private darknessRT!: Phaser.GameObjects.RenderTexture;
  private visionImage!: Phaser.GameObjects.Image;
  private warmGlow!: Phaser.GameObjects.Sprite;

  private exitZones: ExitZone[] = [];
  private interactZones: InteractZone[] = [];
  private activeExit: ExitZone | null = null;
  private activeInteract: InteractZone | null = null;
  private promptText!: Phaser.GameObjects.Text;
  private shopOpen = false;
  private unsubShop: (() => void)[] = [];
  private lampColor = 'default';

  private isCave = false;

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

    this.exitZones = [];
    this.interactZones = [];
    this.activeExit = null;
    this.activeInteract = null;
    this.shopOpen = false;

    this.proceduralCaveMap = null;
    this.proceduralEntry = null;
    this.wallGroup = null;

    if (this.sceneDef?.generation.method === 'tilemap') {
      this.buildTilemap(this.sceneDef);
    } else if (this.sceneDef?.generation.method === 'background') {
      this.buildBackgroundRoom(this.sceneDef);
    } else if (this.sceneDef?.generation.method === 'rooms') {
      this.buildProceduralCave(this.sceneDef);
    } else if (this.sceneDef?.generation.method === 'tileFloor') {
      this.buildTileFloor(this.sceneDef);
    } else if (this.sceneDef?.generation.method === 'tiled') {
      const gen = this.sceneDef.generation;
      this.buildFallbackRoom(gen.width, gen.height, gen.wallThickness);
    } else {
      this.buildFallbackRoom();
    }

    this.spawnPlayer(this.sceneDef);

    if (this.isCave) {
      if (this.proceduralCaveMap) {
        this.spawnProceduralItems();
      } else {
        this.spawnGroundItems();
        this.spawnFuelItems();
      }
    }

    this.setupCollisions();

    if (this.sceneDef?.kind === 'demo') {
      spawnFxStatues(this);
    }

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
    this.spawnShopZones();
    this.spawnProps();
    this.createPromptText();

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
        this.setLampColor(color);
      }),
    ];

    this.applyCameraConfig();
    this.applyPlayerConfig();
    this.applyAudioConfig();

    if (this.isCave) {
      const savedColor = configManager.get<string>('lamp', 'glowColorName');
      if (savedColor && savedColor !== 'default') {
        this.setLampColor(savedColor);
      }
    }

    this.unsubConfig = configManager.onChange((sectionId, key) => {
      if (sectionId === 'camera') this.applyCameraConfig();
      if (sectionId === 'player') this.applyPlayerConfig();
      if (sectionId === 'audio') this.applyAudioConfig();
      if (sectionId === 'lamp' && key === 'glowColorName') {
        this.setLampColor(configManager.get<string>('lamp', 'glowColorName'));
      }
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

    if (!this.shopOpen) {
      const move = this.inputMap.getMoveVector();
      this.movementSystem.update(this.player, move.x, move.y, dt);
      this.animationSystem.update(this.player);
      this.pickupSystem.update(this.player);

      this.checkExitOverlap();
      this.checkInteractOverlap();

      if (this.activeExit && this.inputMap.justPressed('interact')) {
        this.enterExit(this.activeExit);
      } else if (this.activeInteract && this.inputMap.justPressed('interact')) {
        this.handleInteraction(this.activeInteract);
      }
    }

    if (this.isCave) {
      this.updateLampLight();
    }
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

      const tooltip = this.createZoneTooltip(pos.x, pos.y + 34);

      this.exitZones.push({ sprite: zoneSprite, label, tooltip, to: exit.to, displayLabel });
    }
  }

  private spawnShopZones(): void {
    const shops = this.sceneDef?.shops ?? [];
    for (const shop of shops) {
      const pos = shop.position;
      const displayLabel = shop.label ?? 'Shop';

      const zoneSprite = this.physics.add.sprite(pos.x, pos.y, '__placeholder');
      zoneSprite.setDisplaySize(48, 48);
      zoneSprite.setAlpha(0.6);
      zoneSprite.setTint(0xffaa44);
      zoneSprite.setDepth(5);
      const body = zoneSprite.body as Phaser.Physics.Arcade.Body;
      body.setImmovable(true);
      body.setAllowGravity(false);

      const label = this.add.text(pos.x, pos.y - 36, displayLabel, {
        fontFamily: '"Courier New", monospace',
        fontSize: '18px',
        color: '#ffcc88',
        stroke: '#000000',
        strokeThickness: 3,
        align: 'center',
      });
      label.setOrigin(0.5, 0.5);
      label.setDepth(10);

      const tooltip = this.createZoneTooltip(pos.x, pos.y + 34);

      this.interactZones.push({ sprite: zoneSprite, label, tooltip, displayLabel, action: 'shop' });
    }
  }

  /** Places static decorative props defined in the scene JSON. */
  private spawnProps(): void {
    const props = this.sceneDef?.props ?? [];
    for (const prop of props) {
      const pos = prop.position;

      if (!this.textures.exists(prop.image)) {
        console.warn(`Prop image "${prop.image}" not found, skipping`);
        continue;
      }

      if (prop.collides) {
        const sprite = this.physics.add.staticImage(pos.x, pos.y, prop.image);
        sprite.setScale(prop.scale);
        sprite.setAngle(prop.angle);
        sprite.setDepth(prop.depth);
        sprite.refreshBody();
        if (this.player) {
          this.physics.add.collider(this.player.sprite, sprite);
        }
      } else {
        const img = this.add.image(pos.x, pos.y, prop.image);
        img.setScale(prop.scale);
        img.setAngle(prop.angle);
        img.setDepth(prop.depth);
      }
    }
  }

  private createZoneTooltip(x: number, y: number): Phaser.GameObjects.Text {
    const tip = this.add.text(x, y, 'Press E', {
      fontFamily: '"Courier New", monospace',
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 6, y: 3 },
      stroke: '#000000',
      strokeThickness: 2,
    });
    tip.setOrigin(0.5, 0);
    tip.setDepth(11);
    tip.setVisible(false);
    return tip;
  }

  private showTooltip(tooltip: Phaser.GameObjects.Text): void {
    if (tooltip.visible) return;
    tooltip.setVisible(true);
    tooltip.setAlpha(0);
    this.tweens.add({ targets: tooltip, alpha: 1, duration: 150 });
  }

  private hideTooltip(tooltip: Phaser.GameObjects.Text): void {
    if (!tooltip.visible) return;
    this.tweens.add({
      targets: tooltip,
      alpha: 0,
      duration: 150,
      onComplete: () => tooltip.setVisible(false),
    });
  }

  private hideAllTooltips(): void {
    for (const z of this.exitZones) this.hideTooltip(z.tooltip);
    for (const z of this.interactZones) this.hideTooltip(z.tooltip);
  }

  private checkInteractOverlap(): void {
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    const threshold = 50;

    let nearest: InteractZone | null = null;
    let nearestDist = Infinity;

    for (const zone of this.interactZones) {
      const dx = px - zone.sprite.x;
      const dy = py - zone.sprite.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < threshold && dist < nearestDist) {
        nearest = zone;
        nearestDist = dist;
      }
    }

    if (nearest && nearest !== this.activeInteract && !this.activeExit) {
      if (this.activeInteract) this.hideTooltip(this.activeInteract.tooltip);
      this.activeInteract = nearest;
      this.showTooltip(nearest.tooltip);
      this.promptText.setText(`[E] ${nearest.displayLabel}`);
      this.promptText.setVisible(true);
    } else if (!nearest && this.activeInteract) {
      this.hideTooltip(this.activeInteract.tooltip);
      this.activeInteract = null;
      if (!this.activeExit) {
        this.promptText.setVisible(false);
      }
    }
  }

  private handleInteraction(zone: InteractZone): void {
    if (zone.action === 'shop') {
      if (this.sceneDef?.kind === 'shop') {
        this.scene.launch('ShopScene');
      } else {
        this.cameras.main.fade(500, 0, 0, 0, false, (_cam: unknown, progress: number) => {
          if (progress >= 1) {
            this.director.transitionTo('core:shop', this);
          }
        });
      }
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
      if (this.activeExit) this.hideTooltip(this.activeExit.tooltip);
      this.activeExit = nearest;
      this.showTooltip(nearest.tooltip);
      this.promptText.setText(`[E] Enter ${nearest.displayLabel}`);
      this.promptText.setVisible(true);
      eventBus.emit('exit:nearby', { exitTo: nearest.to, label: nearest.displayLabel });
    } else if (!nearest && this.activeExit) {
      this.hideTooltip(this.activeExit.tooltip);
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

  private buildFallbackRoom(width = 640, height = 480, wallThickness = 16): void {
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

  /** Builds a room from a background image asset, scaled and bounded. */
  private buildBackgroundRoom(sceneDef: SceneDef): void {
    const gen = sceneDef.generation;
    if (gen.method !== 'background') return;

    const imageKey = gen.image;
    const scale = gen.scale ?? 1;
    const wallInset = gen.wallInset ?? 32;

    if (!this.textures.exists(imageKey)) {
      console.warn(`Background image "${imageKey}" not found, falling back`);
      this.buildFallbackRoom();
      return;
    }

    const tex = this.textures.get(imageKey);
    const frame = tex.getSourceImage();
    const width = frame.width * scale;
    const height = frame.height * scale;

    const bg = this.add.image(width / 2, height / 2, imageKey);
    bg.setScale(scale);
    bg.setDepth(-1);

    this.physics.world.setBounds(
      wallInset,
      wallInset,
      width - wallInset * 2,
      height - wallInset * 2,
    );
  }

  /** Builds a room with a seamless tiled floor (procedural or image-based). */
  private buildTileFloor(sceneDef: SceneDef): void {
    const gen = sceneDef.generation;
    if (gen.method !== 'tileFloor') return;

    buildTileFloorGraphics(this, {
      width: gen.width,
      height: gen.height,
      tileSize: gen.tileSize,
      tileImage: gen.tileImage,
      defaultTile: gen.defaultTile,
      map: gen.map,
      tiles: gen.tiles,
      wallThickness: gen.wallThickness,
    });
  }

  private static readonly CAVE_TILE_PX = 16;

  /**
   * Builds a room from the procedural cave generator (generation/caveGenerator.ts)
   * — the "walkable path" mechanic: an organic, guaranteed-connected floor shape
   * instead of a plain rectangle. `roomCount` (already authored on every scene using
   * this method) loosely scales the generated grid so existing content needs no
   * changes; see scene.schema.ts's RoomsGenerationSchema for the tuning knobs.
   *
   * Visuals here are a checkerboard shade matching buildFallbackRoom's existing
   * style, NOT the illustrated art from the asset-pipeline admin tool's cave preview
   * — that tool renders a preview image, it doesn't feed real per-tile art into the
   * engine. Swapping this for a real tileset is a separate, later step.
   */
  private buildProceduralCave(sceneDef: SceneDef): void {
    const gen = sceneDef.generation;
    if (gen.method !== 'rooms') return;

    const TILE = GameScene.CAVE_TILE_PX;
    const width = Phaser.Math.Clamp(gen.roomCount[1] * 8, 24, 70);
    const height = Phaser.Math.Clamp(gen.roomCount[0] * 8, 24, 70);

    const map = generateCave({
      seed: gen.seed,
      width,
      height,
      fillRatio: gen.fillRatio,
      smoothIterations: gen.smoothIterations,
      widenPasses: gen.widenPasses,
      exitCount: gen.exitCount,
      openItemCount: gen.openItemCount,
      behindWallItemCount: gen.behindWallItemCount,
    });
    this.proceduralCaveMap = map;
    this.proceduralEntry = {
      x: map.entry.x * TILE + TILE / 2,
      y: map.entry.y * TILE + TILE / 2,
    };

    const canvasW = map.width * TILE;
    const canvasH = map.height * TILE;

    // tilesets/cave_floor is a single hand-illustrated floor with a branching path
    // baked directly into the artwork (asset-pipeline repo, docs/09 style) — NOT a
    // seamless material, so it's drawn ONCE, stretched to cover the generated
    // canvas (the same technique buildBackgroundRoom already uses for Home/Shop),
    // not tiled per-cell. Tiling an image with a strong illustrated pattern would
    // just recreate the visible-repeat problem that texture was specifically
    // redesigned to avoid. Its baked-in path is decorative — the actual walkable
    // shape always comes from the generated grid below, they are not the same
    // shape and are not expected to align pixel-for-pixel.
    if (this.textures.exists('tilesets/cave_floor')) {
      const floorImg = this.add.image(canvasW / 2, canvasH / 2, 'tilesets/cave_floor');
      floorImg.setDisplaySize(canvasW, canvasH);
      floorImg.setDepth(-2);
    } else {
      const fallback = this.add.rectangle(canvasW / 2, canvasH / 2, canvasW, canvasH, 0x252525);
      fallback.setDepth(-2);
    }

    // Wall cells darken over the background image — floor cells are left untouched
    // so the illustrated art shows through clearly there, matching the "lit path
    // reveals the floor, unwalkable stays dark" logic from the asset-pipeline
    // preview tool's mask-based renderer, done here with a simple overlay instead.
    const gfx = this.add.graphics();
    gfx.fillStyle(0x0a0e12, 0.82);
    for (let gy = 0; gy < map.height; gy++) {
      for (let gx = 0; gx < map.width; gx++) {
        if (map.grid[gy][gx] !== 0) continue;
        gfx.fillRect(gx * TILE, gy * TILE, TILE, TILE);
      }
    }
    gfx.setDepth(-1);

    // One static physics body per wall tile that borders at least one floor tile —
    // interior fully-enclosed rock is unreachable anyway (pruned to wall by the
    // generator's connectivity pass), so skipping it keeps the body count
    // proportional to the walkable area's perimeter, not the whole grid.
    this.wallGroup = this.physics.add.staticGroup();
    for (let gy = 0; gy < map.height; gy++) {
      for (let gx = 0; gx < map.width; gx++) {
        if (map.grid[gy][gx] !== 0) continue;
        const bordersFloor = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([dx, dy]) => map.grid[gy + dy]?.[gx + dx] === 1);
        if (!bordersFloor) continue;

        const rect = this.add.rectangle(gx * TILE + TILE / 2, gy * TILE + TILE / 2, TILE, TILE);
        rect.setVisible(false);
        this.wallGroup.add(rect);
      }
    }

    this.physics.world.setBounds(0, 0, canvasW, canvasH);
  }

  /**
   * Spawns real pickups at the procedural cave's generated item positions.
   * Only "open" placements are spawned — "behind_wall" items are generated in the
   * data (caveGenerator.ts marks the blocking wall via breaksWall) but there is no
   * break-wall interaction in this engine yet, so spawning them would place an
   * unreachable pickup. Left for when that system exists rather than faked here.
   */
  private spawnProceduralItems(): void {
    const map = this.proceduralCaveMap;
    if (!map) return;
    const TILE = GameScene.CAVE_TILE_PX;

    const trashItems = registry.getByTag('item', 'trash');
    const fuelItems = registry.getByTag('item', 'fuel');
    let trashIdx = 0;
    let fuelIdx = 0;

    for (const item of map.items) {
      if (item.placement !== 'open') continue;

      const pool = item.kind === 'fuel' ? fuelItems : trashItems;
      if (pool.length === 0) continue;
      const itemDef =
        item.kind === 'fuel' ? pool[fuelIdx++ % pool.length] : pool[trashIdx++ % pool.length];

      const x = item.x * TILE + TILE / 2;
      const y = item.y * TILE + TILE / 2;
      const sprite = this.createItemSprite(x, y, itemDef);
      this.pickupSystem.addGroundItem(sprite, itemDef.id, 1);
    }
  }

  private spawnPlayer(sceneDef: SceneDef | undefined): void {
    const playerDef = registry.getOrThrow('entity', 'core:player');
    // A procedurally generated cave's entry point takes priority over any authored
    // playerSpawn — a fixed coordinate can't be guaranteed walkable across different
    // seeds, but the generator's entry point always is (see caveGenerator.ts §4).
    const spawnX = this.proceduralEntry?.x ?? sceneDef?.playerSpawn?.x ?? 320;
    const spawnY = this.proceduralEntry?.y ?? sceneDef?.playerSpawn?.y ?? 240;

    this.player = EntityFactory.create(this, playerDef, spawnX, spawnY);
    this.player.setComponent('playerControlled', true);

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

  private static readonly ITEM_DISPLAY_SIZE = 16;

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

      const sprite = this.createItemSprite(x, y, itemDef);
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

      const sprite = this.createItemSprite(x, y, itemDef);
      this.pickupSystem.addGroundItem(sprite, itemDef.id, 1);
    }
  }

  /** Creates a ground-item sprite scaled by the def's displayScale. */
  private createItemSprite(
    x: number,
    y: number,
    itemDef: { sprite: string; displayScale?: number },
  ): Phaser.Physics.Arcade.Sprite {
    const textureKey =
      itemDef.sprite !== 'placeholder' && this.textures.exists(itemDef.sprite)
        ? itemDef.sprite
        : '__placeholder';

    const sprite = this.physics.add.sprite(x, y, textureKey);
    const sz = GameScene.ITEM_DISPLAY_SIZE * (itemDef.displayScale ?? 1);
    sprite.setDisplaySize(sz, sz);
    sprite.setDepth(2);
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setImmovable(true);
    body.setAllowGravity(false);
    body.setSize(sz, sz);
    return sprite;
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

  private static readonly GLOW_COLORS: Record<string, [string, string, string, string]> = {
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

  private setLampColor(color: string): void {
    if (this.lampColor === color) return;
    this.lampColor = color;

    // Keep debug panel in sync when changed via upgrade
    if (configManager.get<string>('lamp', 'glowColorName') !== color) {
      configManager.set('lamp', 'glowColorName', color);
    }

    this.rebuildGlowTexture();
    if (this.warmGlow) {
      this.warmGlow.setTexture('__lamp_glow');
    }
  }

  private rebuildGlowTexture(): void {
    const GS = GameScene.GLOW_TEX_SIZE;
    const stops = GameScene.GLOW_COLORS[this.lampColor] ?? GameScene.GLOW_COLORS['default'];

    if (this.textures.exists('__lamp_glow')) {
      this.textures.remove('__lamp_glow');
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
    this.textures.addCanvas('__lamp_glow', c);
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
    if (this.wallGroup && this.player) {
      this.physics.add.collider(this.player.sprite, this.wallGroup);
    }
  }
}
