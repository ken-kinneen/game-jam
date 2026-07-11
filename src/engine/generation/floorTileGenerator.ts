/**
 * Generates a seamless (tileable) floor texture using 4D toroidal noise
 * sampling, then renders it via Phaser's TileSprite (GL_REPEAT).
 * The result is a continuous organic surface with no visible seams or patterns.
 */

/** Definition for a single tile type in the palette. */
export type FloorTileDef = {
  texture: 'wood' | 'stone' | 'metal' | 'marble';
  baseColor: string;
  accentColor: string;
  variation: number;
  roughness: number;
  variant: number;
};

/** @deprecated Alias kept for internal generator functions. */
type FloorStyle = FloorTileDef;

/** Parses a hex color string (#rrggbb) into [r, g, b]. */
function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

// --- 4D gradient noise for seamless tiling ---
const PERM = new Uint8Array(512);
const GRAD4 = [
  [0, 1, 1, 1],
  [0, 1, 1, -1],
  [0, 1, -1, 1],
  [0, 1, -1, -1],
  [0, -1, 1, 1],
  [0, -1, 1, -1],
  [0, -1, -1, 1],
  [0, -1, -1, -1],
  [1, 0, 1, 1],
  [1, 0, 1, -1],
  [1, 0, -1, 1],
  [1, 0, -1, -1],
  [-1, 0, 1, 1],
  [-1, 0, 1, -1],
  [-1, 0, -1, 1],
  [-1, 0, -1, -1],
  [1, 1, 0, 1],
  [1, 1, 0, -1],
  [1, -1, 0, 1],
  [1, -1, 0, -1],
  [-1, 1, 0, 1],
  [-1, 1, 0, -1],
  [-1, -1, 0, 1],
  [-1, -1, 0, -1],
  [1, 1, 1, 0],
  [1, 1, -1, 0],
  [1, -1, 1, 0],
  [1, -1, -1, 0],
  [-1, 1, 1, 0],
  [-1, 1, -1, 0],
  [-1, -1, 1, 0],
  [-1, -1, -1, 0],
];

