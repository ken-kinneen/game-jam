import { eventBus } from '../core/EventBus';
import { PowerCablePath, type PoweredCableSegment } from './PowerCablePath';

const CABLE_TEXTURE = 'effects/power_cable';
const CABLE_HEIGHT = 10;
const CABLE_OVERLAP = 3;

export interface PowerCableConfig {
  sampleDistance: number;
  poweredRadius: number;
  fuelBurnMultiplier: number;
}

/** Draws the player's cable trail and exposes the powered fuel-saving zone. */
export class PowerCableSystem {
  private readonly path: PowerCablePath;
  private activeCableSprites: Phaser.GameObjects.TileSprite[] = [];
  private poweredCableSprites: Phaser.GameObjects.TileSprite[] = [];
  private readonly poweredGlow: Phaser.GameObjects.Graphics;
  private readonly unsubTransformer: () => void;
  private nearPoweredCable = false;
  private renderedActiveEdges = 0;
  private activeTextureOffset = 0;
  private destroyed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Phaser.Physics.Arcade.Sprite,
    private readonly config: PowerCableConfig,
  ) {
    this.path = new PowerCablePath({ x: player.x, y: player.y }, config.sampleDistance);
    this.poweredGlow = scene.add.graphics().setDepth(801);
    this.unsubTransformer = eventBus.on('transformer:activated', ({ x, y }) => {
      this.recordActivePoint({ x: this.player.x, y: this.player.y });
      this.path.energizeAt({ x, y });
      const poweredSegment = this.path.poweredSegments.at(-1);
      if (poweredSegment) {
        this.appendActiveEdges(poweredSegment);
        this.promoteActiveCable();
        this.drawPoweredGlow();
      }
    });
  }

  update(): void {
    this.recordActivePoint({ x: this.player.x, y: this.player.y });

    const nearPoweredCable = this.path.isNearPoweredCable(
      { x: this.player.x, y: this.player.y },
      this.config.poweredRadius,
    );
    if (nearPoweredCable !== this.nearPoweredCable) {
      this.nearPoweredCable = nearPoweredCable;
      eventBus.emit('cable:proximity_changed', {
        powered: nearPoweredCable,
        fuelMultiplier: this.fuelBurnMultiplier,
      });
    }
  }

  get fuelBurnMultiplier(): number {
    return this.nearPoweredCable ? this.config.fuelBurnMultiplier : 1;
  }

  get poweredSegments(): readonly PoweredCableSegment[] {
    return this.path.poweredSegments;
  }

  get revision(): number {
    return this.path.revision;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.unsubTransformer();
    this.destroyCableSprites();
    this.poweredGlow.destroy();
  }

  private recordActivePoint(point: { x: number; y: number }): void {
    if (!this.path.record(point)) return;
    this.appendActiveEdges(this.path.activeSegment);
  }

  private appendActiveEdges(points: PoweredCableSegment): void {
    const textureHeight = this.scene.textures.get(CABLE_TEXTURE).getSourceImage().height;
    const tileScale = CABLE_HEIGHT / textureHeight;

    while (this.renderedActiveEdges < points.length - 1) {
      const i = this.renderedActiveEdges + 1;
      const start = points[i - 1];
      const end = points[i];
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.hypot(dx, dy);
      if (length >= 1) {
        const tile = this.createCableSprite(
          (start.x + end.x) / 2,
          (start.y + end.y) / 2,
          length + CABLE_OVERLAP,
          Math.atan2(dy, dx),
          tileScale,
          this.activeTextureOffset,
        );
        tile.setTint(0x62584c).setAlpha(0.82);
        this.activeCableSprites.push(tile);
        this.activeTextureOffset += length;
      }
      this.renderedActiveEdges++;
    }
  }

  private promoteActiveCable(): void {
    for (const sprite of this.activeCableSprites) {
      sprite.clearTint();
      sprite.setAlpha(1);
      this.poweredCableSprites.push(sprite);
    }
    this.activeCableSprites = [];
    this.renderedActiveEdges = 0;
    this.activeTextureOffset = 0;
  }

  private drawPoweredGlow(): void {
    this.poweredGlow.clear();
    for (const segment of this.path.poweredSegments) {
      this.strokeGlow(segment, 8, 0.12);
      this.strokeGlow(segment, 2, 0.28);
    }
  }

  private strokeGlow(points: PoweredCableSegment, width: number, alpha: number): void {
    if (points.length < 2) return;
    this.poweredGlow.lineStyle(width, 0xffa52e, alpha);
    this.poweredGlow.beginPath();
    this.poweredGlow.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      this.poweredGlow.lineTo(points[i].x, points[i].y);
    }
    this.poweredGlow.strokePath();
  }

  private createCableSprite(
    x: number,
    y: number,
    width: number,
    rotation: number,
    tileScale: number,
    distanceAlongPath: number,
  ): Phaser.GameObjects.TileSprite {
    const tile = this.scene.add.tileSprite(x, y, width, CABLE_HEIGHT, CABLE_TEXTURE);
    tile.setDepth(3);
    tile.setRotation(rotation);
    tile.setTileScale(tileScale, tileScale);
    tile.setTilePosition(distanceAlongPath / tileScale, 0);
    return tile;
  }

  private destroyCableSprites(): void {
    for (const sprite of this.activeCableSprites) sprite.destroy();
    for (const sprite of this.poweredCableSprites) sprite.destroy();
    this.activeCableSprites = [];
    this.poweredCableSprites = [];
  }
}
