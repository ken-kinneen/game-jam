/**
 * Procedural cave layout generator — cellular-automata carving with a guaranteed
 * connectivity pass. Ported from the artgen admin tool's cave-gen.js (a separate
 * design/preview tool in the asset-pipeline repo) into real engine logic, since this
 * is the actual "walkable path" mechanic that needs to drive collision, player spawn,
 * and item placement, not just a preview image.
 *
 * The algorithm, in order:
 *  1. Seeded random fill (~45% wall by default, tuned lower here for open caverns).
 *  2. Smoothing passes (a cell becomes wall if >=5 of its 8 neighbors are wall) —
 *     turns raw noise into organic blob-shaped caves.
 *  3. A widening pass that carves open any remaining 1-tile-wide "pinch" corridors,
 *     so the player never gets stuck in a corridor narrower than their own body.
 *  4. A flood-fill from the entry point, then EVERY unreachable floor tile is pruned
 *     back to wall — this is what guarantees the walkable area is a single connected
 *     region reachable from the entry, not a hope.
 *  5. Exit points chosen from reachable cells far from the entry (for chaining to the
 *     next scene, the same way exits already work elsewhere in this engine).
 *  6. Items placed either in the open (reachable floor) or "behind" a wall tile that
 *     borders the reachable region (flagged breakable — NOTE: no break-wall
 *     interaction exists in the engine yet, so these are generated but not yet
 *     spawned as pickups; see GameScene.spawnProceduralItems).
 */

export const WALL = 0;
export const FLOOR = 1;

export type Grid = number[][];

export interface GridPoint {
  x: number;
  y: number;
}

export interface CaveItem extends GridPoint {
  kind: 'scrap' | 'fuel';
  placement: 'open' | 'behind_wall';
  breaksWall?: GridPoint;
}

export interface CaveMap {
  seed: number;
  width: number;
  height: number;
  grid: Grid;
  entry: GridPoint;
  exits: GridPoint[];
  items: CaveItem[];
  breakableWalls: GridPoint[];
  reachableCount: number;
}

export interface CaveGenOptions {
  seed?: number;
  width?: number;
  height?: number;
  fillRatio?: number;
  smoothIterations?: number;
  widenPasses?: number;
  entry?: GridPoint | null;
  exitCount?: number;
  openItemCount?: number;
  behindWallItemCount?: number;
}

// --- seeded RNG (mulberry32) — deterministic so a given seed always produces the same cave ---
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return function rng(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function inBounds(w: number, h: number, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < w && y < h;
}

function countWallNeighbors(grid: Grid, w: number, h: number, x: number, y: number): number {
  let count = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(w, h, nx, ny) || grid[ny][nx] === WALL) count++;
    }
  }
  return count;
}

function randomFill(rng: () => number, w: number, h: number, fillRatio: number): Grid {
  const grid: Grid = [];
  for (let y = 0; y < h; y++) {
    const row: number[] = [];
    for (let x = 0; x < w; x++) {
      const isBorder = x === 0 || y === 0 || x === w - 1 || y === h - 1;
      row.push(isBorder || rng() < fillRatio ? WALL : FLOOR);
    }
    grid.push(row);
  }
  return grid;
}

function smooth(grid: Grid, w: number, h: number, iterations: number): Grid {
  let current = grid;
  for (let i = 0; i < iterations; i++) {
    const next = current.map((row) => row.slice());
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const walls = countWallNeighbors(current, w, h, x, y);
        next[y][x] = walls >= 5 ? WALL : FLOOR;
      }
    }
    current = next;
  }
  return current;
}

function widenCorridors(grid: Grid, w: number, h: number, passes: number): void {
  for (let p = 0; p < passes; p++) {
    const toOpen: GridPoint[] = [];
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        if (grid[y][x] !== FLOOR) continue;
        const left = grid[y][x - 1] === FLOOR;
        const right = grid[y][x + 1] === FLOOR;
        const up = grid[y - 1][x] === FLOOR;
        const down = grid[y + 1][x] === FLOOR;

        if (left && right && !up && !down) {
          if (y + 2 < h - 1) toOpen.push({ x, y: y + 1 });
        } else if (up && down && !left && !right) {
          if (x + 2 < w - 1) toOpen.push({ x: x + 1, y });
        }
      }
    }
    for (const { x, y } of toOpen) grid[y][x] = FLOOR;
    if (toOpen.length === 0) break;
  }
}

