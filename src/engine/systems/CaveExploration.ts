export interface CaveGridPoint {
  readonly x: number;
  readonly y: number;
}

export interface CaveWorldPoint {
  readonly x: number;
  readonly y: number;
}

/** Grid data shared by cave generation, the player scene, and the HUD minimap. */
export interface CaveMinimapMap {
  readonly width: number;
  readonly height: number;
  readonly grid: readonly (readonly number[])[];
  readonly tileSize: number;
  readonly entry?: CaveGridPoint;
  readonly exits?: readonly CaveGridPoint[];
}

export interface CaveMinimapSnapshot {
  readonly map: CaveMinimapMap;
  readonly playerX: number;
  readonly playerY: number;
  readonly visibilityRadius: number;
  readonly poweredCableSegments?: readonly (readonly CaveWorldPoint[])[];
  readonly cableRevision?: number;
}

const MIN_REVEAL_RADIUS = 1;
const MINIMAP_VISIBILITY_SCALE = 1;

/** Converts the lamp's visible world-space radius into minimap tiles. */
export function lightRadiusToRevealRadius(lightRadius: number, tileSize: number): number {
  return Math.max(
    MIN_REVEAL_RADIUS,
    Math.round((Math.max(0, lightRadius) * MINIMAP_VISIBILITY_SCALE) / tileSize),
  );
}

/**
 * Tracks the cells a player has discovered. Visibility is calculated only when
 * the player enters a new grid cell, and walls block revelation behind them.
 */
export class CaveExploration {
  private readonly revealed: Uint8Array;
  private readonly visible: Uint8Array;
  private lastCellX = Number.NaN;
  private lastCellY = Number.NaN;
  private lastRevealRadius = Number.NaN;

  constructor(
    readonly map: CaveMinimapMap,
    private readonly defaultRevealRadius = 5,
  ) {
    this.revealed = new Uint8Array(map.width * map.height);
    this.visible = new Uint8Array(map.width * map.height);
  }

  revealAtWorld(worldX: number, worldY: number, revealRadius = this.defaultRevealRadius): boolean {
    return this.revealAtCell(
      Math.floor(worldX / this.map.tileSize),
      Math.floor(worldY / this.map.tileSize),
      revealRadius,
    );
  }

  revealAtCell(cellX: number, cellY: number, revealRadius = this.defaultRevealRadius): boolean {
    if (!this.inBounds(cellX, cellY)) return false;
    const radius = Math.max(0, Math.round(revealRadius));
    if (cellX === this.lastCellX && cellY === this.lastCellY && radius === this.lastRevealRadius) {
      return false;
    }

    this.lastCellX = cellX;
    this.lastCellY = cellY;
    this.lastRevealRadius = radius;
    this.visible.fill(0);

    const radiusSq = radius * radius;

    for (let y = cellY - radius; y <= cellY + radius; y++) {
      for (let x = cellX - radius; x <= cellX + radius; x++) {
        const dx = x - cellX;
        const dy = y - cellY;
        if (!this.inBounds(x, y) || dx * dx + dy * dy > radiusSq) continue;
        if (!this.hasLineOfSight(cellX, cellY, x, y)) continue;

        const index = this.indexOf(x, y);
        this.visible[index] = 1;
        this.revealed[index] = 1;
      }
    }

    return true;
  }

  isRevealed(x: number, y: number): boolean {
    return this.inBounds(x, y) && this.revealed[this.indexOf(x, y)] === 1;
  }

  isVisible(x: number, y: number): boolean {
    return this.inBounds(x, y) && this.visible[this.indexOf(x, y)] === 1;
  }

  private hasLineOfSight(fromX: number, fromY: number, toX: number, toY: number): boolean {
    let x = fromX;
    let y = fromY;
    const dx = Math.abs(toX - fromX);
    const dy = Math.abs(toY - fromY);
    const stepX = fromX < toX ? 1 : -1;
    const stepY = fromY < toY ? 1 : -1;
    let error = dx - dy;

    while (x !== toX || y !== toY) {
      const doubledError = error * 2;
      if (doubledError > -dy) {
        error -= dy;
        x += stepX;
      }
      if (doubledError < dx) {
        error += dx;
        y += stepY;
      }

      // The blocking wall itself is visible, but cells behind it are not.
      if ((x !== toX || y !== toY) && this.map.grid[y][x] === 0) return false;
    }

    return true;
  }

  private inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.map.width && y < this.map.height;
  }

  private indexOf(x: number, y: number): number {
    return y * this.map.width + x;
  }
}
