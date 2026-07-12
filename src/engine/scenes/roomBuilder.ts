import { Color3, Mesh, MeshBuilder, StandardMaterial, Texture, type Scene } from '@babylonjs/core';
import { generateCave, type CaveMap } from '../generation/caveGenerator';
import type { SceneDef } from '../schemas/scene.schema';
import { assetStore } from '../rendering/AssetStore';
import { MeshFactory, type WallBox } from '../rendering/MeshFactory';
import type { Aabb } from '../rendering/CollisionWorld';
import { WORLD_SCALE } from '../entities/EntityFactory';

/** World units covered by one repeat of the cave rock texture. */
const ROCK_TILE_WORLD = 2;

export interface RoomBuildResult {
  walls: Aabb[];
  wallMeshes: Mesh[];
  caveMap: CaveMap | null;
  caveEntry: { x: number; y: number } | null;
  /** Pixel-space world size. */
  pixelWidth: number;
  pixelHeight: number;
  disposables: { dispose: () => void }[];
}

const CAVE_TILE_PX = 16;

/** Builds the room geometry for a scene based on its generation method. */
export function buildSceneRoom(
  scene: Scene,
  sceneDef: SceneDef | undefined,
  isCave: boolean,
): RoomBuildResult {
  const result: RoomBuildResult = {
    walls: [],
    wallMeshes: [],
    caveMap: null,
    caveEntry: null,
    pixelWidth: 640,
    pixelHeight: 480,
    disposables: [],
  };

  if (!sceneDef) {
    Object.assign(result, buildFallbackRoom(scene, isCave));
    return result;
  }

  const gen = sceneDef.generation;
  if (gen.method === 'tilemap') {
    Object.assign(result, buildFallbackRoom(scene, isCave));
  } else if (gen.method === 'background') {
    Object.assign(result, buildBackgroundRoom(scene, sceneDef, isCave));
  } else if (gen.method === 'rooms') {
    Object.assign(result, buildProceduralCave(scene, sceneDef));
  } else if (gen.method === 'tileFloor') {
    Object.assign(result, buildTileFloor(scene, sceneDef));
  } else if (gen.method === 'tiled') {
    Object.assign(
      result,
      buildFallbackRoom(scene, isCave, gen.width, gen.height, gen.wallThickness),
    );
  } else {
    Object.assign(result, buildFallbackRoom(scene, isCave));
  }

  return result;
}

function buildFallbackRoom(
  scene: Scene,
  isCave: boolean,
  width = 640,
  height = 480,
  wallThickness = 16,
): Partial<RoomBuildResult> {
  const w = width * WORLD_SCALE;
  const d = height * WORLD_SCALE;
  const color = isCave ? new Color3(0.16, 0.16, 0.18) : new Color3(0.18, 0.22, 0.18);
  const ground = MeshFactory.createGround(scene, 'fallbackGround', w, d, undefined, color);

  const t = wallThickness * WORLD_SCALE;
  const wallMat = isCave ? rockWallMaterial(scene) : undefined;
  const walls = perimeterWalls(scene, w, d, t, isCave ? 2.5 : 6, true, wallMat);
  const disposables: { dispose: () => void }[] = [
    ground,
    ...walls.map((b) => b.mesh!).filter(Boolean),
  ];
  if (wallMat) disposables.push(wallMat);
  return {
    walls: walls.map(toAabb),
    wallMeshes: walls.map((b) => b.mesh!).filter(Boolean),
    pixelWidth: width,
    pixelHeight: height,
    disposables,
    caveMap: null,
    caveEntry: null,
  };
}

function buildBackgroundRoom(
  scene: Scene,
  sceneDef: SceneDef,
  isCave: boolean,
): Partial<RoomBuildResult> {
  const gen = sceneDef.generation;
  if (gen.method !== 'background') return buildFallbackRoom(scene, isCave);

  const imageKey = gen.image;
  const scale = gen.scale ?? 1;
  const wallInset = gen.wallInset ?? 32;

  if (!assetStore.hasTexture(imageKey)) {
    console.warn(`Background image "${imageKey}" not found, falling back`);
    return buildFallbackRoom(scene, isCave);
  }

  const tex = assetStore.getTexture(imageKey);
  const size = tex.getSize();
  const width = size.width * scale;
  const height = size.height * scale;
  const w = width * WORLD_SCALE;
  const d = height * WORLD_SCALE;

  const ground = MeshBuilder.CreateGround('bgGround', { width: w, height: d }, scene);
  ground.position.x = w / 2;
  ground.position.z = d / 2;
  const mat = new StandardMaterial('bgMat', scene);
  mat.diffuseTexture = tex;
  mat.specularColor = Color3.Black();
  ground.material = mat;

  const inset = wallInset * WORLD_SCALE;
  const wallMat = rockWallMaterial(scene);
  const walls = [
    MeshFactory.createWallBox(scene, 'wallT', 0, w, 0, inset, 1.5, true, wallMat),
    MeshFactory.createWallBox(scene, 'wallB', 0, w, d - inset, d, 1.5, true, wallMat),
    MeshFactory.createWallBox(scene, 'wallL', 0, inset, 0, d, 1.5, true, wallMat),
    MeshFactory.createWallBox(scene, 'wallR', w - inset, w, 0, d, 1.5, true, wallMat),
  ];
  const disposables: { dispose: () => void }[] = [ground, ...walls.map((b) => b.mesh!)];
  if (wallMat) disposables.push(wallMat);

  return {
    walls: walls.map(toAabb),
    wallMeshes: walls.map((b) => b.mesh!),
    pixelWidth: width,
    pixelHeight: height,
    disposables,
    caveMap: null,
    caveEntry: null,
  };
}