(function initPerm() {
  const p: number[] = [];
  for (let i = 0; i < 256; i++) p[i] = i;
  let seed = 42;
  for (let i = 255; i > 0; i--) {
    seed = (seed * 16807) % 2147483647;
    const j = seed % (i + 1);
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
})();

function noise4D(x: number, y: number, z: number, w: number): number {
  const ix = Math.floor(x) & 255;
  const iy = Math.floor(y) & 255;
  const iz = Math.floor(z) & 255;
  const iw = Math.floor(w) & 255;

  const fx = x - Math.floor(x);
  const fy = y - Math.floor(y);
  const fz = z - Math.floor(z);
  const fw = w - Math.floor(w);

  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const uz = fz * fz * fz * (fz * (fz * 6 - 15) + 10);
  const uw = fw * fw * fw * (fw * (fw * 6 - 15) + 10);

  let sum = 0;
  for (let dw = 0; dw <= 1; dw++) {
    for (let dz = 0; dz <= 1; dz++) {
      for (let dy = 0; dy <= 1; dy++) {
        for (let dx = 0; dx <= 1; dx++) {
          const hash =
            PERM[
              (PERM[(PERM[(PERM[(ix + dx) & 255] + iy + dy) & 255] + iz + dz) & 255] + iw + dw) &
                255
            ];
          const g = GRAD4[hash & 31];
          const dot = g[0] * (fx - dx) + g[1] * (fy - dy) + g[2] * (fz - dz) + g[3] * (fw - dw);
          const lx = dx === 0 ? 1 - ux : ux;
          const ly = dy === 0 ? 1 - uy : uy;
          const lz = dz === 0 ? 1 - uz : uz;
          const lw = dw === 0 ? 1 - uw : uw;
          sum += dot * lx * ly * lz * lw;
        }
      }
    }
  }
  return sum;
}

/**
 * Seamless noise: maps 2D coords onto a 4D torus so the texture wraps
 * perfectly in both axes without any visible seam.
 */
function seamlessNoise(nx: number, ny: number, scale: number, ox = 0, oy = 0): number {
  const TAU = Math.PI * 2;
  const ax = (nx + ox) * TAU;
  const ay = (ny + oy) * TAU;
  return noise4D(
    Math.sin(ax) * scale,
    Math.cos(ax) * scale,
    Math.sin(ay) * scale,
    Math.cos(ay) * scale,
  );
}

/** Multi-octave fractal Brownian motion, seamlessly tiling. */
function seamlessFbm(nx: number, ny: number, octaves: number, baseScale: number): number {
  let value = 0;
  let amp = 1;
  let totalAmp = 0;
  let scale = baseScale;

  for (let o = 0; o < octaves; o++) {
    value += seamlessNoise(nx, ny, scale, o * 5.7, o * 11.3) * amp;
    totalAmp += amp;
    amp *= 0.5;
    scale *= 2;
  }
  return value / totalAmp;
}

/** Dispatches to the appropriate texture generator based on style.texture. */
function generateSeamlessTileCanvas(size: number, style: FloorStyle): HTMLCanvasElement {
  switch (style.texture) {
    case 'wood':
      return generateWoodTile(size, style);
    case 'stone':
      return generateStoneTile(size, style);
    case 'metal':
      return generateMetalTile(size, style);
    case 'marble':
      return generateMarbleTile(size, style);
    default:
      return generateWoodTile(size, style);
  }
}

/** Wood: directional grain with knot warp. */
function generateWoodTile(size: number, style: FloorStyle): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(size, size);
  const data = imageData.data;
  const [br, bg, bb] = parseHex(style.baseColor);
  const [ar, ag, ab] = parseHex(style.accentColor);
  const v = style.variant * 17.31;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const nx = px / size;
      const ny = py / size;

      const warpX = seamlessNoise(nx, ny, 2.0, 3.3 + v, 7.7 + v) * 0.25;
      const warpY = seamlessNoise(nx, ny, 2.0, 9.1 + v, 2.4 + v) * 0.08;
      const wnx = nx + warpX;
      const wny = ny + warpY;

      const grain1 = seamlessFbm(wnx * 0.3, wny * 16.0, 3, 1.5) * 0.5 + 0.5;
      const grain2 = seamlessFbm(wnx * 0.4, wny * 12.0, 2, 2.0) * 0.5 + 0.5;
      const grain = grain1 * 0.7 + grain2 * 0.3;
      const sharpGrain = Math.pow(grain, 1.5);

      const broad = seamlessNoise(nx, ny, 0.8, 0.5 + v, 20.0 + v) * 0.5 + 0.5;
      const fine = seamlessFbm(nx, ny, 3, 8.0) * 0.5 + 0.5;

      const totalBlend = Math.min(1, sharpGrain * style.variation * 0.8 + broad * 0.06);
      const baseR = br * (1 - totalBlend) + ar * totalBlend;
      const baseG = bg * (1 - totalBlend) + ag * totalBlend;
      const baseB = bb * (1 - totalBlend) + ab * totalBlend;

      const grainDark = (sharpGrain - 0.5) * 55 * style.roughness;
      const fineDark = (fine - 0.5) * 18 * style.roughness;

      const idx = (py * size + px) * 4;
      data[idx] = Math.max(0, Math.min(255, baseR + grainDark + fineDark));
      data[idx + 1] = Math.max(0, Math.min(255, baseG + grainDark * 0.8 + fineDark * 0.85));
      data[idx + 2] = Math.max(0, Math.min(255, baseB + grainDark * 0.5 + fineDark * 0.6));
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/** Stone: craggy fractured surface with sharp edges and pitting. */
function generateStoneTile(size: number, style: FloorStyle): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(size, size);
  const data = imageData.data;
  const [br, bg, bb] = parseHex(style.baseColor);
  const [ar, ag, ab] = parseHex(style.accentColor);
  const v = style.variant * 23.47;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const nx = px / size;
      const ny = py / size;

      const n1 = seamlessFbm(nx + v * 0.01, ny + v * 0.01, 5, 3.0);
      const ridged = 1.0 - Math.abs(n1) * 2.0;
      const sharpRidge = Math.pow(Math.max(0, ridged), 2.0);

      const broad = seamlessFbm(nx, ny, 2, 1.2) * 0.5 + 0.5;
      const pits = seamlessFbm(nx + v * 0.02, ny + v * 0.02, 3, 8.0);
      const pitMask = pits > 0.3 ? (pits - 0.3) * 3.0 : 0;

      const blend = broad * style.variation * 0.6;
      const baseR = br * (1 - blend) + ar * blend;
      const baseG = bg * (1 - blend) + ag * blend;
      const baseB = bb * (1 - blend) + ab * blend;

      const ridgeLight = sharpRidge * 40 * style.roughness;
      const pitDark = pitMask * -30 * style.roughness;

      const idx = (py * size + px) * 4;
      data[idx] = Math.max(0, Math.min(255, baseR + ridgeLight + pitDark));
      data[idx + 1] = Math.max(0, Math.min(255, baseG + ridgeLight * 0.95 + pitDark));
      data[idx + 2] = Math.max(0, Math.min(255, baseB + ridgeLight * 0.9 + pitDark));
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/** Metal: brushed directional streaks with specular highlights. */
function generateMetalTile(size: number, style: FloorStyle): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(size, size);
  const data = imageData.data;
  const [br, bg, bb] = parseHex(style.baseColor);
  const [ar, ag, ab] = parseHex(style.accentColor);
  const v = style.variant * 11.83;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const nx = px / size;
      const ny = py / size;

      const streak1 = seamlessFbm(nx * 0.2 + v * 0.01, ny * 24.0, 3, 1.0) * 0.5 + 0.5;
      const streak2 = seamlessFbm(nx * 0.15 + v * 0.01, ny * 18.0, 2, 1.5) * 0.5 + 0.5;
      const streaks = streak1 * 0.6 + streak2 * 0.4;

      const spec = Math.pow(streaks, 3.0);

      const corrosion = seamlessFbm(nx + v * 0.02, ny + v * 0.02, 3, 4.0);
      const corrMask = corrosion > 0.2 ? (corrosion - 0.2) * 1.5 : 0;

      const blend = corrMask * style.variation;
      const baseR = br * (1 - blend) + ar * blend;
      const baseG = bg * (1 - blend) + ag * blend;
      const baseB = bb * (1 - blend) + ab * blend;

      const streakShift = (streaks - 0.5) * 35 * style.roughness;
      const specHighlight = spec * 50 * style.roughness;

      const idx = (py * size + px) * 4;
      data[idx] = Math.max(0, Math.min(255, baseR + streakShift + specHighlight));
      data[idx + 1] = Math.max(0, Math.min(255, baseG + streakShift + specHighlight));
      data[idx + 2] = Math.max(0, Math.min(255, baseB + streakShift + specHighlight * 1.1));
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/** Marble: veined swirls with smooth polished surface. */
function generateMarbleTile(size: number, style: FloorStyle): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(size, size);
  const data = imageData.data;
  const [br, bg, bb] = parseHex(style.baseColor);
  const [ar, ag, ab] = parseHex(style.accentColor);
  const v = style.variant * 7.93;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const nx = px / size;
      const ny = py / size;

      const turbX = seamlessFbm(nx + v * 0.01, ny + v * 0.01, 4, 2.0) * 0.6;
      const turbY = seamlessFbm(nx + v * 0.02, ny + v * 0.02, 4, 2.5) * 0.6;

      const veinInput = nx * 4.0 + turbX + (ny * 2.0 + turbY);
      const vein = Math.abs(Math.sin(veinInput * Math.PI * 3.0));
      const sharpVein = Math.pow(vein, 4.0);

      const fineVeinInput = nx * 8.0 + turbX * 1.5 + (ny * 6.0 + turbY * 1.2);
      const fineVein = Math.pow(Math.abs(Math.sin(fineVeinInput * Math.PI * 5.0)), 6.0);

      const broad = seamlessFbm(nx, ny, 2, 1.0) * 0.5 + 0.5;

      const veinStrength = (1.0 - sharpVein) * style.variation + fineVein * style.variation * 0.4;
      const blend = broad * 0.2 * style.variation + veinStrength * 0.6;
      const totalBlend = Math.min(1, blend);

      const baseR = br * (1 - totalBlend) + ar * totalBlend;
      const baseG = bg * (1 - totalBlend) + ag * totalBlend;
      const baseB = bb * (1 - totalBlend) + ab * totalBlend;

      const sheen = broad * 12 * style.roughness;

      const idx = (py * size + px) * 4;
      data[idx] = Math.max(0, Math.min(255, baseR + sheen));
      data[idx + 1] = Math.max(0, Math.min(255, baseG + sheen));
      data[idx + 2] = Math.max(0, Math.min(255, baseB + sheen));
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Draws a tiled floor onto a Phaser scene. Supports:
 * - A single tileImage (seamless via GL_REPEAT)
 * - A grid map where each cell references a tile def from a palette
 * - A single defaultTile filling the whole floor
 */
export function buildTileFloorGraphics(
  scene: Phaser.Scene,
  config: {
    width: number;
    height: number;
    tileSize: number;
    tileImage?: string;
    defaultTile: FloorTileDef;
    map?: number[][];
    tiles: FloorTileDef[];
    wallThickness: number;
  },
): { width: number; height: number } {
  const { width, height, tileSize, tileImage, defaultTile, map, tiles, wallThickness } = config;

  if (tileImage && scene.textures.exists(tileImage)) {
    const tileSprite = scene.add.tileSprite(width / 2, height / 2, width, height, tileImage);
    const tex = scene.textures.get(tileImage);
    const srcWidth = tex.getSourceImage().width;
    const scale = tileSize / srcWidth;
    tileSprite.setTileScale(scale, scale);
    tileSprite.setDepth(-1);
  } else if (map && map.length > 0 && tiles.length > 0) {
    renderTileMap(scene, width, height, tileSize, map, tiles, defaultTile, wallThickness);
  } else {
    renderSingleTile(scene, width, height, tileSize, defaultTile);
  }

  drawWalls(scene, width, height, wallThickness);

  scene.physics.world.setBounds(
    wallThickness,
    wallThickness,
    width - wallThickness * 2,
    height - wallThickness * 2,
  );

  return { width, height };
}

/** Fills the entire floor with a single seamless tile type. */
function renderSingleTile(
  scene: Phaser.Scene,
  width: number,
  height: number,
  tileSize: number,
  tileDef: FloorTileDef,
): void {
  const potSize = nearestPOT(tileSize);
  const texKey = tileTexKey(tileDef, potSize);

  if (!scene.textures.exists(texKey)) {
    const canvas = generateSeamlessTileCanvas(potSize, tileDef);
    scene.textures.addCanvas(texKey, canvas);
  }

  const tileSprite = scene.add.tileSprite(width / 2, height / 2, width, height, texKey);
  tileSprite.setDepth(-1);
}

/** Renders a grid map of different tile types onto a single canvas. */
function renderTileMap(
  scene: Phaser.Scene,
  width: number,
  height: number,
  tileSize: number,
  map: number[][],
  tiles: FloorTileDef[],
  defaultTile: FloorTileDef,
  wallThickness: number,
): void {
  const potSize = nearestPOT(tileSize);

  // Pre-generate all unique tile canvases
  const tileCanvases = new Map<string, HTMLCanvasElement>();
  const allDefs = [defaultTile, ...tiles];
  for (const def of allDefs) {
    const key = tileTexKey(def, potSize);
    if (!tileCanvases.has(key)) {
      tileCanvases.set(key, generateSeamlessTileCanvas(potSize, def));
    }
  }

  // Composite onto a full-size canvas
  const fullCanvas = document.createElement('canvas');
  fullCanvas.width = width;
  fullCanvas.height = height;
  const ctx = fullCanvas.getContext('2d')!;

  const cols = Math.ceil((width - wallThickness * 2) / potSize);
  const rows = Math.ceil((height - wallThickness * 2) / potSize);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const mapRow = map[row % map.length];
      const tileIdx = mapRow[col % mapRow.length];
      const def = tileIdx < tiles.length ? tiles[tileIdx] : defaultTile;
      const key = tileTexKey(def, potSize);
      const tileCanvas = tileCanvases.get(key)!;

      const dx = wallThickness + col * potSize;
      const dy = wallThickness + row * potSize;
      ctx.drawImage(tileCanvas, dx, dy);
    }
  }

  const compositeKey = `__tileMapFloor_${width}_${height}`;
  if (scene.textures.exists(compositeKey)) {
    scene.textures.remove(compositeKey);
  }
  scene.textures.addCanvas(compositeKey, fullCanvas);
  const img = scene.add.image(width / 2, height / 2, compositeKey);
  img.setDepth(-1);
}

