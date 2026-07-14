import {
  CaveExploration,
  lightRadiusToRevealRadius,
  type CaveMinimapMap,
  type CaveMinimapSnapshot,
} from '../systems/CaveExploration';

const MINIMAP_WIDTH = 240;
const MINIMAP_HEIGHT = 150;
const PANEL_PADDING = 10;
const FOLLOW_CELL_SIZE = 5;
const EXPANDED_MARGIN = 96;
const EXPANDED_MAX_WIDTH = 1100;
const EXPANDED_MAX_HEIGHT = 800;

/**
 * Preserved cave-map renderer used by UIScene when its feature flag is enabled.
 * CaveExploration owns fog-of-war state, so revealed cells remain known while
 * current visibility continues to shrink and grow with lamp fuel. In compact
 * mode the map follows the player inside a clipped top-right viewport; expanded
 * mode fits the explored cave into a centered overlay. Entry, exit, player, and
 * energized-cable markers are drawn only from snapshot data supplied by
 * GameScene, keeping this renderer independent from cave gameplay systems.
 */
export class CaveMinimap {
  private readonly backdrop: Phaser.GameObjects.Graphics;
  private readonly background: Phaser.GameObjects.Graphics;
  private readonly mapGraphics: Phaser.GameObjects.Graphics;
  private readonly markerGraphics: Phaser.GameObjects.Graphics;
  private readonly clipShape: Phaser.GameObjects.Graphics;

  private map: CaveMinimapMap | null = null;
  private exploration: CaveExploration | null = null;
  private active = false;
  private unlocked = true;
  private expanded = false;
  private mapX = 0;
  private mapY = 0;
  private viewportX = 0;
  private viewportY = 0;
  private viewportWidth = 0;
  private viewportHeight = 0;
  private cellScale = FOLLOW_CELL_SIZE;
  private lastPlayerX = 0;
  private lastPlayerY = 0;
  private poweredCableSegments: CaveMinimapSnapshot['poweredCableSegments'] = [];
  private cableRevision = -1;

  constructor(private readonly scene: Phaser.Scene) {
    this.backdrop = scene.add.graphics().setScrollFactor(0).setDepth(109);
    this.background = scene.add.graphics().setScrollFactor(0).setDepth(110);
    this.mapGraphics = scene.add.graphics().setScrollFactor(0).setDepth(111);
    this.markerGraphics = scene.add.graphics().setScrollFactor(0).setDepth(113);

    this.clipShape = scene.make.graphics();
    const clipMask = this.clipShape.createGeometryMask();
    this.mapGraphics.setMask(clipMask);
    this.markerGraphics.setMask(clipMask);

    this.applyLayout();
    this.setVisible(false);
  }

  get isExpanded(): boolean {
    return this.expanded;
  }

  setActive(active: boolean): void {
    this.active = active;
    if (!active) {
      this.expanded = false;
      this.setMap(null);
    }
    this.applyLayout();
    this.applyVisibility();
  }

  setUnlocked(unlocked: boolean): void {
    this.unlocked = unlocked;
    if (!unlocked) this.expanded = false;
    this.applyLayout();
    this.applyVisibility();
  }

  setExpanded(expanded: boolean): void {
    const next = this.active && this.unlocked && expanded;
    if (this.expanded === next) return;

    this.expanded = next;
    this.applyLayout();
    this.applyVisibility();
  }

  toggleExpanded(): boolean {
    this.setExpanded(!this.expanded);
    return this.expanded;
  }

