import { generateCave, type CaveMap } from '../generation/caveGenerator';
import { buildTileFloorGraphics } from '../generation/floorTileGenerator';
import type { SceneDef } from '../schemas/scene.schema';

export interface RoomBuildResult {
  wallLayer: Phaser.Tilemaps.TilemapLayer | null;
  wallGroup: Phaser.Physics.Arcade.StaticGroup | null;
  caveMap: CaveMap | null;
  caveEntry: { x: number; y: number } | null;
}

const CAVE_TILE_PX = 16;

/** Builds the room geometry for a scene based on its generation method. */
export function buildSceneRoom(
  scene: Phaser.Scene,
  sceneDef: SceneDef | undefined,
  isCave: boolean,
): RoomBuildResult {
  const result: RoomBuildResult = {
    wallLayer: null,
    wallGroup: null,
    caveMap: null,
    caveEntry: null,
  };

  if (!sceneDef) {
    buildFallbackRoom(scene, isCave);
    return result;
  }

  const gen = sceneDef.generation;
  if (gen.method === 'tilemap') {
    result.wallLayer = buildTilemap(scene, sceneDef, isCave);
  } else if (gen.method === 'background') {
    buildBackgroundRoom(scene, sceneDef, isCave);
  } else if (gen.method === 'rooms') {
    const cave = buildProceduralCave(scene, sceneDef);
    result.wallGroup = cave.wallGroup;
    result.caveMap = cave.caveMap;
    result.caveEntry = cave.caveEntry;
  } else if (gen.method === 'tileFloor') {
    buildTileFloor(scene, sceneDef);
  } else if (gen.method === 'corridor') {
    const corridor = buildCorridorRoom(scene, sceneDef);
    result.wallGroup = corridor.wallGroup;
  } else if (gen.method === 'tiled') {
    buildFallbackRoom(scene, isCave, gen.width, gen.height, gen.wallThickness);
  } else {
    buildFallbackRoom(scene, isCave);
  }

  return result;
}

function buildTilemap(
  scene: Phaser.Scene,
  sceneDef: SceneDef,
  isCave: boolean,
): Phaser.Tilemaps.TilemapLayer | null {
  const gen = sceneDef.generation;
  if (gen.method !== 'tilemap') return null;

  const mapKey = gen.map;

  if (!scene.cache.tilemap.has(mapKey)) {
    buildFallbackRoom(scene, isCave);
    return null;
  }

  const map = scene.make.tilemap({ key: mapKey });
  const tilesetKey = sceneDef.tileset ?? 'tileset';
  const tileset = map.addTilesetImage('tileset', tilesetKey);

  if (!tileset) {
    console.error(`Tileset "${tilesetKey}" not found in map`);
    buildFallbackRoom(scene, isCave);
    return null;
  }

  const ground = map.createLayer('ground', tileset);
  if (ground) {
    ground.setDepth(0);
  }

  const walls = map.createLayer('walls', tileset);
  if (walls) {
    walls.setCollisionByProperty({ collides: true });
    walls.setDepth(1);
  }

  scene.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
  return walls ?? null;
}

function buildFallbackRoom(
  scene: Phaser.Scene,
  isCave: boolean,
  width = 640,
  height = 480,
  wallThickness = 16,
): void {
  const tileSize = 16;

  const gfx = scene.add.graphics();

  const isHome = !isCave;
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

  scene.physics.world.setBounds(
    wallThickness,
    wallThickness,
    width - wallThickness * 2,
    height - wallThickness * 2,
  );
}

/** Builds a room from a background image asset, scaled and bounded. */
function buildBackgroundRoom(scene: Phaser.Scene, sceneDef: SceneDef, isCave: boolean): void {
  const gen = sceneDef.generation;
  if (gen.method !== 'background') return;

  const imageKey = gen.image;
  const scale = gen.scale ?? 1;
  const wallInset = gen.wallInset ?? 32;

  if (!scene.textures.exists(imageKey)) {
    console.warn(`Background image "${imageKey}" not found, falling back`);
    buildFallbackRoom(scene, isCave);
    return;
  }

  const tex = scene.textures.get(imageKey);
  const frame = tex.getSourceImage();
  const width = frame.width * scale;
  const height = frame.height * scale;

  const bg = scene.add.image(width / 2, height / 2, imageKey);
  bg.setScale(scale);
  bg.setDepth(-1);
  try {
    bg.setPipeline('Light2D');
  } catch {
    /* no-op */
  }

  scene.physics.world.setBounds(
    wallInset,
    wallInset,
    width - wallInset * 2,
    height - wallInset * 2,
  );
}

