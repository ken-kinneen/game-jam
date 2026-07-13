import type { ContentRegistry } from '../core/ContentRegistry';
import type { CaveMap } from '../generation/caveGenerator';
import type { PickupSystem } from '../systems/PickupSystem';

const ITEM_TARGET_SIZE = 28;
const CAVE_TILE_PX = 16;
const BOB_AMPLITUDE = 5;
const BOB_DURATION = 1200;
const GLOW_RADIUS = 60;
const GLOW_INTENSITY_LO = 0.6;
const GLOW_INTENSITY_HI = 1.5;
const SPARKLE_COUNT = 12;
const SPARKLE_SIZE = 4;
const RAINBOW = [0xff0000, 0xff8800, 0xffff00, 0x00ff44, 0x00ccff, 0x8844ff, 0xff44ff];

/** Spawns trash items randomly within world bounds. */
export function spawnGroundItems(
  scene: Phaser.Scene,
  registry: ContentRegistry,
  pickupSystem: PickupSystem,
): void {
  const trashItems = registry.getByTag('item', 'trash');
  if (trashItems.length === 0) return;

  const bounds = scene.physics.world.bounds;
  const margin = 32;
  const count = 12;

  for (let i = 0; i < count; i++) {
    const itemDef = trashItems[i % trashItems.length];
    const x = Phaser.Math.Between(bounds.x + margin, bounds.right - margin);
    const y = Phaser.Math.Between(bounds.y + margin, bounds.bottom - margin);

    const sprite = createItemSprite(scene, x, y, itemDef);
    pickupSystem.addGroundItem(sprite, itemDef.id, 1);
  }
}

/** Spawns fuel items randomly within world bounds. */
export function spawnFuelItems(
  scene: Phaser.Scene,
  registry: ContentRegistry,
  pickupSystem: PickupSystem,
): void {
  const fuelItems = registry.getByTag('item', 'fuel');
  if (fuelItems.length === 0) return;

  const bounds = scene.physics.world.bounds;
  const margin = 32;
  const count = 6;

  for (let i = 0; i < count; i++) {
    const itemDef = fuelItems[i % fuelItems.length];
    const x = Phaser.Math.Between(bounds.x + margin, bounds.right - margin);
    const y = Phaser.Math.Between(bounds.y + margin, bounds.bottom - margin);

    const sprite = createItemSprite(scene, x, y, itemDef);
    pickupSystem.addGroundItem(sprite, itemDef.id, 1);
  }
}

/** Spawns pickups at procedural cave item positions. */
export function spawnProceduralItems(
  scene: Phaser.Scene,
  registry: ContentRegistry,
  pickupSystem: PickupSystem,
  caveMap: CaveMap,
): void {
  const trashItems = registry.getByTag('item', 'trash');
  const fuelItems = registry.getByTag('item', 'fuel');
  let trashIdx = 0;
  let fuelIdx = 0;

  for (const item of caveMap.items) {
    if (item.placement !== 'open') continue;

    const pool = item.kind === 'fuel' ? fuelItems : trashItems;
    if (pool.length === 0) continue;
    const itemDef =
      item.kind === 'fuel' ? pool[fuelIdx++ % pool.length] : pool[trashIdx++ % pool.length];

    const x = item.x * CAVE_TILE_PX + CAVE_TILE_PX / 2;
    const y = item.y * CAVE_TILE_PX + CAVE_TILE_PX / 2;
    const sprite = createItemSprite(scene, x, y, itemDef);
    pickupSystem.addGroundItem(sprite, itemDef.id, 1);
  }
}

/** Spawns pickups at explicit positions defined in scene JSON. */
export function spawnPlacedItems(
  scene: Phaser.Scene,
  registry: ContentRegistry,
  pickupSystem: PickupSystem,
  items: {
    itemId: string;
    position: { x: number; y: number };
    qty?: number;
    image?: string;
    scale?: number;
    angle?: number;
  }[],
): void {
  for (const item of items) {
    const itemDef = registry.get('item', item.itemId);
    if (!itemDef) {
      console.warn(`Ground item "${item.itemId}" not found in registry, skipping`);
      continue;
    }
    const overrides: { sprite?: string; displayScale?: number } = {};
    if (item.image && scene.textures.exists(item.image)) overrides.sprite = item.image;
    if (item.scale) overrides.displayScale = item.scale;
    const sprite = createItemSprite(
      scene,
      item.position.x,
      item.position.y,
      { ...itemDef, ...overrides },
      item.angle,
    );
    pickupSystem.addGroundItem(sprite, item.itemId, item.qty ?? 1);
  }
}

