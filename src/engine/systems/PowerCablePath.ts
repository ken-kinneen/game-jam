export interface CablePoint {
  readonly x: number;
  readonly y: number;
}

export type PoweredCableSegment = readonly CablePoint[];

/** Pure path model for a cable that trails the player and locks when powered. */
export class PowerCablePath {
  private activePoints: CablePoint[];
  private readonly powered: CablePoint[][] = [];
  private pathRevision = 0;

  constructor(
    start: CablePoint,
    private readonly sampleDistance: number,
  ) {
    if (sampleDistance <= 0) throw new Error('Cable sample distance must be positive');
    this.activePoints = [{ ...start }];
  }

  record(point: CablePoint): boolean {
    const last = this.activePoints[this.activePoints.length - 1];
    if (distanceSquared(last, point) < this.sampleDistance * this.sampleDistance) return false;
    this.activePoints.push({ ...point });
    return true;
  }

  energizeAt(point: CablePoint): void {
    const last = this.activePoints[this.activePoints.length - 1];
    if (distanceSquared(last, point) > 1) this.activePoints.push({ ...point });

    if (this.activePoints.length > 1) {
      this.powered.push(this.activePoints.map((entry) => ({ ...entry })));
      this.pathRevision++;
    }
    this.activePoints = [{ ...point }];
  }

  isNearPoweredCable(point: CablePoint, radius: number): boolean {
    const radiusSquared = radius * radius;
    return this.powered.some((segment) => {
      for (let i = 1; i < segment.length; i++) {
        if (pointToSegmentDistanceSquared(point, segment[i - 1], segment[i]) <= radiusSquared) {
          return true;
        }
      }
      return false;
    });
  }

  get activeSegment(): PoweredCableSegment {
    return this.activePoints;
  }

  get poweredSegments(): readonly PoweredCableSegment[] {
    return this.powered;
  }

  get revision(): number {
    return this.pathRevision;
  }
}

function distanceSquared(a: CablePoint, b: CablePoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return dx * dx + dy * dy;
}

function pointToSegmentDistanceSquared(
  point: CablePoint,
  start: CablePoint,
  end: CablePoint,
): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return distanceSquared(point, start);

  const rawProjection = ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy);
  const projection = Math.max(0, Math.min(1, rawProjection));
  const nearest = { x: start.x + dx * projection, y: start.y + dy * projection };
  return distanceSquared(point, nearest);
}