function floodFill(
  grid: Grid,
  w: number,
  h: number,
  start: GridPoint,
): { reachable: Set<string>; dist: Map<string, number> } {
  const key = (x: number, y: number): string => `${x},${y}`;
  const reachable = new Set<string>();
  const dist = new Map<string, number>();
  if (grid[start.y]?.[start.x] !== FLOOR) return { reachable, dist };

  const queue: GridPoint[] = [start];
  reachable.add(key(start.x, start.y));
  dist.set(key(start.x, start.y), 0);

  while (queue.length) {
    const { x, y } = queue.shift()!;
    const d = dist.get(key(x, y))!;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(w, h, nx, ny) || grid[ny][nx] !== FLOOR) continue;
      const k = key(nx, ny);
      if (reachable.has(k)) continue;
      reachable.add(k);
      dist.set(k, d + 1);
      queue.push({ x: nx, y: ny });
    }
  }
  return { reachable, dist };
}

/** Forces every non-reachable floor tile back to wall — the connectivity guarantee. */
function pruneUnreachable(grid: Grid, w: number, h: number, reachable: Set<string>): void {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (grid[y][x] === FLOOR && !reachable.has(`${x},${y}`)) {
        grid[y][x] = WALL;
      }
    }
  }
}

function pickExits(
  w: number,
  h: number,
  reachable: Set<string>,
  dist: Map<string, number>,
  count: number,
): GridPoint[] {
  const candidates = [...reachable]
    .map((k) => {
      const [x, y] = k.split(',').map(Number);
      return { x, y, d: dist.get(k)! };
    })
    .filter((c) => c.d > 2)
    .sort((a, b) => b.d - a.d);

  const picked: GridPoint[] = [];
  const minSpacing = Math.max(3, Math.floor(Math.min(w, h) / 6));
  for (const c of candidates) {
    if (picked.length >= count) break;
    const tooClose = picked.some((p) => Math.hypot(p.x - c.x, p.y - c.y) < minSpacing);
    if (!tooClose) picked.push({ x: c.x, y: c.y });
  }
  return picked;
}

function shuffle<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function placeItems(
  grid: Grid,
  w: number,
  h: number,
  reachable: Set<string>,
  dist: Map<string, number>,
  entry: GridPoint,
  exits: GridPoint[],
  openCount: number,
  behindWallCount: number,
  rng: () => number,
): { items: CaveItem[]; breakableWalls: GridPoint[] } {
  const items: CaveItem[] = [];
  const breakableWalls: GridPoint[] = [];
  const excluded = new Set([`${entry.x},${entry.y}`, ...exits.map((e) => `${e.x},${e.y}`)]);
  const kinds: CaveItem['kind'][] = ['scrap', 'fuel'];

  const openCandidates = [...reachable]
    .map((k) => {
      const [x, y] = k.split(',').map(Number);
      return { x, y, d: dist.get(k)! };
    })
    .filter((c) => c.d > 1 && !excluded.has(`${c.x},${c.y}`));
  shuffle(openCandidates, rng);

  const minSpacing = 2;
  const placedOpen: GridPoint[] = [];
  for (const c of openCandidates) {
    if (placedOpen.length >= openCount) break;
    const tooClose = placedOpen.some((p) => Math.hypot(p.x - c.x, p.y - c.y) < minSpacing);
    if (tooClose) continue;
    placedOpen.push(c);
    items.push({
      x: c.x,
      y: c.y,
      kind: kinds[Math.floor(rng() * kinds.length)],
      placement: 'open',
    });
  }

  const wallCandidates: { wall: GridPoint; itemPos: GridPoint }[] = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (grid[y][x] !== WALL) continue;
      const neighbors = [
        { x: x + 1, y },
        { x: x - 1, y },
        { x, y: y + 1 },
        { x, y: y - 1 },
      ];
      const reachableNeighbors = neighbors.filter((n) => reachable.has(`${n.x},${n.y}`));
      const beyond = neighbors.find(
        (n) =>
          inBounds(w, h, n.x, n.y) && grid[n.y]?.[n.x] === WALL && !reachable.has(`${n.x},${n.y}`),
      );
      if (reachableNeighbors.length > 0 && beyond) {
        wallCandidates.push({ wall: { x, y }, itemPos: beyond });
      }
    }
  }
  shuffle(wallCandidates, rng);
  for (let i = 0; i < Math.min(behindWallCount, wallCandidates.length); i++) {
    const { wall, itemPos } = wallCandidates[i];
    breakableWalls.push(wall);
    items.push({
      x: itemPos.x,
      y: itemPos.y,
      kind: kinds[Math.floor(rng() * kinds.length)],
      placement: 'behind_wall',
      breaksWall: wall,
    });
  }

  return { items, breakableWalls };
}

