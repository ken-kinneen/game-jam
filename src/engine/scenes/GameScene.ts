import { Entity } from '../entities/Entity';
import { EntityFactory } from '../entities/EntityFactory';
import { MovementSystem } from '../systems/MovementSystem';
import { PickupSystem } from '../systems/PickupSystem';
import { InputMap } from '../input/InputMap';
import { eventBus } from '../core/EventBus';
import { registry } from '../core/ContentRegistry';
import type { SceneDef } from '../schemas/scene.schema';
import type { SceneDirector } from './SceneDirector';

/**
 * ONE generic GameScene configured by a SceneDef.
 * No HomeScene.ts, no Cave1Scene.ts — just data-driven setup.
 */
export class GameScene extends Phaser.Scene {
  private player!: Entity;
  private movementSystem!: MovementSystem;
  private pickupSystem!: PickupSystem;
  private inputMap!: InputMap;
  private sceneDefId = 'core:home';
  private wallLayer: Phaser.Tilemaps.TilemapLayer | null = null;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: { sceneId?: string }) {
    this.sceneDefId = data.sceneId ?? 'core:home';
  }

  create() {
    this.movementSystem = new MovementSystem();
    this.pickupSystem = new PickupSystem(registry, eventBus);
    this.inputMap = new InputMap(this);

    const sceneDef = registry.get('scene', this.sceneDefId);

    if (sceneDef?.generation.method === 'tilemap') {
      this.buildTilemap(sceneDef);
    } else {
      this.buildFallbackRoom();
    }

    this.spawnPlayer(sceneDef);
    this.spawnGroundItems(sceneDef);
    this.setupCollisions();

    if (!this.scene.isActive('UIScene')) {
      this.scene.launch('UIScene');
    }

    eventBus.emit('scene:enter', { sceneId: this.sceneDefId });
  }

  update(_time: number, delta: number) {
    const dt = delta / 1000;
    const move = this.inputMap.getMoveVector();
    this.movementSystem.update(this.player, move.x, move.y, dt);
    this.pickupSystem.update(this.player);
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
    const width = 320;
    const height = 240;
    const wallThickness = 16;

    const gfx = this.add.graphics();
    gfx.fillStyle(0x2a2a2a, 1);
    gfx.fillRect(0, 0, width, height);

    gfx.fillStyle(0x444444, 1);
    gfx.fillRect(0, 0, width, wallThickness);
    gfx.fillRect(0, height - wallThickness, width, wallThickness);
    gfx.fillRect(0, 0, wallThickness, height);
    gfx.fillRect(width - wallThickness, 0, wallThickness, height);
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
    const spawnX = sceneDef?.playerSpawn?.x ?? 160;
    const spawnY = sceneDef?.playerSpawn?.y ?? 120;

    this.player = EntityFactory.create(this, playerDef, spawnX, spawnY);
    this.player.setComponent('playerControlled', true);

    const body = this.player.sprite.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(true);
    body.setCircle(
      Math.min(this.player.sprite.width, this.player.sprite.height) * 0.35,
      this.player.sprite.width * 0.15,
      this.player.sprite.height * 0.15,
    );

    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);

    const zoom = 3;
    this.cameras.main.setZoom(zoom);
  }

  private spawnGroundItems(sceneDef: SceneDef | undefined): void {
    const allItems = registry.getAll('item');
    if (allItems.length === 0) return;

    const bounds = this.physics.world.bounds;
    const margin = 24;

    for (let i = 0; i < Math.min(allItems.length, 5); i++) {
      const itemDef = allItems[i];
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

  private setupCollisions(): void {
    if (this.wallLayer && this.player) {
      this.physics.add.collider(this.player.sprite, this.wallLayer);
    }
  }
}
