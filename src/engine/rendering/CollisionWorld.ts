/** Axis-aligned wall collider in the XZ plane. */
export interface Aabb {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/**
 * Simple XZ slide collision against wall AABBs.
 * Used instead of a full physics engine for arcade-style movement.
 */
export class CollisionWorld {
  walls: Aabb[] = [];
  bounds = { minX: 0, maxX: 40, minZ: 0, maxZ: 30 };

  /** Replace all wall colliders. */
  setWalls(walls: Aabb[]): void {
    this.walls = walls;
  }

  /** Set world bounds the player must stay inside. */
  setBounds(minX: number, maxX: number, minZ: number, maxZ: number): void {
    this.bounds = { minX, maxX, minZ, maxZ };
  }

  /**
   * Move a circle collider by (dx, dz), sliding along walls.
   * Returns the final position.
   */
  moveCircle(
    x: number,
    z: number,
    radius: number,
    dx: number,
    dz: number,
  ): { x: number; z: number } {
    let nx = x + dx;
    let nz = z + dz;

    nx = clamp(nx, this.bounds.minX + radius, this.bounds.maxX - radius);
    nz = clamp(nz, this.bounds.minZ + radius, this.bounds.maxZ - radius);

    for (const w of this.walls) {
      const resolved = resolveCircleAabb(nx, nz, radius, w);
      nx = resolved.x;
      nz = resolved.z;
    }

    return { x: nx, z: nz };
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Push a circle out of an AABB if overlapping. */
function resolveCircleAabb(
  cx: number,
  cz: number,
  radius: number,
  box: Aabb,
): { x: number; z: number } {
  const closestX = clamp(cx, box.minX, box.maxX);
  const closestZ = clamp(cz, box.minZ, box.maxZ);
  const dx = cx - closestX;
  const dz = cz - closestZ;
  const distSq = dx * dx + dz * dz;
  if (distSq >= radius * radius) return { x: cx, z: cz };

  if (distSq < 1e-8) {
    // Center inside box — push out along smallest penetration axis
    const penLeft = Math.abs(cx - box.minX);
    const penRight = Math.abs(box.maxX - cx);
    const penTop = Math.abs(cz - box.minZ);
    const penBottom = Math.abs(box.maxZ - cz);
    const minPen = Math.min(penLeft, penRight, penTop, penBottom);
    if (minPen === penLeft) return { x: box.minX - radius, z: cz };
    if (minPen === penRight) return { x: box.maxX + radius, z: cz };
    if (minPen === penTop) return { x: cx, z: box.minZ - radius };
    return { x: cx, z: box.maxZ + radius };
  }

  const dist = Math.sqrt(distSq);
  const push = (radius - dist) / dist;
  return { x: cx + dx * push, z: cz + dz * push };
}