function buildTileFloor(scene: Scene, sceneDef: SceneDef): Partial<RoomBuildResult> {
  const gen = sceneDef.generation;
  if (gen.method !== 'tileFloor') return {};

  const width = gen.width;
  const height = gen.height;
  const wallThickness = gen.wallThickness;
  const w = width * WORLD_SCALE;
  const d = height * WORLD_SCALE;

  let groundTex: Texture | undefined;
  if (gen.tileImage && assetStore.hasTexture(gen.tileImage)) {
    groundTex = assetStore.getTexture(gen.tileImage);
    groundTex.wrapU = Texture.WRAP_ADDRESSMODE;
    groundTex.wrapV = Texture.WRAP_ADDRESSMODE;
    const srcW = groundTex.getSize().width || gen.tileSize;
    const tilesAcross = width / gen.tileSize;
    groundTex.uScale = tilesAcross * (gen.tileSize / srcW);
    groundTex.vScale = (height / gen.tileSize) * (gen.tileSize / srcW);
  }

  const ground = MeshFactory.createGround(
    scene,
    'tileFloor',
    w,
    d,
    groundTex,
    new Color3(0.3, 0.28, 0.25),
  );

  const t = wallThickness * WORLD_SCALE;
  const wallMat = rockWallMaterial(scene);
  const walls = perimeterWalls(scene, w, d, t, 6, true, wallMat);
  const disposables: { dispose: () => void }[] = [ground, ...walls.map((b) => b.mesh!)];
  if (wallMat) disposables.push(wallMat);

  return {
    walls: walls.map(toAabb),
    wallMeshes: walls.map((b) => b.mesh!),
    pixelWidth: width,
    pixelHeight: height,
    disposables,
    caveMap: null,
    caveEntry: null,
  };
}

function buildProceduralCave(scene: Scene, sceneDef: SceneDef): Partial<RoomBuildResult> {
  const gen = sceneDef.generation;
  if (gen.method !== 'rooms') {
    return { walls: [], wallMeshes: [], caveMap: null, caveEntry: null };
  }

  const TILE = CAVE_TILE_PX;
  const width = clamp(gen.roomCount[1] * 8, 24, 120);
  const height = clamp(gen.roomCount[0] * 8, 24, 120);

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
  const w = canvasW * WORLD_SCALE;
  const d = canvasH * WORLD_SCALE;

  let groundTex: Texture | undefined;
  if (assetStore.hasTexture('tilesets/cave_floor')) {
    groundTex = assetStore.getTexture('tilesets/cave_floor');
    groundTex.wrapU = Texture.WRAP_ADDRESSMODE;
    groundTex.wrapV = Texture.WRAP_ADDRESSMODE;
    const floorTileScale = gen.floorTileScale ?? 6;
    const srcW = groundTex.getSize().width || 64;
    const tileWorld = (TILE * floorTileScale) / srcW;
    groundTex.uScale = canvasW / (srcW * tileWorld);
    groundTex.vScale = canvasH / (srcW * tileWorld);
  }

  const ground = MeshFactory.createGround(
    scene,
    'caveFloor',
    w,
    d,
    groundTex,
    new Color3(0.15, 0.15, 0.16),
  );

  const walls: WallBox[] = [];
  const disposables: { dispose: () => void }[] = [ground];
  const wallMat = rockWallMaterial(scene);
  if (wallMat) disposables.push(wallMat);
  let wallIdx = 0;

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

      const minX = gx * TILE * WORLD_SCALE;
      const maxX = (gx + 1) * TILE * WORLD_SCALE;
      const minZ = gy * TILE * WORLD_SCALE;
      const maxZ = (gy + 1) * TILE * WORLD_SCALE;
      const box = MeshFactory.createWallBox(
        scene,
        `caveWall_${wallIdx++}`,
        minX,
        maxX,
        minZ,
        maxZ,
        8,
        true,
        wallMat,
      );
      walls.push(box);
      if (box.mesh) disposables.push(box.mesh);
    }
  }

  return {
    walls: walls.map(toAabb),
    wallMeshes: walls.map((b) => b.mesh!).filter(Boolean),
    caveMap: map,
    caveEntry,
    pixelWidth: canvasW,
    pixelHeight: canvasH,
    disposables,
  };
}

function perimeterWalls(
  scene: Scene,
  w: number,
  d: number,
  t: number,
  height = 1.5,
  visible = true,
  material?: StandardMaterial,
): WallBox[] {
  return [
    MeshFactory.createWallBox(scene, 'wallT', 0, w, 0, t, height, visible, material),
    MeshFactory.createWallBox(scene, 'wallB', 0, w, d - t, d, height, visible, material),
    MeshFactory.createWallBox(scene, 'wallL', 0, t, 0, d, height, visible, material),
    MeshFactory.createWallBox(scene, 'wallR', w - t, w, 0, d, height, visible, material),
  ];
}

/** Shared cave rock material, or undefined if the tileset is missing. */
function rockWallMaterial(scene: Scene): StandardMaterial | undefined {
  if (!assetStore.hasTexture('tilesets/cave_wall')) return undefined;
  const tex = assetStore.getTexture('tilesets/cave_wall');
  // One UV repeat per ROCK_TILE_WORLD units — cave cells are ~1 unit wide, height 2
  const scale = 1 / ROCK_TILE_WORLD;
  return MeshFactory.createRockWallMaterial(scene, 'caveRockWall', tex, scale, scale);
}

function toAabb(box: WallBox): Aabb {
  return { minX: box.minX, maxX: box.maxX, minZ: box.minZ, maxZ: box.maxZ };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