/** Builds a room with a seamless tiled floor (procedural or image-based). */
function buildTileFloor(scene: Phaser.Scene, sceneDef: SceneDef): void {
  const gen = sceneDef.generation;
  if (gen.method !== 'tileFloor') return;

  buildTileFloorGraphics(scene, {
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

/** Builds a procedural cave room from the cellular-automata generator. */
function buildProceduralCave(
  scene: Phaser.Scene,
  sceneDef: SceneDef,
): Pick<RoomBuildResult, 'wallGroup' | 'caveMap' | 'caveEntry'> {
  const gen = sceneDef.generation;
  if (gen.method !== 'rooms') {
    return { wallGroup: null, caveMap: null, caveEntry: null };
  }

  const TILE = CAVE_TILE_PX;
  const width = Phaser.Math.Clamp(gen.roomCount[1] * 8, 24, 120);
  const height = Phaser.Math.Clamp(gen.roomCount[0] * 8, 24, 120);

  const map = generateCave({
    seed: gen.seed,
    width,
    height,
    fillRatio: gen.fillRatio,
    smoothIterations: gen.smoothIterations,
    widenPasses: gen.widenPasses,
    pillarCount: gen.pillarCount,
    exitCount: gen.exitCount,
    openItemCount: gen.openItemCount,
    behindWallItemCount: gen.behindWallItemCount,
  });

  const caveEntry = {
    x: map.entry.x * TILE + TILE / 2,
    y: map.entry.y * TILE + TILE / 2,
  };

  const canvasW = map.width * TILE;
  const canvasH = map.height * TILE;

  if (scene.textures.exists('tilesets/cave_floor')) {
    const floorTile = scene.add.tileSprite(
      canvasW / 2,
      canvasH / 2,
      canvasW,
      canvasH,
      'tilesets/cave_floor',
    );
    const srcW = scene.textures.get('tilesets/cave_floor').getSourceImage().width;
    const floorTileScale = gen.floorTileScale ?? 6;
    const tileScale = (TILE * floorTileScale) / srcW;
    floorTile.setTileScale(tileScale, tileScale);
    floorTile.setDepth(-2);
    try {
      floorTile.setPipeline('Light2D');
    } catch {
      /* no-op */
    }
  } else {
    const fallback = scene.add.rectangle(canvasW / 2, canvasH / 2, canvasW, canvasH, 0x252525);
    fallback.setDepth(-2);
  }

  // Collision bodies on wall cells (invisible — no visual wall overlay)
  const wallGroup = scene.physics.add.staticGroup();
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

      const rect = scene.add.rectangle(gx * TILE + TILE / 2, gy * TILE + TILE / 2, TILE, TILE);
      rect.setVisible(false);
      wallGroup.add(rect);
    }
  }

  scene.physics.world.setBounds(0, 0, canvasW, canvasH);

  return { wallGroup, caveMap: map, caveEntry };
}

/** Compiles corridor segments into a walkable floor grid. */
function compileCorridorGrid(
  width: number,
  height: number,
  segments: { x: number; y: number; w: number; h: number }[],
): number[][] {
  const grid: number[][] = Array.from({ length: height }, () => Array(width).fill(0));
  for (const seg of segments) {
    for (let gy = seg.y; gy < seg.y + seg.h && gy < height; gy++) {
      for (let gx = seg.x; gx < seg.x + seg.w && gx < width; gx++) {
        grid[gy][gx] = 1;
      }
    }
  }
  return grid;
}

/** Builds a hand-designed corridor layout from rectangular segments. */
function buildCorridorRoom(
  scene: Phaser.Scene,
  sceneDef: SceneDef,
): Pick<RoomBuildResult, 'wallGroup'> {
  const gen = sceneDef.generation;
  if (gen.method !== 'corridor') return { wallGroup: null };

  const CELL = gen.cellSize;
  const grid = compileCorridorGrid(gen.gridWidth, gen.gridHeight, gen.segments);
  const canvasW = gen.gridWidth * CELL;
  const canvasH = gen.gridHeight * CELL;

  // Black void base — everything starts in shadow
  const voidBg = scene.add.rectangle(canvasW / 2, canvasH / 2, canvasW, canvasH, 0x050608);
  voidBg.setDepth(-3);

  // Floor tiles only under walkable segments
  const tileKey = gen.tileImage && scene.textures.exists(gen.tileImage) ? gen.tileImage : null;
  if (tileKey) {
    const srcW = scene.textures.get(tileKey).getSourceImage().width;
    const tileScale = (CELL * 3) / srcW;
    for (const seg of gen.segments) {
      const sx = seg.x * CELL;
      const sy = seg.y * CELL;
      const sw = seg.w * CELL;
      const sh = seg.h * CELL;
      const floorTile = scene.add.tileSprite(sx + sw / 2, sy + sh / 2, sw, sh, tileKey);
      floorTile.setTileScale(tileScale, tileScale);
      floorTile.setTilePosition(sx, sy);
      floorTile.setDepth(-2);
      try {
        floorTile.setPipeline('Light2D');
      } catch {
        /* no-op */
      }
    }
  } else {
    for (const seg of gen.segments) {
      const sx = seg.x * CELL;
      const sy = seg.y * CELL;
      const sw = seg.w * CELL;
      const sh = seg.h * CELL;
      const fallback = scene.add.rectangle(sx + sw / 2, sy + sh / 2, sw, sh, 0x2a2a2a);
      fallback.setDepth(-2);
    }
  }

  // Seeded RNG for deterministic wall variety
  const seedVal = gen.gridWidth * 1000 + gen.gridHeight;
  let rngState = seedVal;
  const rng = () => {
    rngState = (rngState * 1664525 + 1013904223) & 0x7fffffff;
    return rngState / 0x7fffffff;
  };

  const wallKey = gen.wallImage && scene.textures.exists(gen.wallImage) ? gen.wallImage : null;
  let wallTileScale = 1;
  if (wallKey) {
    const wallSrcW = scene.textures.get(wallKey).getSourceImage().width;
    wallTileScale = (CELL * 3) / wallSrcW;
  }

  const ROTATIONS = [0, 90, 180, 270];
  const TINT_LO = 0.7;
  const TINT_HI = 1.0;

  const wallGroup = scene.physics.add.staticGroup();
  for (let gy = 0; gy < gen.gridHeight; gy++) {
    for (let gx = 0; gx < gen.gridWidth; gx++) {
      if (grid[gy][gx] !== 0) continue;
      const bordersFloor = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dx, dy]) => grid[gy + dy]?.[gx + dx] === 1);
      if (!bordersFloor) continue;

      if (wallKey) {
        const wallTile = scene.add.tileSprite(
          gx * CELL + CELL / 2,
          gy * CELL + CELL / 2,
          CELL,
          CELL,
          wallKey,
        );
        wallTile.setTileScale(wallTileScale, wallTileScale);
        wallTile.setTilePosition(gx * CELL, gy * CELL);
        wallTile.setAngle(ROTATIONS[Math.floor(rng() * 4)]);
        const bright = TINT_LO + rng() * (TINT_HI - TINT_LO);
        const tintVal = Math.round(bright * 255);
        wallTile.setTint(Phaser.Display.Color.GetColor(tintVal, tintVal, tintVal));
        wallTile.setDepth(-1);
        try {
          wallTile.setPipeline('Light2D');
        } catch {
          /* no-op */
        }
        wallGroup.add(wallTile);
      } else {
        const bright = 0x14 + Math.floor(rng() * 0x0c);
        const rect = scene.add.rectangle(
          gx * CELL + CELL / 2,
          gy * CELL + CELL / 2,
          CELL,
          CELL,
          Phaser.Display.Color.GetColor(bright, bright + 2, bright + 4),
        );
        rect.setDepth(-1);
        wallGroup.add(rect);
      }
    }
  }

  scene.physics.world.setBounds(0, 0, canvasW, canvasH);

  return { wallGroup };
}
