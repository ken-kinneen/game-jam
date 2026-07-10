import { eventBus, type EventGroup } from '../core/EventBus';
import { registry } from '../core/ContentRegistry';
import { inventoryManager } from '../core/InventoryManager';
import type { UpgradeDef } from '../schemas/upgrade.schema';
import { UpgradeSystem } from '../systems/UpgradeSystem';
import type { StatSheet } from '../stats/StatSheet';

const PANEL_PCT = 0.15;
const DPR = Math.min(window.devicePixelRatio || 1, 2);
const CARD_W = Math.round(220 * DPR);
const CARD_H = Math.round(210 * DPR);
const CARD_GAP = Math.round(18 * DPR);
const COLS = 3;

const STAT_LABELS: Record<string, string> = {
  moveSpeed: 'Move Speed',
  pickupRadius: 'Pickup Radius',
  maxHealth: 'Max Health',
  damage: 'Damage',
  attackSpeed: 'Attack Speed',
  carryCapacity: 'Carry Capacity',
  luck: 'Luck',
  glowRadius: 'Lamp Radius',
  fuelBurnRate: 'Fuel Burn Rate',
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

/** Overlay shop for browsing and buying upgrades, with a live stats panel. */
export class ShopScene extends Phaser.Scene {
  private eventGroup!: EventGroup;
  private upgradeSystem!: UpgradeSystem;
  private cardContainers: Phaser.GameObjects.Container[] = [];
  private statTexts: Phaser.GameObjects.Text[] = [];
  private statsContainer!: Phaser.GameObjects.Container;
  private escKey!: Phaser.Input.Keyboard.Key;
  private eKey!: Phaser.Input.Keyboard.Key;
  private panelX = 0;
  private panelY = 0;
  private panelW = 0;
  private panelH = 0;

  constructor() {
    super({ key: 'ShopScene', active: false });
  }

  create() {
    this.eventGroup = eventBus.createGroup();
    this.upgradeSystem = new UpgradeSystem(eventBus);
    this.cardContainers = [];
    this.statTexts = [];

    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    const backdrop = this.add.graphics();
    backdrop.fillStyle(0x000000, 0.7);
    backdrop.fillRect(0, 0, w, h);
    backdrop.setDepth(0);

    const marginX = Math.round(w * PANEL_PCT);
    const marginY = Math.round(h * PANEL_PCT);
    this.panelX = marginX;
    this.panelY = marginY;
    this.panelW = w - marginX * 2;
    this.panelH = h - marginY * 2;

    const panelGfx = this.add.graphics();
    panelGfx.fillStyle(0x1a1a2e, 0.95);
    panelGfx.fillRoundedRect(this.panelX, this.panelY, this.panelW, this.panelH, 16 * DPR);
    panelGfx.lineStyle(2 * DPR, 0x444466, 1);
    panelGfx.strokeRoundedRect(this.panelX, this.panelY, this.panelW, this.panelH, 16 * DPR);
    panelGfx.setDepth(1);

    const title = this.add.text(w / 2, this.panelY + 24 * DPR, 'UPGRADES', {
      fontFamily: '"Courier New", monospace',
      fontSize: fontSize(36),
      color: '#ffcc44',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3 * DPR,
    });
    title.setOrigin(0.5, 0).setDepth(2);

    const closeBtnGfx = this.add.graphics();
    const closeBtnW = Math.round(200 * DPR);
    const closeBtnH = Math.round(40 * DPR);
    const closeBtnX = w / 2 - closeBtnW / 2;
    const closeBtnY = this.panelY + this.panelH - Math.round(52 * DPR);
    closeBtnGfx.fillStyle(0x442222, 0.9);
    closeBtnGfx.fillRoundedRect(closeBtnX, closeBtnY, closeBtnW, closeBtnH, 8 * DPR);
    closeBtnGfx.lineStyle(2 * DPR, 0xaa4444, 1);
    closeBtnGfx.strokeRoundedRect(closeBtnX, closeBtnY, closeBtnW, closeBtnH, 8 * DPR);
    closeBtnGfx.setDepth(2);

    const closeHint = this.add.text(w / 2, closeBtnY + closeBtnH / 2, '[ESC / E]  Close', {
      fontFamily: '"Courier New", monospace',
      fontSize: fontSize(20),
      color: '#ff8888',
      fontStyle: 'bold',
    });
    closeHint.setOrigin(0.5, 0.5).setDepth(3);

    const closeZone = this.add
      .zone(closeBtnX, closeBtnY, closeBtnW, closeBtnH)
      .setOrigin(0, 0)
      .setInteractive()
      .setDepth(3);
    closeZone.on('pointerdown', () => this.closeShop());

    this.buildStatsPanel();
    this.buildCards();

    this.escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.eKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    this.eventGroup.on('upgrade:acquired', () => {
      this.refreshAll();
    });

    this.eventGroup.on('inventory:changed', () => {
      this.refreshAll();
    });

    eventBus.emit('shop:opened', {});
  }

  update() {
    if (Phaser.Input.Keyboard.JustDown(this.escKey) || Phaser.Input.Keyboard.JustDown(this.eKey)) {
      this.closeShop();
    }
  }

  private closeShop(): void {
    eventBus.emit('shop:closed', {});
    this.scene.stop('ShopScene');
  }

  private buildStatsPanel(): void {
    const statsX = this.panelX + Math.round(28 * DPR);
    const statsY = this.panelY + Math.round(76 * DPR);
    const statsW = Math.round(220 * DPR);

    this.statsContainer = this.add.container(0, 0).setDepth(3);

    const statsBg = this.add.graphics();
    statsBg.fillStyle(0x0a0a18, 0.8);
    statsBg.fillRoundedRect(statsX, statsY, statsW, this.panelH - Math.round(130 * DPR), 10 * DPR);
    statsBg.lineStyle(1, 0x333355, 1);
    statsBg.strokeRoundedRect(
      statsX,
      statsY,
      statsW,
      this.panelH - Math.round(130 * DPR),
      10 * DPR,
    );
    this.statsContainer.add(statsBg);

    const header = this.add.text(statsX + statsW / 2, statsY + 14 * DPR, 'YOUR STATS', {
      fontFamily: '"Courier New", monospace',
      fontSize: fontSize(16),
      color: '#88ff88',
      fontStyle: 'bold',
    });
    header.setOrigin(0.5, 0);
    this.statsContainer.add(header);

    const divider = this.add.graphics();
    divider.lineStyle(1, 0x335533, 0.6);
    divider.lineBetween(
      statsX + 16 * DPR,
      statsY + 38 * DPR,
      statsX + statsW - 16 * DPR,
      statsY + 38 * DPR,
    );
    this.statsContainer.add(divider);

    this.refreshStats(statsX, statsY + 48 * DPR, statsW);
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
    const pad = Math.round(12 * DPR);
    let y = startY;

    for (const stat of allStats) {
      const base = stats.getBase(stat);
      const final = stats.get(stat);
      const label = statLabel(stat);

      const changed = Math.abs(final - base) > 0.001;
      const color = changed ? '#88ccff' : '#aaaaaa';
      const valueStr = Number.isInteger(final) ? String(final) : final.toFixed(1);

      const nameText = this.add.text(x + pad, y, label, {
        fontFamily: '"Courier New", monospace',
        fontSize: fontSize(14),
        color: '#cccccc',
      });
      this.statsContainer.add(nameText);
      this.statTexts.push(nameText);

      const valText = this.add.text(x + w - pad, y, valueStr, {
        fontFamily: '"Courier New", monospace',
        fontSize: fontSize(14),
        color,
        fontStyle: changed ? 'bold' : 'normal',
      });
      valText.setOrigin(1, 0);
      this.statsContainer.add(valText);
      this.statTexts.push(valText);

      if (changed) {
        const diff = final - base;
        const sign = diff > 0 ? '+' : '';
        const diffStr = Number.isInteger(diff) ? `${sign}${diff}` : `${sign}${diff.toFixed(1)}`;
        const diffText = this.add.text(x + w - pad, y + 16 * DPR, diffStr, {
          fontFamily: '"Courier New", monospace',
          fontSize: fontSize(11),
          color: diff > 0 ? '#66cc66' : '#cc6666',
        });
        diffText.setOrigin(1, 0);
        this.statsContainer.add(diffText);
        this.statTexts.push(diffText);
        y += 14 * DPR;
      }

      y += 24 * DPR;
    }
  }

  private buildCards(): void {
    const upgrades = registry.getAll('upgrade') as UpgradeDef[];
    if (upgrades.length === 0) return;

    const cardsAreaX = this.panelX + Math.round(270 * DPR);
    const cardsAreaW = this.panelW - Math.round(290 * DPR);
    const cardsTop = this.panelY + Math.round(80 * DPR);

    const totalW =
      Math.min(COLS, upgrades.length) * CARD_W + (Math.min(COLS, upgrades.length) - 1) * CARD_GAP;
    const startX = cardsAreaX + (cardsAreaW - totalW) / 2;

    for (let i = 0; i < upgrades.length; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const cx = startX + col * (CARD_W + CARD_GAP);
      const cy = cardsTop + row * (CARD_H + CARD_GAP);
      const card = this.buildCard(upgrades[i], cx, cy);
      this.cardContainers.push(card);
    }
  }

  private refreshAll(): void {
    for (const c of this.cardContainers) c.destroy();
    this.cardContainers = [];
    this.buildCards();

    const statsX = this.panelX + Math.round(28 * DPR);
    this.refreshStats(statsX, this.panelY + Math.round((76 + 48) * DPR), Math.round(220 * DPR));
  }

  private buildCard(upg: UpgradeDef, x: number, y: number): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    container.setDepth(3);

    const owned = this.upgradeSystem.hasUpgrade(upg.id);
    const canBuy = this.upgradeSystem.canAcquire(upg) && inventoryManager.canAfford(upg.cost);

    const rarityColors: Record<string, number> = {
      common: 0x555566,
      uncommon: 0x447744,
      rare: 0x4455aa,
      legendary: 0xaa6633,
    };
    const rarityGlow: Record<string, number> = {
      common: 0x666677,
      uncommon: 0x55aa55,
      rare: 0x5566cc,
      legendary: 0xcc8844,
    };

    const borderColor = owned ? 0x336633 : (rarityColors[upg.rarity] ?? 0x555566);
    const bgAlpha = owned ? 0.5 : 0.9;

    const bg = this.add.graphics();
    bg.fillStyle(0x0d0d1a, bgAlpha);
    bg.fillRoundedRect(0, 0, CARD_W, CARD_H, 10 * DPR);
    bg.lineStyle(owned ? 3 * DPR : 2 * DPR, borderColor, 1);
    bg.strokeRoundedRect(0, 0, CARD_W, CARD_H, 10 * DPR);
    container.add(bg);

    const rarityLabel = upg.rarity.charAt(0).toUpperCase() + upg.rarity.slice(1);
    const rarityText = this.add.text(CARD_W / 2, 12 * DPR, rarityLabel, {
      fontFamily: '"Courier New", monospace',
      fontSize: fontSize(12),
      color: '#' + (rarityGlow[upg.rarity] ?? 0x888888).toString(16).padStart(6, '0'),
    });
    rarityText.setOrigin(0.5, 0);
    container.add(rarityText);

    const nameColor = owned ? '#66aa66' : '#ffffff';
    const nameText = this.add.text(CARD_W / 2, 30 * DPR, upg.name, {
      fontFamily: '"Courier New", monospace',
      fontSize: fontSize(22),
      color: nameColor,
      fontStyle: 'bold',
    });
    nameText.setOrigin(0.5, 0);
    container.add(nameText);

    const divider = this.add.graphics();
    divider.lineStyle(1, 0x333355, 0.5);
    divider.lineBetween(20 * DPR, 60 * DPR, CARD_W - 20 * DPR, 60 * DPR);
    container.add(divider);

    let effectY = 70 * DPR;
    for (const eff of upg.effects) {
      if (eff.kind === 'stat') {
        const sign = eff.value >= 0 ? '+' : '';
        const pct = eff.mod === 'flat' ? '' : '%';
        const val = eff.mod === 'flat' ? eff.value : Math.round(eff.value * 100);
        const valueColor = eff.value >= 0 ? '#66ee66' : '#ee6666';

        const label = statLabel(eff.stat);

        const statNameText = this.add.text(CARD_W / 2, effectY, label, {
          fontFamily: '"Courier New", monospace',
          fontSize: fontSize(14),
          color: '#aaaacc',
        });
        statNameText.setOrigin(0.5, 0);
        container.add(statNameText);

        const valueText = this.add.text(CARD_W / 2, effectY + 18 * DPR, `${sign}${val}${pct}`, {
          fontFamily: '"Courier New", monospace',
          fontSize: fontSize(20),
          color: valueColor,
          fontStyle: 'bold',
        });
        valueText.setOrigin(0.5, 0);
        container.add(valueText);

        effectY += 48 * DPR;
      } else if (eff.kind === 'behavior') {
        const desc = eff.description ?? eff.behavior;
        const colorHex = BEHAVIOR_COLORS[eff.behavior];

        if (colorHex !== undefined) {
          const swatch = this.add.graphics();
          swatch.fillStyle(colorHex, 1);
          swatch.fillCircle(CARD_W / 2, effectY + 14 * DPR, 12 * DPR);
          swatch.lineStyle(2 * DPR, 0xffffff, 0.3);
          swatch.strokeCircle(CARD_W / 2, effectY + 14 * DPR, 12 * DPR);
          container.add(swatch);
          effectY += 34 * DPR;
        }

        const descText = this.add.text(CARD_W / 2, effectY, desc, {
          fontFamily: '"Courier New", monospace',
          fontSize: fontSize(14),
          color: '#ddaaff',
          align: 'center',
          wordWrap: { width: CARD_W - 30 * DPR },
        });
        descText.setOrigin(0.5, 0);
        container.add(descText);

        effectY += descText.height + 12 * DPR;
      }
    }

    if (upg.requires.length > 0 && !canBuy && !owned) {
      const reqNames = upg.requires.map((r) => {
        const def = registry.get('upgrade', r);
        return def?.name ?? r.split(':')[1];
      });
      const reqText = this.add.text(
        CARD_W / 2,
        effectY + 4 * DPR,
        `Requires: ${reqNames.join(', ')}`,
        {
          fontFamily: '"Courier New", monospace',
          fontSize: fontSize(12),
          color: '#ff6666',
        },
      );
      reqText.setOrigin(0.5, 0);
      container.add(reqText);
    }

    const costParts: string[] = [];
    for (const [itemId, qty] of Object.entries(upg.cost)) {
      const itemDef = registry.get('item', itemId);
      const name = itemDef?.name ?? itemId.split(':')[1];
      costParts.push(`${qty} ${name}`);
    }
    const costStr = costParts.length > 0 ? costParts.join(', ') : 'Free';

    if (owned) {
      const ownedBadge = this.add.graphics();
      ownedBadge.fillStyle(0x224422, 0.8);
      ownedBadge.fillRoundedRect(20 * DPR, CARD_H - 44 * DPR, CARD_W - 40 * DPR, 32 * DPR, 6 * DPR);
      container.add(ownedBadge);

      const ownedText = this.add.text(CARD_W / 2, CARD_H - 28 * DPR, 'OWNED', {
        fontFamily: '"Courier New", monospace',
        fontSize: fontSize(18),
        color: '#66cc66',
        fontStyle: 'bold',
      });
      ownedText.setOrigin(0.5, 0.5);
      container.add(ownedText);
    } else {
      const btnY = CARD_H - 48 * DPR;
      const btnW = CARD_W - 30 * DPR;
      const btnH = Math.round(36 * DPR);
      const btnX = (CARD_W - btnW) / 2;

      const btnColor = canBuy ? 0x335533 : 0x2a2a2a;
      const btnBorder = canBuy ? 0x55aa55 : 0x444444;
      const btnTextColor = canBuy ? '#aaffaa' : '#555555';

      const btnGfx = this.add.graphics();
      btnGfx.fillStyle(btnColor, 1);
      btnGfx.fillRoundedRect(btnX, btnY, btnW, btnH, 6 * DPR);
      btnGfx.lineStyle(1, btnBorder, 1);
      btnGfx.strokeRoundedRect(btnX, btnY, btnW, btnH, 6 * DPR);
      container.add(btnGfx);

      const btnLabel = this.add.text(CARD_W / 2, btnY + btnH / 2, costStr, {
        fontFamily: '"Courier New", monospace',
        fontSize: fontSize(14),
        color: btnTextColor,
        fontStyle: 'bold',
      });
      btnLabel.setOrigin(0.5, 0.5);
      container.add(btnLabel);

      if (canBuy) {
        const hitZone = this.add.zone(btnX, btnY, btnW, btnH).setOrigin(0, 0).setInteractive();
        container.add(hitZone);

        hitZone.on('pointerover', () => {
          btnGfx.clear();
          btnGfx.fillStyle(0x447744, 1);
          btnGfx.fillRoundedRect(btnX, btnY, btnW, btnH, 6 * DPR);
          btnGfx.lineStyle(1, 0x77cc77, 1);
          btnGfx.strokeRoundedRect(btnX, btnY, btnW, btnH, 6 * DPR);
        });
        hitZone.on('pointerout', () => {
          btnGfx.clear();
          btnGfx.fillStyle(btnColor, 1);
          btnGfx.fillRoundedRect(btnX, btnY, btnW, btnH, 6 * DPR);
          btnGfx.lineStyle(1, btnBorder, 1);
          btnGfx.strokeRoundedRect(btnX, btnY, btnW, btnH, 6 * DPR);
        });
        hitZone.on('pointerdown', () => {
          this.buyUpgrade(upg);
        });
      }
    }

    return container;
  }

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

  shutdown() {
    this.eventGroup?.clear();
  }
}