  sync(snapshot: CaveMinimapSnapshot | null): void {
    if (!this.active || !snapshot) {
      if (!snapshot) this.setMap(null);
      return;
    }

    this.lastPlayerX = snapshot.playerX;
    this.lastPlayerY = snapshot.playerY;
    if (snapshot.map !== this.map) this.setMap(snapshot.map);
    if (!this.exploration) return;

    const cableChanged = (snapshot.cableRevision ?? -1) !== this.cableRevision;
    if (cableChanged) {
      this.cableRevision = snapshot.cableRevision ?? -1;
      this.poweredCableSegments = snapshot.poweredCableSegments ?? [];
    }

    this.positionMap(snapshot.playerX, snapshot.playerY);
    const revealRadius = lightRadiusToRevealRadius(
      snapshot.visibilityRadius,
      snapshot.map.tileSize,
    );
    if (
      cableChanged ||
      this.exploration.revealAtWorld(snapshot.playerX, snapshot.playerY, revealRadius)
    ) {
      this.drawExploredMap();
    }
    this.drawPlayer(snapshot.playerX, snapshot.playerY);
  }

  private setMap(map: CaveMinimapMap | null): void {
    if (map === this.map) return;

    this.map = map;
    this.exploration = map ? new CaveExploration(map) : null;
    this.poweredCableSegments = [];
    this.cableRevision = -1;
    this.mapGraphics.clear();
    this.markerGraphics.clear();
    this.applyLayout();
    this.applyVisibility();
  }

