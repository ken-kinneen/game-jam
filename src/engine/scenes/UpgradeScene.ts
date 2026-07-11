import { eventBus, type EventGroup } from '../core/EventBus';
import { registry } from '../core/ContentRegistry';
import { inventoryManager } from '../core/InventoryManager';
import type { UpgradeDef } from '../schemas/upgrade.schema';
import { UpgradeSystem } from '../systems/UpgradeSystem';
import type { StatSheet } from '../stats/StatSheet';

const DPR = Math.min(window.devicePixelRatio || 1, 2);

const STAT_LABELS: Record<string, string> = {
  moveSpeed: 'Move Speed',
  pickupRadius: 'Pickup Radius',
  maxHealth: 'Max Health',
  damage: 'Damage',
  attackSpeed: 'Attack Speed',
  carryCapacity: 'Carry Cap.',
  luck: 'Luck',
  glowRadius: 'Lamp Radius',
  fuelBurnRate: 'Fuel Burn',
};

const RARITY_COLORS: Record<string, number> = {
  common: 0x555566,
  uncommon: 0x447744,
  rare: 0x4455aa,
  legendary: 0xaa6633,
};

const RARITY_GLOW: Record<string, number> = {
  common: 0x666677,
  uncommon: 0x55aa55,
  rare: 0x5566cc,
  legendary: 0xcc8844,
};

const BEHAVIOR_COLORS: Record<string, number> = {
  lamp_color_blue: 0x66aaff,
  lamp_color_purple: 0xcc66ff,
  lamp_color_orange: 0xff8822,
};

/** Formats a stat name into a readable label. */
function statLabel(stat: string): string {
  return STAT_LABELS[stat] ?? stat.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
}

/** Scales a pixel value by DPR and returns a CSS font-size string. */
function fontSize(px: number): string {
  return `${Math.round(px * DPR)}px`;
}

/** Hex number to CSS color string. */
function hexColor(hex: number): string {
  return '#' + hex.toString(16).padStart(6, '0');
}

const LEFT_RATIO = 0.58;
const MARGIN = Math.round(40 * DPR);
const INNER_PAD = Math.round(16 * DPR);
const CARD_HEIGHT = Math.round(72 * DPR);
const CARD_GAP = Math.round(8 * DPR);
const SCROLL_SPEED = Math.round(40 * DPR);

/** Full-screen upgrade menu: scrollable list on left, character + stats on right. */
export class UpgradeScene extends Phaser.Scene {
  private eventGroup!: EventGroup;
  private upgradeSystem!: UpgradeSystem;
  private escKey!: Phaser.Input.Keyboard.Key;
  private eKey!: Phaser.Input.Keyboard.Key;

  private scrollContainer!: Phaser.GameObjects.Container;
  private scrollMask!: Phaser.GameObjects.Graphics;
  private scrollY = 0;
  private maxScrollY = 0;
  private listTop = 0;
  private listHeight = 0;
  private listLeft = 0;
  private listWidth = 0;

  private statTexts: Phaser.GameObjects.Text[] = [];
  private statsContainer!: Phaser.GameObjects.Container;
  private cardObjects: Phaser.GameObjects.Container[] = [];

  constructor() {
    super({ key: 'UpgradeScene', active: false });
  }

  create(): void {
    this.eventGroup = eventBus.createGroup();
    this.upgradeSystem = new UpgradeSystem(eventBus);
    this.cardObjects = [];
    this.statTexts = [];
    this.scrollY = 0;

    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    const backdrop = this.add.graphics();
    backdrop.fillStyle(0x000000, 0.8);
    backdrop.fillRect(0, 0, w, h);
    backdrop.setDepth(0);

    const leftW = Math.round(w * LEFT_RATIO);
    const rightX = leftW;
    const rightW = w - leftW;

    this.buildTitle(w);
    this.buildCloseButton(w, h);
    this.buildUpgradeList(leftW, h);
    this.buildCharacterPanel(rightX, rightW, h);
    this.buildStatsPanel(rightX, rightW, h);
    this.buildInventoryBar(leftW, h);

    this.escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.eKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    this.input.on('wheel', (_pointer: unknown, _gos: unknown, _dx: number, dy: number) => {
      this.scrollList(dy > 0 ? SCROLL_SPEED : -SCROLL_SPEED);
    });

    this.eventGroup.on('upgrade:acquired', () => this.refreshAll());
    this.eventGroup.on('inventory:changed', () => this.refreshAll());

    eventBus.emit('shop:opened', {});
  }

