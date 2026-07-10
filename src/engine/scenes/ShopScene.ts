import { eventBus, type EventGroup } from '../core/EventBus';
import { registry } from '../core/ContentRegistry';
import { inventoryManager } from '../core/InventoryManager';
import type { UpgradeDef } from '../schemas/upgrade.schema';
import { UpgradeSystem } from '../systems/UpgradeSystem';
import type { StatSheet } from '../stats/StatSheet';

const PANEL_PCT = 0.15;
const CARD_W = 220;
const CARD_H = 210;
const CARD_GAP = 18;
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
    panelGfx.fillRoundedRect(this.panelX, this.panelY, this.panelW, this.panelH, 16);
    panelGfx.lineStyle(2, 0x444466, 1);
    panelGfx.strokeRoundedRect(this.panelX, this.panelY, this.panelW, this.panelH, 16);
    panelGfx.setDepth(1);

    const title = this.add.text(w / 2, this.panelY + 24, 'UPGRADES', {
      fontFamily: '"Courier New", monospace',
      fontSize: '36px',
      color: '#ffcc44',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    });
    title.setOrigin(0.5, 0).setDepth(2);

    const closeBtnGfx = this.add.graphics();
    const closeBtnW = 200;
    const closeBtnH = 40;
    const closeBtnX = w / 2 - closeBtnW / 2;
    const closeBtnY = this.panelY + this.panelH - 52;
    closeBtnGfx.fillStyle(0x442222, 0.9);
    closeBtnGfx.fillRoundedRect(closeBtnX, closeBtnY, closeBtnW, closeBtnH, 8);
    closeBtnGfx.lineStyle(2, 0xaa4444, 1);
    closeBtnGfx.strokeRoundedRect(closeBtnX, closeBtnY, closeBtnW, closeBtnH, 8);
    closeBtnGfx.setDepth(2);

    const closeHint = this.add.text(w / 2, closeBtnY + closeBtnH / 2, '[ESC / E]  Close', {
      fontFamily: '"Courier New", monospace',
      fontSize: '20px',
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
    const statsX = this.panelX + 28;
    const statsY = this.panelY + 76;
    const statsW = 220;

    this.statsContainer = this.add.container(0, 0).setDepth(3);

    const statsBg = this.add.graphics();
    statsBg.fillStyle(0x0a0a18, 0.8);
    statsBg.fillRoundedRect(statsX, statsY, statsW, this.panelH - 130, 10);
    statsBg.lineStyle(1, 0x333355, 1);
    statsBg.strokeRoundedRect(statsX, statsY, statsW, this.panelH - 130, 10);
    this.statsContainer.add(statsBg);

    const header = this.add.text(statsX + statsW / 2, statsY + 14, 'YOUR STATS', {
      fontFamily: '"Courier New", monospace',
      fontSize: '16px',
      color: '#88ff88',
      fontStyle: 'bold',
    });
    header.setOrigin(0.5, 0);
    this.statsContainer.add(header);

    const divider = this.add.graphics();
    divider.lineStyle(1, 0x335533, 0.6);
    divider.lineBetween(statsX + 16, statsY + 38, statsX + statsW - 16, statsY + 38);
    this.statsContainer.add(divider);

    this.refreshStats(statsX, statsY + 48, statsW);
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
    const pad = 12;
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
        fontSize: '14px',
        color: '#cccccc',
      });
      this.statsContainer.add(nameText);
      this.statTexts.push(nameText);

      const valText = this.add.text(x + w - pad, y, valueStr, {
        fontFamily: '"Courier New", monospace',
        fontSize: '14px',
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
        const diffText = this.add.text(x + w - pad, y + 16, diffStr, {
          fontFamily: '"Courier New", monospace',
          fontSize: '11px',
          color: diff > 0 ? '#66cc66' : '#cc6666',
        });
        diffText.setOrigin(1, 0);
        this.statsContainer.add(diffText);
        this.statTexts.push(diffText);
        y += 14;
      }

      y += 24;
    }
  }

  private buildCards(): void {
    const upgrades = registry.getAll('upgrade') as UpgradeDef[];
    if (upgrades.length === 0) return;

    const cardsAreaX = this.panelX + 270;
    const cardsAreaW = this.panelW - 290;
    const cardsTop = this.panelY + 80;

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

    const statsX = this.panelX + 28;
    this.refreshStats(statsX, this.panelY + 76 + 48, 220);
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
    bg.fillRoundedRect(0, 0, CARD_W, CARD_H, 10);
    bg.lineStyle(owned ? 3 : 2, borderColor, 1);
    bg.strokeRoundedRect(0, 0, CARD_W, CARD_H, 10);
    container.add(bg);

    const rarityLabel = upg.rarity.charAt(0).toUpperCase() + upg.rarity.slice(1);
    const rarityText = this.add.text(CARD_W / 2, 12, rarityLabel, {
      fontFamily: '"Courier New", monospace',
      fontSize: '12px',
      color: '#' + (rarityGlow[upg.rarity] ?? 0x888888).toString(16).padStart(6, '0'),
    });
    rarityText.setOrigin(0.5, 0);
    container.add(rarityText);

    const nameColor = owned ? '#66aa66' : '#ffffff';
    const nameText = this.add.text(CARD_W / 2, 30, upg.name, {
      fontFamily: '"Courier New", monospace',
      fontSize: '22px',
      color: nameColor,
      fontStyle: 'bold',
    });
    nameText.setOrigin(0.5, 0);
    container.add(nameText);

    const divider = this.add.graphics();
    divider.lineStyle(1, 0x333355, 0.5);
    divider.lineBetween(20, 60, CARD_W - 20, 60);
    container.add(divider);

    let effectY = 70;
    for (const eff of upg.effects) {
      if (eff.kind === 'stat') {
        const sign = eff.value >= 0 ? '+' : '';
        const pct = eff.mod === 'flat' ? '' : '%';
        const val = eff.mod === 'flat' ? eff.value : Math.round(eff.value * 100);
        const valueColor = eff.value >= 0 ? '#66ee66' : '#ee6666';

        const label = statLabel(eff.stat);

        const statNameText = this.add.text(CARD_W / 2, effectY, label, {
          fontFamily: '"Courier New", monospace',
          fontSize: '14px',
          color: '#aaaacc',
        });
        statNameText.setOrigin(0.5, 0);
        container.add(statNameText);

        const valueText = this.add.text(CARD_W / 2, effectY + 18, `${sign}${val}${pct}`, {
          fontFamily: '"Courier New", monospace',
          fontSize: '20px',
          color: valueColor,
          fontStyle: 'bold',
        });
        valueText.setOrigin(0.5, 0);
        container.add(valueText);

        effectY += 48;
      } else if (eff.kind === 'behavior') {
        const desc = eff.description ?? eff.behavior;
        const colorHex = BEHAVIOR_COLORS[eff.behavior];

        if (colorHex !== undefined) {
          const swatch = this.add.graphics();
          swatch.fillStyle(colorHex, 1);
          swatch.fillCircle(CARD_W / 2, effectY + 14, 12);
          swatch.lineStyle(2, 0xffffff, 0.3);
          swatch.strokeCircle(CARD_W / 2, effectY + 14, 12);
          container.add(swatch);
          effectY += 34;
        }

        const descText = this.add.text(CARD_W / 2, effectY, desc, {
          fontFamily: '"Courier New", monospace',
          fontSize: '14px',
          color: '#ddaaff',
          align: 'center',
          wordWrap: { width: CARD_W - 30 },
        });
        descText.setOrigin(0.5, 0);
        container.add(descText);

        effectY += descText.height + 12;
      }
    }

    if (upg.requires.length > 0 && !canBuy && !owned) {
      const reqNames = upg.requires.map((r) => {
        const def = registry.get('upgrade', r);
        return def?.name ?? r.split(':')[1];
      });
      const reqText = this.add.text(CARD_W / 2, effectY + 4, `Requires: ${reqNames.join(', ')}`, {
        fontFamily: '"Courier New", monospace',
        fontSize: '12px',
        color: '#ff6666',
      });
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
      ownedBadge.fillRoundedRect(20, CARD_H - 44, CARD_W - 40, 32, 6);
      container.add(ownedBadge);

      const ownedText = this.add.text(CARD_W / 2, CARD_H - 28, 'OWNED', {
        fontFamily: '"Courier New", monospace',
        fontSize: '18px',
        color: '#66cc66',
        fontStyle: 'bold',
      });
      ownedText.setOrigin(0.5, 0.5);
      container.add(ownedText);
    } else {
      const btnY = CARD_H - 48;
      const btnW = CARD_W - 30;
      const btnH = 36;
      const btnX = (CARD_W - btnW) / 2;

      const btnColor = canBuy ? 0x335533 : 0x2a2a2a;
      const btnBorder = canBuy ? 0x55aa55 : 0x444444;
      const btnTextColor = canBuy ? '#aaffaa' : '#555555';

      const btnGfx = this.add.graphics();
      btnGfx.fillStyle(btnColor, 1);
      btnGfx.fillRoundedRect(btnX, btnY, btnW, btnH, 6);
      btnGfx.lineStyle(1, btnBorder, 1);
      btnGfx.strokeRoundedRect(btnX, btnY, btnW, btnH, 6);
      container.add(btnGfx);

      const btnLabel = this.add.text(CARD_W / 2, btnY + btnH / 2, costStr, {
        fontFamily: '"Courier New", monospace',
        fontSize: '14px',
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
          btnGfx.fillRoundedRect(btnX, btnY, btnW, btnH, 6);
          btnGfx.lineStyle(1, 0x77cc77, 1);
          btnGfx.strokeRoundedRect(btnX, btnY, btnW, btnH, 6);
        });
        hitZone.on('pointerout', () => {
          btnGfx.clear();
          btnGfx.fillStyle(btnColor, 1);
          btnGfx.fillRoundedRect(btnX, btnY, btnW, btnH, 6);
          btnGfx.lineStyle(1, btnBorder, 1);
          btnGfx.strokeRoundedRect(btnX, btnY, btnW, btnH, 6);
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