/** Generates a unique cache key for a tile definition. */
function tileTexKey(def: FloorTileDef, size: number): string {
  return `__tile_${def.texture}_${def.baseColor}_${def.accentColor}_${def.variant}_${size}`;
}

/** Rounds up to nearest power of two (required for GL_REPEAT). */
function nearestPOT(n: number): number {
  let v = Math.max(32, n);
  v--;
  v |= v >> 1;
  v |= v >> 2;
  v |= v >> 4;
  v |= v >> 8;
  v |= v >> 16;
  v++;
  return v;
}

/** Generates a seamless wall tile canvas with a darker, rougher surface. */
function generateSeamlessWallCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(size, size);
  const data = imageData.data;

  const br = 35,
    bg = 32,
    bb = 30;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const nx = px / size;
      const ny = py / size;

      const broad = seamlessFbm(nx, ny, 3, 1.2) * 0.5 + 0.5;
      const medium = seamlessFbm(nx, ny, 4, 2.5) * 0.5 + 0.5;
      const fine = seamlessFbm(nx, ny, 3, 5.0) * 0.5 + 0.5;

      const shift = (broad - 0.5) * 25 + (medium - 0.5) * 15 + (fine - 0.5) * 8;

      const r = br + shift;
      const g = bg + shift * 0.9;
      const b = bb + shift * 0.8;

      const idx = (py * size + px) * 4;
      data[idx] = Math.max(0, Math.min(255, r));
      data[idx + 1] = Math.max(0, Math.min(255, g));
      data[idx + 2] = Math.max(0, Math.min(255, b));
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/** Draws seamless textured wall borders around the room using TileSprite strips. */
function drawWalls(
  scene: Phaser.Scene,
  width: number,
  height: number,
  wallThickness: number,
): void {
  if (wallThickness <= 0) return;

  const potSize = nearestPOT(64);
  const texKey = '__seamlessWall_' + potSize;

  if (!scene.textures.exists(texKey)) {
    const wallCanvas = generateSeamlessWallCanvas(potSize);
    scene.textures.addCanvas(texKey, wallCanvas);
  }

  // Top wall
  const top = scene.add.tileSprite(width / 2, wallThickness / 2, width, wallThickness, texKey);
  top.setDepth(0);

  // Bottom wall
  const bottom = scene.add.tileSprite(
    width / 2,
    height - wallThickness / 2,
    width,
    wallThickness,
    texKey,
  );
  bottom.setDepth(0);

  // Left wall
  const left = scene.add.tileSprite(wallThickness / 2, height / 2, wallThickness, height, texKey);
  left.setDepth(0);

  // Right wall
  const right = scene.add.tileSprite(
    width - wallThickness / 2,
    height / 2,
    wallThickness,
    height,
    texKey,
  );
  right.setDepth(0);

  // Inner edge highlight
  const gfx = scene.add.graphics();
  gfx.setDepth(1);
  gfx.lineStyle(1, 0x111111, 0.6);
  gfx.strokeRect(
    wallThickness,
    wallThickness,
    width - wallThickness * 2,
    height - wallThickness * 2,
  );
}