  update(): void {
    if (Phaser.Input.Keyboard.JustDown(this.escKey) || Phaser.Input.Keyboard.JustDown(this.eKey)) {
      this.closeUpgrades();
    }
  }

  private closeUpgrades(): void {
    eventBus.emit('shop:closed', {});
    this.scene.stop('UpgradeScene');
  }

  /* ── Title ── */

  private buildTitle(w: number): void {
    const title = this.add.text(w / 2, Math.round(20 * DPR), 'UPGRADES', {
      fontFamily: '"Courier New", monospace',
      fontSize: fontSize(32),
      color: '#ffcc44',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: Math.round(3 * DPR),
    });
    title.setOrigin(0.5, 0).setDepth(2);
  }

  /* ── Close button ── */

  private buildCloseButton(w: number, h: number): void {
    const btnW = Math.round(180 * DPR);
    const btnH = Math.round(36 * DPR);
    const btnX = w / 2 - btnW / 2;
    const btnY = h - Math.round(48 * DPR);

    const gfx = this.add.graphics();
    gfx.fillStyle(0x442222, 0.9);
    gfx.fillRoundedRect(btnX, btnY, btnW, btnH, Math.round(6 * DPR));
    gfx.lineStyle(Math.round(2 * DPR), 0xaa4444, 1);
    gfx.strokeRoundedRect(btnX, btnY, btnW, btnH, Math.round(6 * DPR));
    gfx.setDepth(2);

    const label = this.add.text(w / 2, btnY + btnH / 2, '[ESC / E]  Close', {
      fontFamily: '"Courier New", monospace',
      fontSize: fontSize(16),
      color: '#ff8888',
      fontStyle: 'bold',
    });
    label.setOrigin(0.5, 0.5).setDepth(3);

    const zone = this.add.zone(btnX, btnY, btnW, btnH).setOrigin(0, 0).setInteractive().setDepth(3);
    zone.on('pointerdown', () => this.closeUpgrades());
  }

  /* ── Inventory summary bar ── */

  private buildInventoryBar(leftW: number, h: number): void {
    const barY = h - Math.round(90 * DPR);
    const barH = Math.round(32 * DPR);
    const barX = MARGIN;
    const barW = leftW - MARGIN * 2;

    const bg = this.add.graphics();
    bg.fillStyle(0x0a0a18, 0.7);
    bg.fillRoundedRect(barX, barY, barW, barH, Math.round(6 * DPR));
    bg.setDepth(2);

    const items = inventoryManager.getAll();
    const parts: string[] = [];
    for (const { itemId, qty } of items) {
      const def = registry.get('item', itemId);
      const name = def?.name ?? itemId.split(':')[1];
      parts.push(`${name}: ${qty}`);
    }
    const text = parts.length > 0 ? parts.join('  |  ') : 'No items';

    const label = this.add.text(barX + barW / 2, barY + barH / 2, text, {
      fontFamily: '"Courier New", monospace',
      fontSize: fontSize(13),
      color: '#aaaaaa',
    });
    label.setOrigin(0.5, 0.5).setDepth(3);
  }

  /* ── Upgrade list (left panel) ── */

