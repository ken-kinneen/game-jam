import { eventBus, type EventGroup } from '../core/EventBus';
import { registry } from '../core/ContentRegistry';
import { inventoryManager } from '../core/InventoryManager';
import type { UpgradeDef } from '../schemas/upgrade.schema';
import { UpgradeSystem } from '../systems/UpgradeSystem';
import type { StatSheet } from '../stats/StatSheet';

const DPR = Math.min(window.devicePixelRatio || 1, 2);

const STAT_LABELS: Record<string, string> = {
  moveSpeed: 'SPD',
  pickupRadius: 'RNG',
  maxHealth: 'HP',
  damage: 'DMG',
  attackSpeed: 'ATK',
  carryCapacity: 'CAP',
  luck: 'LCK',
  glowRadius: 'LAMP',
  fuelBurnRate: 'FUEL',
};

const STAT_FULL_LABELS: Record<string, string> = {
  moveSpeed: 'Move Speed',
  pickupRadius: 'Pickup Range',
  maxHealth: 'Max Health',
  damage: 'Damage',
  attackSpeed: 'Attack Speed',
  carryCapacity: 'Carry Capacity',
  luck: 'Luck',
  glowRadius: 'Lamp Radius',
  fuelBurnRate: 'Fuel Burn Rate',
};

const STAT_MAX: Record<string, number> = {
  moveSpeed: 500,
  pickupRadius: 100,
  maxHealth: 300,
  damage: 50,
  attackSpeed: 5,
  carryCapacity: 50,
  luck: 20,
  glowRadius: 500,
  fuelBurnRate: 2,
};

const RARITY_BORDER: Record<string, number> = {
  common: 0x665544,
  uncommon: 0x558844,
  rare: 0xcc8844,
  legendary: 0xddaa33,
};

const BEHAVIOR_COLORS: Record<string, number> = {
  lamp_color_blue: 0x66aaff,
  lamp_color_purple: 0xcc66ff,
  lamp_color_orange: 0xff8822,
};

/** Scales px by DPR → CSS font-size string. */
function fs(px: number): string {
  return `${Math.round(px * DPR)}px`;
}

/** Scales a value by DPR. */
function d(px: number): number {
  return Math.round(px * DPR);
}

function statLabel(stat: string): string {
  return STAT_LABELS[stat] ?? stat.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
}

function statFullLabel(stat: string): string {
  return (
    STAT_FULL_LABELS[stat] ?? stat.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())
  );
}

const FONT = '"Courier New", monospace';
const MARGIN = d(28);
const CARD_H = d(52);
const CARD_GAP = d(5);
const SCROLL_SPEED = d(36);
const LEFT_RATIO = 0.56;

// Warm palette
const COL_BG = 0x0c0a08;
const COL_PANEL = 0x1a1610;
const COL_CARD = 0x1e1a14;
const COL_CARD_HOVER = 0x2a2418;
const COL_BORDER = 0x3a3228;
const COL_GOLD = '#ffcc44';
const COL_GREEN = '#88ff88';
const COL_TEXT = '#ccbbaa';
const COL_TEXT_DIM = '#887766';
const COL_TEXT_FAINT = '#554433';
const COL_BAR_BG = 0x1a1610;
const COL_BAR_FILL = 0xffaa22;
const COL_BAR_UPGRADED = 0x88ff88;

/** Full-screen upgrade menu: scrollable list on left, character + stats on right. */
export class UpgradeScene extends Phaser.Scene {
  private eventGroup!: EventGroup;
  private upgradeSystem!: UpgradeSystem;
  private escKey!: Phaser.Input.Keyboard.Key;
  private eKey!: Phaser.Input.Keyboard.Key;

  private scrollContainer!: Phaser.GameObjects.Container;
  private scrollY = 0;
  private maxScrollY = 0;
  private listTop = 0;
  private listHeight = 0;
  private listLeft = 0;
  private listWidth = 0;

  private statBarObjects: Phaser.GameObjects.GameObject[] = [];
  private cardObjects: Phaser.GameObjects.Container[] = [];

  private rightX = 0;
  private rightW = 0;
  private w = 0;
  private h = 0;

  constructor() {
    super({ key: 'UpgradeScene', active: false });
  }