function createItemSprite(
  scene: Phaser.Scene,
  x: number,
  y: number,
  itemDef: { sprite: string; displayScale?: number },
  angle?: number,
): Phaser.Physics.Arcade.Sprite {
  const textureKey =
    itemDef.sprite !== 'placeholder' && scene.textures.exists(itemDef.sprite)
      ? itemDef.sprite
      : '__placeholder';

  const sprite = scene.physics.add.sprite(x, y, textureKey);

  const tex = scene.textures.get(textureKey);
  const srcW = tex.getSourceImage().width;
  const srcH = tex.getSourceImage().height;
  const targetSize = ITEM_TARGET_SIZE * (itemDef.displayScale ?? 1);
  const longer = Math.max(srcW, srcH);
  const scale = targetSize / longer;
  sprite.setScale(scale);

  if (angle) sprite.setAngle(angle);

  sprite.setDepth(2);
  try {
    sprite.setPipeline('Light2D');
  } catch {
    /* no-op */
  }

  const body = sprite.body as Phaser.Physics.Arcade.Body;
  body.setImmovable(true);
  body.setAllowGravity(false);
  const bodySize = Math.min(targetSize, 24);
  body.setSize(bodySize / scale, bodySize / scale);

  addItemEffects(scene, sprite);
  return sprite;
}

function addItemEffects(scene: Phaser.Scene, sprite: Phaser.Physics.Arcade.Sprite): void {
  const phase = Math.random() * Math.PI * 2;
  const baseY = sprite.y;

  // Big floaty bob
  scene.tweens.add({
    targets: sprite,
    y: baseY - BOB_AMPLITUDE,
    duration: BOB_DURATION,
    ease: 'Sine.easeInOut',
    yoyo: true,
    repeat: -1,
    delay: (phase * BOB_DURATION) / (Math.PI * 2),
  });

  // Slow spin
  scene.tweens.add({
    targets: sprite,
    angle: 360,
    duration: 4000,
    ease: 'Linear',
    repeat: -1,
  });

  // Scale pulse
  const baseScale = sprite.scaleX;
  scene.tweens.add({
    targets: sprite,
    scaleX: baseScale * 1.25,
    scaleY: baseScale * 1.25,
    duration: 600,
    ease: 'Sine.easeInOut',
    yoyo: true,
    repeat: -1,
  });

  // Rainbow tint cycle
  let colorIdx = Math.floor(Math.random() * RAINBOW.length);
  scene.time.addEvent({
    delay: 200,
    loop: true,
    callback: () => {
      if (!sprite.active) return;
      colorIdx = (colorIdx + 1) % RAINBOW.length;
      sprite.setTint(RAINBOW[colorIdx]);
    },
  });

  // Sparkle particle ring
  createSparkleTexture(scene);
  const particles = scene.add.particles(sprite.x, sprite.y, '__sparkle', {
    speed: { min: 20, max: 60 },
    scale: { start: 1, end: 0 },
    alpha: { start: 1, end: 0 },
    lifespan: 800,
    frequency: 80,
    quantity: 2,
    tint: RAINBOW,
    emitZone: {
      type: 'edge',
      source: new Phaser.Geom.Circle(0, 0, 18),
      quantity: SPARKLE_COUNT,
    },
  });
  particles.setDepth(10);
  scene.events.on('update', () => {
    particles.setPosition(sprite.x, sprite.y);
  });
  sprite.on('destroy', () => {
    particles.destroy();
  });

  // Big rainbow glow light
  try {
    const glow = scene.lights.addLight(
      sprite.x,
      sprite.y,
      GLOW_RADIUS,
      RAINBOW[0],
      GLOW_INTENSITY_LO,
    );
    let glowColorIdx = 0;
    scene.tweens.add({
      targets: glow,
      intensity: GLOW_INTENSITY_HI,
      duration: 400,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });
    scene.time.addEvent({
      delay: 300,
      loop: true,
      callback: () => {
        glowColorIdx = (glowColorIdx + 1) % RAINBOW.length;
        glow.setColor(RAINBOW[glowColorIdx]);
      },
    });
    scene.events.on('update', () => {
      glow.x = sprite.x;
      glow.y = sprite.y;
    });
    sprite.on('destroy', () => {
      scene.lights.removeLight(glow);
    });
  } catch {
    /* lights not available */
  }
}

function createSparkleTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists('__sparkle')) return;
  const gfx = scene.add.graphics();
  gfx.fillStyle(0xffffff, 1);
  gfx.fillRect(0, 0, SPARKLE_SIZE, SPARKLE_SIZE);
  const d = SPARKLE_SIZE * 2;
  gfx.fillStyle(0xffffff, 0.5);
  gfx.fillRect(-SPARKLE_SIZE / 2, SPARKLE_SIZE / 2 - 1, d, 2);
  gfx.fillRect(SPARKLE_SIZE / 2 - 1, -SPARKLE_SIZE / 2, 2, d);
  gfx.generateTexture('__sparkle', SPARKLE_SIZE * 2, SPARKLE_SIZE * 2);
  gfx.destroy();
}