  private buildUpgradeList(leftW: number, h: number): void {
    const headerY = Math.round(62 * DPR);

    const sectionTitle = this.add.text(MARGIN, headerY, 'Available Upgrades', {
      fontFamily: '"Courier New", monospace',
      fontSize: fontSize(16),
      color: '#888899',
    });
    sectionTitle.setDepth(2);

    this.listTop = headerY + Math.round(30 * DPR);
    this.listLeft = MARGIN;
    this.listWidth = leftW - MARGIN * 2;
    this.listHeight = h - this.listTop - Math.round(100 * DPR);

    const listBg = this.add.graphics();
    listBg.fillStyle(0x0d0d1a, 0.6);
    listBg.fillRoundedRect(
      this.listLeft,
      this.listTop,
      this.listWidth,
      this.listHeight,
      Math.round(8 * DPR),
    );
    listBg.setDepth(1);

    this.scrollContainer = this.add.container(0, 0).setDepth(3);

    this.scrollMask = this.add.graphics();
    this.scrollMask.fillStyle(0xffffff, 1);
    this.scrollMask.fillRect(this.listLeft, this.listTop, this.listWidth, this.listHeight);
    this.scrollMask.setVisible(false);

    const mask = new Phaser.Display.Masks.GeometryMask(this, this.scrollMask);
    this.scrollContainer.setMask(mask);

    this.buildCards();
  }

  private buildCards(): void {
    for (const c of this.cardObjects) c.destroy();
    this.cardObjects = [];
    this.scrollContainer.removeAll();

    const upgrades = registry.getAll('upgrade') as UpgradeDef[];
    if (upgrades.length === 0) return;

    let y = this.listTop + INNER_PAD;

    for (const upg of upgrades) {
      const card = this.buildUpgradeCard(upg, this.listLeft + INNER_PAD, y);
      this.scrollContainer.add(card);
      this.cardObjects.push(card);
      y += CARD_HEIGHT + CARD_GAP;
    }

    const totalContentH = upgrades.length * (CARD_HEIGHT + CARD_GAP) - CARD_GAP + INNER_PAD * 2;
    this.maxScrollY = Math.max(0, totalContentH - this.listHeight);
    this.scrollY = 0;
  }