  create(): void {
    this.eventGroup = eventBus.createGroup();
    this.upgradeSystem = new UpgradeSystem(eventBus);
    this.cardObjects = [];
    this.statBarObjects = [];
    this.scrollY = 0;

    this.w = this.cameras.main.width;
    this.h = this.cameras.main.height;

    const leftW = Math.round(this.w * LEFT_RATIO);
    this.rightX = leftW;
    this.rightW = this.w - leftW;

    this.buildBackdrop();
    this.buildHeader();
    this.buildUpgradeList(leftW);
    this.buildRightPanel();

    this.escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.eKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    this.input.on('wheel', (_p: unknown, _g: unknown, _dx: number, dy: number) => {
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

  /* ── Backdrop ── */

  private buildBackdrop(): void {
    const gfx = this.add.graphics();
    gfx.fillStyle(COL_BG, 0.94);
    gfx.fillRect(0, 0, this.w, this.h);
    gfx.setDepth(0);
  }

  /* ── Header ── */

  private buildHeader(): void {
    const barH = d(42);
    const gfx = this.add.graphics();
    gfx.fillStyle(0x151210, 0.95);
    gfx.fillRect(0, 0, this.w, barH);
    gfx.lineStyle(1, COL_BORDER, 0.3);
    gfx.lineBetween(0, barH, this.w, barH);
    gfx.setDepth(1);

    this.add
      .text(MARGIN, barH / 2, 'UPGRADES', {
        fontFamily: FONT,
        fontSize: fs(22),
        color: COL_GOLD,
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5)
      .setDepth(2);

    const items = inventoryManager.getAll();
    const parts: string[] = [];
    for (const { itemId, qty } of items) {
      const def = registry.get('item', itemId);
      const name = def?.name ?? itemId.split(':')[1];
      parts.push(`${name}: ${qty}`);
    }
    const invStr = parts.length > 0 ? parts.join('   ') : 'Empty pockets';
    this.add
      .text(this.w - MARGIN, barH / 2, invStr, {
        fontFamily: FONT,
        fontSize: fs(11),
        color: COL_TEXT_DIM,
      })
      .setOrigin(1, 0.5)
      .setDepth(2);
  }

  /* ── Upgrade list (left) ── */

  private buildUpgradeList(leftW: number): void {
    this.listTop = d(52);
    this.listLeft = MARGIN;
    this.listWidth = leftW - MARGIN - d(12);
    this.listHeight = this.h - this.listTop - d(16);

    this.scrollContainer = this.add.container(0, 0).setDepth(3);

    const maskGfx = this.add.graphics();
    maskGfx.fillStyle(0xffffff, 1);
    maskGfx.fillRect(this.listLeft, this.listTop, this.listWidth, this.listHeight);
    maskGfx.setVisible(false);
    this.scrollContainer.setMask(new Phaser.Display.Masks.GeometryMask(this, maskGfx));

    this.buildCards();
  }

  private buildCards(): void {
    for (const c of this.cardObjects) c.destroy();
    this.cardObjects = [];
    this.scrollContainer.removeAll();

    const upgrades = registry.getAll('upgrade') as UpgradeDef[];
    if (upgrades.length === 0) return;

    let y = this.listTop + d(4);

    for (const upg of upgrades) {
      const card = this.buildCard(upg, this.listLeft, y);
      this.scrollContainer.add(card);
      this.cardObjects.push(card);
      y += CARD_H + CARD_GAP;
    }

    const totalH = upgrades.length * (CARD_H + CARD_GAP) + d(8);
    this.maxScrollY = Math.max(0, totalH - this.listHeight);
    this.scrollY = Phaser.Math.Clamp(this.scrollY, 0, this.maxScrollY);
    this.scrollContainer.y = -this.scrollY;
  }

  private buildCard(upg: UpgradeDef, x: number, y: number): Phaser.GameObjects.Container {
    const cardW = this.listWidth;
    const container = this.add.container(x, y);

    const owned = this.upgradeSystem.hasUpgrade(upg.id);
    const meetsReqs = upg.requires.every((r) => this.upgradeSystem.hasUpgrade(r));
    const canBuy = this.upgradeSystem.canAcquire(upg) && inventoryManager.canAfford(upg.cost);
    const locked = !meetsReqs && !owned;

    const border = owned ? 0x446633 : (RARITY_BORDER[upg.rarity] ?? 0x665544);
    const bgColor = owned ? 0x141a10 : locked ? 0x12100e : COL_CARD;
    const bgAlpha = owned ? 0.6 : locked ? 0.45 : 0.85;

    const bg = this.add.graphics();
    bg.fillStyle(bgColor, bgAlpha);
    bg.fillRoundedRect(0, 0, cardW, CARD_H, d(4));
    bg.lineStyle(d(1), border, owned ? 0.5 : 0.7);
    bg.strokeRoundedRect(0, 0, cardW, CARD_H, d(4));
    container.add(bg);

    const pad = d(10);
    const nameY = d(8);

    // Rarity dot
    const rarityCol = RARITY_BORDER[upg.rarity] ?? 0x665544;
    const dot = this.add.graphics();
    dot.fillStyle(rarityCol, 1);
    dot.fillCircle(pad + d(4), nameY + d(5), d(3));
    container.add(dot);

    // Name
    const nameColor = owned ? '#77aa55' : locked ? '#665544' : COL_TEXT;
    const nameText = this.add.text(pad + d(14), nameY, upg.name, {
      fontFamily: FONT,
      fontSize: fs(13),
      color: nameColor,
      fontStyle: 'bold',
    });
    container.add(nameText);

    // Effect line
    const effectY = nameY + d(18);
    let effectStr = '';
    for (const eff of upg.effects) {
      if (eff.kind === 'stat') {
        const sign = eff.value >= 0 ? '+' : '';
        const pct = eff.mod === 'flat' ? '' : '%';
        const val = eff.mod === 'flat' ? eff.value : Math.round(eff.value * 100);
        const label = statLabel(eff.stat);
        effectStr += `${label} ${sign}${val}${pct}  `;
      } else if (eff.kind === 'behavior') {
        const colorHex = BEHAVIOR_COLORS[eff.behavior];
        if (colorHex !== undefined) {
          const sw = this.add.graphics();
          sw.fillStyle(colorHex, 1);
          sw.fillCircle(pad + d(4), effectY + d(5), d(4));
          sw.lineStyle(1, 0x000000, 0.3);
          sw.strokeCircle(pad + d(4), effectY + d(5), d(4));
          container.add(sw);
        }
        effectStr += eff.description ?? eff.behavior;
      }
    }

    if (effectStr.trim()) {
      const hasBehaviorDot = upg.effects.some(
        (e) => e.kind === 'behavior' && BEHAVIOR_COLORS[e.behavior],
      );
      const effX = hasBehaviorDot ? pad + d(14) : pad;
      const effText = this.add.text(effX, effectY, effectStr.trim(), {
        fontFamily: FONT,
        fontSize: fs(10),
        color: locked ? COL_TEXT_FAINT : COL_TEXT_DIM,
      });
      container.add(effText);
    }

    // Right side
    const rPad = cardW - pad;

    if (owned) {
      const badge = this.add.text(rPad, CARD_H / 2, 'OWNED', {
        fontFamily: FONT,
        fontSize: fs(11),
        color: '#557744',
        fontStyle: 'bold',
      });
      badge.setOrigin(1, 0.5);
      container.add(badge);
    } else if (locked) {
      const reqNames = upg.requires
        .filter((r) => !this.upgradeSystem.hasUpgrade(r))
        .map((r) => {
          const def = registry.get('upgrade', r);
          return def?.name ?? r.split(':')[1];
        });
      const lockText = this.add.text(rPad, CARD_H / 2, `Needs: ${reqNames.join(', ')}`, {
        fontFamily: FONT,
        fontSize: fs(10),
        color: '#774433',
      });
      lockText.setOrigin(1, 0.5);
      container.add(lockText);
    } else {
      const costParts: string[] = [];
      for (const [itemId, qty] of Object.entries(upg.cost)) {
        const itemDef = registry.get('item', itemId);
        const name = itemDef?.name ?? itemId.split(':')[1];
        costParts.push(`${qty} ${name}`);
      }
      const costStr = costParts.length > 0 ? costParts.join(', ') : 'Free';

      const btnW = d(100);
      const btnH = d(26);
      const btnX = cardW - pad - btnW;
      const btnY = (CARD_H - btnH) / 2;

      const btnBg = canBuy ? 0x2a2a18 : 0x1a1814;
      const btnBorderCol = canBuy ? 0x88aa44 : 0x443e30;
      const btnTextCol = canBuy ? COL_GOLD : COL_TEXT_FAINT;

      const btnGfx = this.add.graphics();
      btnGfx.fillStyle(btnBg, 1);
      btnGfx.fillRoundedRect(btnX, btnY, btnW, btnH, d(3));
      btnGfx.lineStyle(1, btnBorderCol, 0.8);
      btnGfx.strokeRoundedRect(btnX, btnY, btnW, btnH, d(3));
      container.add(btnGfx);

      const btnLabel = this.add.text(btnX + btnW / 2, btnY + btnH / 2, costStr, {
        fontFamily: FONT,
        fontSize: fs(9),
        color: btnTextCol,
        fontStyle: 'bold',
        wordWrap: { width: btnW - d(6) },
        align: 'center',
      });
      btnLabel.setOrigin(0.5, 0.5);
      container.add(btnLabel);

      if (canBuy) {
        const hit = this.add.zone(0, 0, cardW, CARD_H).setOrigin(0, 0).setInteractive();
        container.add(hit);

        hit.on('pointerover', () => {
          bg.clear();
          bg.fillStyle(COL_CARD_HOVER, 0.95);
          bg.fillRoundedRect(0, 0, cardW, CARD_H, d(4));
          bg.lineStyle(d(1), 0x88aa44, 1);
          bg.strokeRoundedRect(0, 0, cardW, CARD_H, d(4));
          btnGfx.clear();
          btnGfx.fillStyle(0x3a3820, 1);
          btnGfx.fillRoundedRect(btnX, btnY, btnW, btnH, d(3));
          btnGfx.lineStyle(1, 0xaacc55, 1);
          btnGfx.strokeRoundedRect(btnX, btnY, btnW, btnH, d(3));
        });
        hit.on('pointerout', () => {
          bg.clear();
          bg.fillStyle(bgColor, bgAlpha);
          bg.fillRoundedRect(0, 0, cardW, CARD_H, d(4));
          bg.lineStyle(d(1), border, 0.7);
          bg.strokeRoundedRect(0, 0, cardW, CARD_H, d(4));
          btnGfx.clear();
          btnGfx.fillStyle(btnBg, 1);
          btnGfx.fillRoundedRect(btnX, btnY, btnW, btnH, d(3));
          btnGfx.lineStyle(1, btnBorderCol, 0.8);
          btnGfx.strokeRoundedRect(btnX, btnY, btnW, btnH, d(3));
        });
        hit.on('pointerdown', () => this.buyUpgrade(upg));
      }
    }

    return container;
  }

  private scrollList(dy: number): void {
    this.scrollY = Phaser.Math.Clamp(this.scrollY + dy, 0, this.maxScrollY);
    this.scrollContainer.y = -this.scrollY;
  }

  /* ── Right panel ── */

  private buildRightPanel(): void {
    const px = this.rightX + d(12);
    const pw = this.rightW - d(24);
    const topY = d(52);

    // Character
    const charH = d(150);
    const charBg = this.add.graphics();
    charBg.fillStyle(COL_PANEL, 0.8);
    charBg.fillRoundedRect(px, topY, pw, charH, d(5));
    charBg.lineStyle(1, COL_BORDER, 0.3);
    charBg.strokeRoundedRect(px, topY, pw, charH, d(5));
    charBg.setDepth(1);

    if (this.textures.exists('player/walk')) {
      const sprite = this.add.sprite(px + pw / 2, topY + charH / 2, 'player/walk', 0);
      const targetH = charH - d(24);
      sprite.setScale(targetH / sprite.height).setDepth(2);
    }

    this.add
      .text(px + pw / 2, topY + charH - d(6), 'TRASH COLLECTOR', {
        fontFamily: FONT,
        fontSize: fs(9),
        color: COL_TEXT_DIM,
        letterSpacing: d(1),
      })
      .setOrigin(0.5, 1)
      .setDepth(2);

    // Stats
    const statsY = topY + charH + d(8);
    const statsH = this.h - statsY - d(16);

    const statsBg = this.add.graphics();
    statsBg.fillStyle(COL_PANEL, 0.8);
    statsBg.fillRoundedRect(px, statsY, pw, statsH, d(5));
    statsBg.lineStyle(1, COL_BORDER, 0.3);
    statsBg.strokeRoundedRect(px, statsY, pw, statsH, d(5));
    statsBg.setDepth(1);

    this.add
      .text(px + d(12), statsY + d(10), 'STATS', {
        fontFamily: FONT,
        fontSize: fs(11),
        color: COL_GOLD,
        fontStyle: 'bold',
      })
      .setDepth(2);

    this.buildStatBars(px + d(10), statsY + d(28), pw - d(20));
  }

  private buildStatBars(x: number, startY: number, w: number): void {
    for (const obj of this.statBarObjects) obj.destroy();
    this.statBarObjects = [];

    let stats: StatSheet;
    try {
      stats = this.getPlayerStats();
    } catch {
      return;
    }

    const allStats = stats.allStats();
    const barH = d(8);
    const rowH = d(30);
    let y = startY;

    for (const stat of allStats) {
      const base = stats.getBase(stat);
      const final = stats.get(stat);
      const max = STAT_MAX[stat] ?? base * 3;
      const changed = Math.abs(final - base) > 0.001;

      const label = this.add.text(x, y, statFullLabel(stat), {
        fontFamily: FONT,
        fontSize: fs(10),
        color: COL_TEXT_DIM,
      });
      label.setDepth(3);
      this.statBarObjects.push(label);

      const valStr = Number.isInteger(final) ? String(final) : final.toFixed(1);
      const valColor = changed ? COL_GREEN : COL_TEXT_DIM;
      const valText = this.add.text(x + w, y, valStr, {
        fontFamily: FONT,
        fontSize: fs(10),
        color: valColor,
        fontStyle: changed ? 'bold' : 'normal',
      });
      valText.setOrigin(1, 0).setDepth(3);
      this.statBarObjects.push(valText);

      if (changed) {
        const diff = final - base;
        const sign = diff > 0 ? '+' : '';
        const diffStr = Number.isInteger(diff) ? `${sign}${diff}` : `${sign}${diff.toFixed(1)}`;
        const diffCol = diff > 0 ? '#88cc44' : '#cc6633';
        const diffText = this.add.text(x + w - valText.width - d(6), y, diffStr, {
          fontFamily: FONT,
          fontSize: fs(9),
          color: diffCol,
        });
        diffText.setOrigin(1, 0).setDepth(3);
        this.statBarObjects.push(diffText);
      }

      const barY = y + d(14);
      const barGfx = this.add.graphics();
      barGfx.fillStyle(COL_BAR_BG, 1);
      barGfx.fillRoundedRect(x, barY, w, barH, d(2));
      barGfx.setDepth(2);
      this.statBarObjects.push(barGfx);

      // Base fill — warm amber
      const baseRatio = Math.min(base / max, 1);
      if (baseRatio > 0.005) {
        const baseFill = this.add.graphics();
        baseFill.fillStyle(COL_BAR_FILL, 0.3);
        baseFill.fillRoundedRect(x, barY, Math.max(d(4), w * baseRatio), barH, d(2));
        baseFill.setDepth(2);
        this.statBarObjects.push(baseFill);
      }

      // Final fill — bright amber, or green if upgraded
      const finalRatio = Math.min(Math.abs(final) / max, 1);
      if (finalRatio > 0.005) {
        const fillColor = changed ? COL_BAR_UPGRADED : COL_BAR_FILL;
        const finalFill = this.add.graphics();
        finalFill.fillStyle(fillColor, 0.75);
        finalFill.fillRoundedRect(x, barY, Math.max(d(4), w * finalRatio), barH, d(2));
        finalFill.setDepth(3);
        this.statBarObjects.push(finalFill);
      }

      y += rowH;
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

    const px = this.rightX + d(12);
    const pw = this.rightW - d(24);
    const charH = d(150);
    const statsY = d(52) + charH + d(8);
    this.buildStatBars(px + d(10), statsY + d(28), pw - d(20));
  }

  shutdown(): void {
    this.eventGroup?.clear();
  }
}
