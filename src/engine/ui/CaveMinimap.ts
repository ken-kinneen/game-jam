import {
  CaveExploration,
  lightRadiusToRevealRadius,
  type CaveMinimapMap,
  type CaveMinimapSnapshot,
} from '../systems/CaveExploration';

const PANEL_WIDTH = 240;
const PANEL_HEIGHT = 170;
const PANEL_PADDING = 10;
const LABEL_HEIGHT = 30;

/** Screen-space cave map with exploration-based fog of war. */
export class CaveMinimap {
  private readonly background: Phaser.GameObjects.Graphics;
  private readonly mapGraphics: Phaser.GameObjects.Graphics;
  private readonly markerGraphics: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;

  private map: CaveMinimapMap | null = null;
  private exploration: CaveExploration | null = null;
  private active = false;
  private mapX = 0;
  private mapY = 0;
  private cellScale = 1;

  constructor(private readonly scene: Phaser.Scene) {
    const panelX = scene.cameras.main.width - PANEL_WIDTH - 32;
    const panelY = 32;

    this.background = scene.add.graphics().setScrollFactor(0).setDepth(110);
    this.background.fillStyle(0x050708, 0.84);
    this.background.fillRoundedRect(panelX, panelY, PANEL_WIDTH, PANEL_HEIGHT, 10);
    this.background.lineStyle(2, 0x8f7a4b, 0.9);
    this.background.strokeRoundedRect(panelX, panelY, PANEL_WIDTH, PANEL_HEIGHT, 10);

    this.label = scene.add
      .text(panelX + PANEL_PADDING, panelY + 8, 'CAVE MAP', {
        fontFamily: '"Courier New", monospace',
        fontSize: '18px',
        color: '#d9bd78',
        fontStyle: 'bold',
      })
      .setScrollFactor(0)
      .setDepth(112);

    this.mapGraphics = scene.add.graphics().setScrollFactor(0).setDepth(111);
    this.markerGraphics = scene.add.graphics().setScrollFactor(0).setDepth(113);
    this.setVisible(false);
  }

  setActive(active: boolean): void {
    this.active = active;
    if (!active) this.setMap(null);
    this.applyVisibility();
  }

  sync(snapshot: CaveMinimapSnapshot | null): void {
    if (!this.active || !snapshot) {
      if (!snapshot) this.setMap(null);
      return;
    }

    if (snapshot.map !== this.map) this.setMap(snapshot.map);
    if (!this.exploration) return;

    const revealRadius = lightRadiusToRevealRadius(
      snapshot.visibilityRadius,
      snapshot.map.tileSize,
    );
    if (this.exploration.revealAtWorld(snapshot.playerX, snapshot.playerY, revealRadius)) {
      this.drawExploredMap();
    }
    this.drawPlayer(snapshot.playerX, snapshot.playerY);
  }

  private setMap(map: CaveMinimapMap | null): void {
    if (map === this.map) return;

    this.map = map;
    this.exploration = map ? new CaveExploration(map) : null;
    this.mapGraphics.clear();
    this.markerGraphics.clear();

    if (map) {
      const panelX = this.scene.cameras.main.width - PANEL_WIDTH - 32;
      const panelY = 32;
      const availableWidth = PANEL_WIDTH - PANEL_PADDING * 2;
      const availableHeight = PANEL_HEIGHT - LABEL_HEIGHT - PANEL_PADDING;
      this.cellScale = Math.min(availableWidth / map.width, availableHeight / map.height);
      const renderedWidth = map.width * this.cellScale;
      const renderedHeight = map.height * this.cellScale;
      this.mapX = panelX + (PANEL_WIDTH - renderedWidth) / 2;
      this.mapY = panelY + LABEL_HEIGHT + (availableHeight - renderedHeight) / 2;
    }

    this.applyVisibility();
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
          this.mapX + x * this.cellScale,
          this.mapY + y * this.cellScale,
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
  }

  private drawLocation(x: number, y: number, color: number): void {
    const size = Math.max(2, this.cellScale * 1.6);
    this.mapGraphics.fillStyle(color, 1);
    this.mapGraphics.fillRect(
      this.mapX + (x + 0.5) * this.cellScale - size / 2,
      this.mapY + (y + 0.5) * this.cellScale - size / 2,
      size,
      size,
    );
  }

  private drawPlayer(worldX: number, worldY: number): void {
    if (!this.map) return;

    const x = Phaser.Math.Clamp(worldX / this.map.tileSize, 0, this.map.width);
    const y = Phaser.Math.Clamp(worldY / this.map.tileSize, 0, this.map.height);
    const radius = Math.max(3, this.cellScale * 1.4);

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
    this.setVisible(this.active && this.map !== null);
  }

  private setVisible(visible: boolean): void {
    this.background.setVisible(visible);
    this.mapGraphics.setVisible(visible);
    this.markerGraphics.setVisible(visible);
    this.label.setVisible(visible);
  }
}