  private buildUpgradeCard(upg: UpgradeDef, x: number, y: number): Phaser.GameObjects.Container {
    const cardW = this.listWidth - INNER_PAD * 2;
    const container = this.add.container(x, y);

    const owned = this.upgradeSystem.hasUpgrade(upg.id);
    const canBuy = this.upgradeSystem.canAcquire(upg) && inventoryManager.canAfford(upg.cost);
    const meetsReqs = upg.requires.every((r) => this.upgradeSystem.hasUpgrade(r));

    const borderColor = owned ? 0x336633 : (RARITY_COLORS[upg.rarity] ?? 0x555566);
    const bgAlpha = owned ? 0.4 : 0.85;

    const bg = this.add.graphics();
    bg.fillStyle(0x12122a, bgAlpha);
    bg.fillRoundedRect(0, 0, cardW, CARD_HEIGHT, Math.round(6 * DPR));
    bg.lineStyle(Math.round(2 * DPR), borderColor, 1);
    bg.strokeRoundedRect(0, 0, cardW, CARD_HEIGHT, Math.round(6 * DPR));
    container.add(bg);

    const leftPad = Math.round(12 * DPR);
    const midX = Math.round(cardW * 0.45);

    const rarityLabel = upg.rarity.charAt(0).toUpperCase() + upg.rarity.slice(1);
    const rarityColor = hexColor(RARITY_GLOW[upg.rarity] ?? 0x888888);
    const rarityText = this.add.text(leftPad, Math.round(8 * DPR), rarityLabel, {
      fontFamily: '"Courier New", monospace',
      fontSize: fontSize(10),
      color: rarityColor,
    });
    container.add(rarityText);

    const nameColor = owned ? '#66aa66' : '#ffffff';
    const nameText = this.add.text(leftPad, Math.round(22 * DPR), upg.name, {
      fontFamily: '"Courier New", monospace',
      fontSize: fontSize(16),
      color: nameColor,
      fontStyle: 'bold',
    });
    container.add(nameText);

    let effectStr = '';
    for (const eff of upg.effects) {
      if (eff.kind === 'stat') {
        const sign = eff.value >= 0 ? '+' : '';
        const pct = eff.mod === 'flat' ? '' : '%';
        const val = eff.mod === 'flat' ? eff.value : Math.round(eff.value * 100);
        effectStr += `${statLabel(eff.stat)} ${sign}${val}${pct}  `;
      } else if (eff.kind === 'behavior') {
        effectStr += eff.description ?? eff.behavior;
        const colorHex = BEHAVIOR_COLORS[eff.behavior];
        if (colorHex !== undefined) {
          const swatch = this.add.graphics();
          swatch.fillStyle(colorHex, 1);
          swatch.fillCircle(midX + Math.round(4 * DPR), Math.round(50 * DPR), Math.round(6 * DPR));
          container.add(swatch);
        }
      }
    }

    if (effectStr.trim()) {
      const effectText = this.add.text(leftPad, Math.round(44 * DPR), effectStr.trim(), {
        fontFamily: '"Courier New", monospace',
        fontSize: fontSize(11),
        color: '#aaaacc',
        wordWrap: { width: midX - leftPad },
      });
      container.add(effectText);
    }

    const rightSection = cardW - Math.round(12 * DPR);

    if (owned) {
      const badge = this.add.text(rightSection, CARD_HEIGHT / 2, 'OWNED', {
        fontFamily: '"Courier New", monospace',
        fontSize: fontSize(14),
        color: '#66cc66',
        fontStyle: 'bold',
      });
      badge.setOrigin(1, 0.5);
      container.add(badge);
    } else {
      const costParts: string[] = [];
      for (const [itemId, qty] of Object.entries(upg.cost)) {
        const itemDef = registry.get('item', itemId);
        const name = itemDef?.name ?? itemId.split(':')[1];
        costParts.push(`${qty} ${name}`);
      }
      const costStr = costParts.length > 0 ? costParts.join(', ') : 'Free';

      if (!meetsReqs) {
        const reqNames = upg.requires.map((r) => {
          const def = registry.get('upgrade', r);
          return def?.name ?? r.split(':')[1];
        });
        const reqText = this.add.text(
          rightSection,
          Math.round(10 * DPR),
          `Requires: ${reqNames.join(', ')}`,
          {
            fontFamily: '"Courier New", monospace',
            fontSize: fontSize(10),
            color: '#ff6666',
          },
        );
        reqText.setOrigin(1, 0);
        container.add(reqText);
      }

      const btnW = Math.round(120 * DPR);
      const btnH = Math.round(30 * DPR);
      const btnX = rightSection - btnW;
      const btnY = CARD_HEIGHT / 2 - btnH / 2 + (meetsReqs ? 0 : Math.round(6 * DPR));

      const btnColor = canBuy ? 0x335533 : 0x2a2a2a;
      const btnBorderColor = canBuy ? 0x55aa55 : 0x444444;
      const btnTextColor = canBuy ? '#aaffaa' : '#666666';

      const btnGfx = this.add.graphics();
      btnGfx.fillStyle(btnColor, 1);
      btnGfx.fillRoundedRect(btnX, btnY, btnW, btnH, Math.round(4 * DPR));
      btnGfx.lineStyle(1, btnBorderColor, 1);
      btnGfx.strokeRoundedRect(btnX, btnY, btnW, btnH, Math.round(4 * DPR));
      container.add(btnGfx);

      const btnLabel = this.add.text(btnX + btnW / 2, btnY + btnH / 2, costStr, {
        fontFamily: '"Courier New", monospace',
        fontSize: fontSize(11),
        color: btnTextColor,
        fontStyle: 'bold',
      });
      btnLabel.setOrigin(0.5, 0.5);
      container.add(btnLabel);

      if (canBuy) {
        const hitZone = this.add
          .zone(btnX, btnY, btnW, btnH)
          .setOrigin(0, 0)
          .setInteractive()
          .setDepth(3);
        container.add(hitZone);

        hitZone.on('pointerover', () => {
          btnGfx.clear();
          btnGfx.fillStyle(0x447744, 1);
          btnGfx.fillRoundedRect(btnX, btnY, btnW, btnH, Math.round(4 * DPR));
          btnGfx.lineStyle(1, 0x77cc77, 1);
          btnGfx.strokeRoundedRect(btnX, btnY, btnW, btnH, Math.round(4 * DPR));
        });
        hitZone.on('pointerout', () => {
          btnGfx.clear();
          btnGfx.fillStyle(btnColor, 1);
          btnGfx.fillRoundedRect(btnX, btnY, btnW, btnH, Math.round(4 * DPR));
          btnGfx.lineStyle(1, btnBorderColor, 1);
          btnGfx.strokeRoundedRect(btnX, btnY, btnW, btnH, Math.round(4 * DPR));
        });
        hitZone.on('pointerdown', () => this.buyUpgrade(upg));
      }
    }

    return container;
  }