  private applyLayout(): void {
    const camera = this.scene.cameras.main;
    const panelWidth = this.expanded
      ? Math.min(camera.width - EXPANDED_MARGIN * 2, EXPANDED_MAX_WIDTH)
      : MINIMAP_WIDTH;
    const panelHeight = this.expanded
      ? Math.min(camera.height - EXPANDED_MARGIN * 2, EXPANDED_MAX_HEIGHT)
      : MINIMAP_HEIGHT;
    const panelX = this.expanded ? (camera.width - panelWidth) / 2 : camera.width - panelWidth - 32;
    const panelY = this.expanded ? (camera.height - panelHeight) / 2 : 32;

    this.viewportX = panelX + PANEL_PADDING;
    this.viewportY = panelY + PANEL_PADDING;
    this.viewportWidth = panelWidth - PANEL_PADDING * 2;
    this.viewportHeight = panelHeight - PANEL_PADDING * 2;
    this.cellScale =
      this.expanded && this.map
        ? Math.min(this.viewportWidth / this.map.width, this.viewportHeight / this.map.height)
        : FOLLOW_CELL_SIZE;

    this.backdrop.clear();
    if (this.expanded) {
      this.backdrop.fillStyle(0x000000, 0.68);
      this.backdrop.fillRect(0, 0, camera.width, camera.height);
    }

    this.background.clear();
    this.background.fillStyle(0x050708, this.expanded ? 0.96 : 0.84);
    this.background.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 10);
    this.background.lineStyle(2, 0x8f7a4b, 0.9);
    this.background.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 10);

    this.clipShape.clear();
    this.clipShape.fillStyle(0xffffff, 1);
    this.clipShape.fillRect(
      this.viewportX,
      this.viewportY,
      this.viewportWidth,
      this.viewportHeight,
    );

    if (this.map) {
      this.positionMap(this.lastPlayerX, this.lastPlayerY);
      this.drawExploredMap();
      this.drawPlayer(this.lastPlayerX, this.lastPlayerY);
    }
  }

  private positionMap(worldX: number, worldY: number): void {
    if (!this.map) return;

    const contentWidth = this.map.width * this.cellScale;
    const contentHeight = this.map.height * this.cellScale;
    const playerCellX = worldX / this.map.tileSize;
    const playerCellY = worldY / this.map.tileSize;
    const desiredX = this.viewportX + this.viewportWidth / 2 - playerCellX * this.cellScale;
    const desiredY = this.viewportY + this.viewportHeight / 2 - playerCellY * this.cellScale;

    this.mapX =
      contentWidth <= this.viewportWidth
        ? this.viewportX + (this.viewportWidth - contentWidth) / 2
        : Phaser.Math.Clamp(
            desiredX,
            this.viewportX + this.viewportWidth - contentWidth,
            this.viewportX,
          );
    this.mapY =
      contentHeight <= this.viewportHeight
        ? this.viewportY + (this.viewportHeight - contentHeight) / 2
        : Phaser.Math.Clamp(
            desiredY,
            this.viewportY + this.viewportHeight - contentHeight,
            this.viewportY,
          );

    this.mapGraphics.setPosition(this.mapX, this.mapY);
  }

  private drawExploredMap(): void {
    if (!this.map || !this.exploration) return;

    this.mapGraphics.clear();
    for (let y = 0; y < this.map.height; y++) {
      for (let x = 0; x < this.map.width; x++) {
        if (!this.exploration.isRevealed(x, y)) continue;

        const isFloor = this.map.grid[y][x] === 1;
        const isVisible = this.exploration.isVisible(x, y);
        const color = isFloor ? (isVisible ? 0xa99c7b : 0x5c574a) : isVisible ? 0x454a4b : 0x25292a;
        this.mapGraphics.fillStyle(color, isVisible ? 1 : 0.82);
        this.mapGraphics.fillRect(
          x * this.cellScale,
          y * this.cellScale,
          this.cellScale + 0.25,
          this.cellScale + 0.25,
        );
      }
    }

    if (this.map.entry && this.exploration.isRevealed(this.map.entry.x, this.map.entry.y)) {
      this.drawLocation(this.map.entry.x, this.map.entry.y, 0x7bcf89);
    }
    for (const exit of this.map.exits ?? []) {
      if (this.exploration.isRevealed(exit.x, exit.y)) {
        this.drawLocation(exit.x, exit.y, 0xe8b84b);
      }
    }
    this.drawPoweredCable();
  }

  private drawPoweredCable(): void {
    if (!this.map) return;
    const scale = this.cellScale / this.map.tileSize;
    for (const segment of this.poweredCableSegments ?? []) {
      if (segment.length < 2) continue;
      this.mapGraphics.lineStyle(Math.max(1.5, this.cellScale * 0.35), 0xffb52e, 0.95);
      this.mapGraphics.beginPath();
      this.mapGraphics.moveTo(segment[0].x * scale, segment[0].y * scale);
      for (let i = 1; i < segment.length; i++) {
        this.mapGraphics.lineTo(segment[i].x * scale, segment[i].y * scale);
      }
      this.mapGraphics.strokePath();
    }
  }

  private drawLocation(x: number, y: number, color: number): void {
    const size = Math.max(2, this.cellScale * 1.6);
    this.mapGraphics.fillStyle(color, 1);
    this.mapGraphics.fillRect(
      (x + 0.5) * this.cellScale - size / 2,
      (y + 0.5) * this.cellScale - size / 2,
      size,
      size,
    );
  }

  private drawPlayer(worldX: number, worldY: number): void {
    if (!this.map) return;

    const x = Phaser.Math.Clamp(worldX / this.map.tileSize, 0, this.map.width);
    const y = Phaser.Math.Clamp(worldY / this.map.tileSize, 0, this.map.height);
    const radius = Math.max(3, this.cellScale * 0.7);

    this.markerGraphics.clear();
    this.markerGraphics.fillStyle(0xfff0a8, 1);
    this.markerGraphics.fillCircle(
      this.mapX + x * this.cellScale,
      this.mapY + y * this.cellScale,
      radius,
    );
    this.markerGraphics.lineStyle(2, 0x4b3212, 1);
    this.markerGraphics.strokeCircle(
      this.mapX + x * this.cellScale,
      this.mapY + y * this.cellScale,
      radius,
    );
  }

  private applyVisibility(): void {
    this.setVisible(this.active && this.unlocked && this.map !== null);
  }

  private setVisible(visible: boolean): void {
    this.backdrop.setVisible(visible && this.expanded);
    this.background.setVisible(visible);
    this.mapGraphics.setVisible(visible);
    this.markerGraphics.setVisible(visible);
  }
}