function findNearestFloor(grid: Grid, w: number, h: number, from: GridPoint): GridPoint | null {
  const { reachable } = floodFill(grid, w, h, from);
  if (reachable.size > 0) return from;

  const queue: GridPoint[] = [from];
  const seen = new Set([`${from.x},${from.y}`]);
  while (queue.length) {
    const { x, y } = queue.shift()!;
    if (inBounds(w, h, x, y) && grid[y][x] === FLOOR) return { x, y };
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      const k = `${nx},${ny}`;
      if (inBounds(w, h, nx, ny) && !seen.has(k)) {
        seen.add(k);
        queue.push({ x: nx, y: ny });
      }
    }
  }
  return null;
}

function carveOpen(grid: Grid, w: number, h: number, center: GridPoint, radius: number): void {
  for (let y = center.y - radius; y <= center.y + radius; y++) {
    for (let x = center.x - radius; x <= center.x + radius; x++) {
      if (inBounds(w, h, x, y) && x > 0 && y > 0 && x < w - 1 && y < h - 1) {
        grid[y][x] = FLOOR;
      }
    }
  }
}

/**
 * Generates one cave map. Pass the previous scene's chosen exit as `entry` to chain
 * maps logically (each cave has its own coordinate space — this is NOT literal
 * spatial continuity, the same way this engine's exits:[{to,position}] already work).
 */
export function generateCave(options: CaveGenOptions = {}): CaveMap {
  const {
    seed = Date.now() & 0xffffffff,
    width = 48,
    height = 32,
    fillRatio = 0.4,
    smoothIterations = 6,
    widenPasses = 2,
    entry = null,
    exitCount = 2,
    openItemCount = 8,
    behindWallItemCount = 3,
  } = options;

  const rng = makeRng(seed);
  const grid = randomFill(rng, width, height, fillRatio);
  const smoothed = smooth(grid, width, height, smoothIterations);
  widenCorridors(smoothed, width, height, widenPasses);

  const entryPoint =
    entry ?? findNearestFloor(smoothed, width, height, { x: Math.floor(width / 2), y: height - 2 });
  if (!entryPoint) {
    // Degenerate seed (rare) — recurse with a nudged seed rather than failing.
    return generateCave({ ...options, seed: seed + 1 });
  }
  carveOpen(smoothed, width, height, entryPoint, 1);

  const { reachable, dist } = floodFill(smoothed, width, height, entryPoint);
  pruneUnreachable(smoothed, width, height, reachable);

  const exits = pickExits(width, height, reachable, dist, exitCount);
  const { items, breakableWalls } = placeItems(
    smoothed,
    width,
    height,
    reachable,
    dist,
    entryPoint,
    exits,
    openItemCount,
    behindWallItemCount,
    rng,
  );

  return {
    seed,
    width,
    height,
    grid: smoothed,
    entry: entryPoint,
    exits,
    items,
    breakableWalls,
    reachableCount: reachable.size,
  };
}