  private scrollList(dy: number): void {
    this.scrollY = Phaser.Math.Clamp(this.scrollY + dy, 0, this.maxScrollY);
    this.scrollContainer.y = -this.scrollY;
  }

  /* ── Character panel (right top) ── */

  private buildCharacterPanel(rightX: number, rightW: number, _h: number): void {
    const panelX = rightX + Math.round(16 * DPR);
    const panelY = Math.round(62 * DPR);
    const panelW = rightW - Math.round(32 * DPR);
    const panelH = Math.round(180 * DPR);

    const bg = this.add.graphics();
    bg.fillStyle(0x0d0d1a, 0.7);
    bg.fillRoundedRect(panelX, panelY, panelW, panelH, Math.round(8 * DPR));
    bg.lineStyle(1, 0x333355, 0.6);
    bg.strokeRoundedRect(panelX, panelY, panelW, panelH, Math.round(8 * DPR));
    bg.setDepth(1);

    const title = this.add.text(panelX + panelW / 2, panelY + Math.round(12 * DPR), 'CHARACTER', {
      fontFamily: '"Courier New", monospace',
      fontSize: fontSize(14),
      color: '#88ccff',
      fontStyle: 'bold',
    });
    title.setOrigin(0.5, 0).setDepth(2);

    if (this.textures.exists('player/idle')) {
      const sprite = this.add.image(
        panelX + panelW / 2,
        panelY + panelH / 2 + Math.round(10 * DPR),
        'player/idle',
      );
      const maxSpriteH = panelH - Math.round(50 * DPR);
      const scale = Math.min(maxSpriteH / sprite.height, (panelW * 0.6) / sprite.width);
      sprite.setScale(scale).setDepth(2);
    } else if (this.textures.exists('player/walk')) {
      const sprite = this.add.sprite(
        panelX + panelW / 2,
        panelY + panelH / 2 + Math.round(10 * DPR),
        'player/walk',
        0,
      );
      const maxSpriteH = panelH - Math.round(50 * DPR);
      const scale = Math.min(maxSpriteH / sprite.height, (panelW * 0.6) / sprite.width);
      sprite.setScale(scale).setDepth(2);
    }

    const playerName = this.add.text(
      panelX + panelW / 2,
      panelY + panelH - Math.round(16 * DPR),
      'Trash Collector',
      {
        fontFamily: '"Courier New", monospace',
        fontSize: fontSize(12),
        color: '#aaaaaa',
      },
    );
    playerName.setOrigin(0.5, 1).setDepth(2);
  }

  /* ── Stats panel (right bottom) ── */

  private buildStatsPanel(rightX: number, rightW: number, h: number): void {
    const panelX = rightX + Math.round(16 * DPR);
    const panelY = Math.round(256 * DPR);
    const panelW = rightW - Math.round(32 * DPR);
    const panelH = h - panelY - Math.round(56 * DPR);

    const bg = this.add.graphics();
    bg.fillStyle(0x0a0a18, 0.7);
    bg.fillRoundedRect(panelX, panelY, panelW, panelH, Math.round(8 * DPR));
    bg.lineStyle(1, 0x333355, 0.6);
    bg.strokeRoundedRect(panelX, panelY, panelW, panelH, Math.round(8 * DPR));
    bg.setDepth(1);

    this.statsContainer = this.add.container(0, 0).setDepth(3);

    const header = this.add.text(panelX + panelW / 2, panelY + Math.round(12 * DPR), 'YOUR STATS', {
      fontFamily: '"Courier New", monospace',
      fontSize: fontSize(14),
      color: '#88ff88',
      fontStyle: 'bold',
    });
    header.setOrigin(0.5, 0);
    this.statsContainer.add(header);

    const divider = this.add.graphics();
    divider.lineStyle(1, 0x335533, 0.6);
    divider.lineBetween(
      panelX + Math.round(12 * DPR),
      panelY + Math.round(34 * DPR),
      panelX + panelW - Math.round(12 * DPR),
      panelY + Math.round(34 * DPR),
    );
    this.statsContainer.add(divider);

    this.refreshStats(panelX, panelY + Math.round(44 * DPR), panelW);
  }

  private refreshStats(x: number, startY: number, w: number): void {
    for (const t of this.statTexts) t.destroy();
    this.statTexts = [];

    let stats: StatSheet;
    try {
      stats = this.getPlayerStats();
    } catch {
      return;
    }

    const allStats = stats.allStats();
    const pad = Math.round(14 * DPR);
    let y = startY;

    for (const stat of allStats) {
      const base = stats.getBase(stat);
      const final = stats.get(stat);
      const label = statLabel(stat);

      const changed = Math.abs(final - base) > 0.001;
      const valueStr = Number.isInteger(final) ? String(final) : final.toFixed(1);

      const nameText = this.add.text(x + pad, y, label, {
        fontFamily: '"Courier New", monospace',
        fontSize: fontSize(13),
        color: '#cccccc',
      });
      this.statsContainer.add(nameText);
      this.statTexts.push(nameText);

      const valColor = changed ? '#88ccff' : '#aaaaaa';
      const valText = this.add.text(x + w - pad, y, valueStr, {
        fontFamily: '"Courier New", monospace',
        fontSize: fontSize(13),
        color: valColor,
        fontStyle: changed ? 'bold' : 'normal',
      });
      valText.setOrigin(1, 0);
      this.statsContainer.add(valText);
      this.statTexts.push(valText);

      if (changed) {
        const diff = final - base;
        const sign = diff > 0 ? '+' : '';
        const diffStr = Number.isInteger(diff) ? `${sign}${diff}` : `${sign}${diff.toFixed(1)}`;
        const diffText = this.add.text(x + w - pad, y + Math.round(16 * DPR), diffStr, {
          fontFamily: '"Courier New", monospace',
          fontSize: fontSize(10),
          color: diff > 0 ? '#66cc66' : '#cc6666',
        });
        diffText.setOrigin(1, 0);
        this.statsContainer.add(diffText);
        this.statTexts.push(diffText);
        y += Math.round(14 * DPR);
      }

      y += Math.round(22 * DPR);
    }
  }

  /* ── Purchase ── */

  private buyUpgrade(upg: UpgradeDef): void {
    if (!this.upgradeSystem.canAcquire(upg)) return;
    if (!inventoryManager.canAfford(upg.cost)) return;
    if (!inventoryManager.spend(upg.cost)) return;
    this.upgradeSystem.acquire(upg, this.getPlayerStats());
  }

  /** Reach into the running GameScene to get the player's StatSheet. */
  private getPlayerStats(): StatSheet {
    const gameScene = this.scene.get('GameScene') as Phaser.Scene & {
      getPlayerStats?: () => StatSheet;
    };
    if (gameScene.getPlayerStats) {
      return gameScene.getPlayerStats();
    }
    throw new Error('GameScene.getPlayerStats not available');
  }

  private refreshAll(): void {
    this.buildCards();

    let stats: StatSheet;
    try {
      stats = this.getPlayerStats();
    } catch {
      return;
    }

    const allStats = stats.allStats();
    const rightX = Math.round(this.cameras.main.width * LEFT_RATIO);
    const rightW = this.cameras.main.width - rightX;
    const panelX = rightX + Math.round(16 * DPR);
    const panelW = rightW - Math.round(32 * DPR);

    if (allStats.length > 0) {
      this.refreshStats(panelX, Math.round(256 * DPR) + Math.round(44 * DPR), panelW);
    }
  }

  shutdown(): void {
    this.eventGroup?.clear();
  }
}
