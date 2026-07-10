import { eventBus, type EventGroup } from '../core/EventBus';
import { registry } from '../core/ContentRegistry';
import type { UpgradeDef } from '../schemas/upgrade.schema';
import { UpgradeSystem } from '../systems/UpgradeSystem';

const PANEL_PCT = 0.15;
const CARD_W = 220;
const CARD_H = 160;
const CARD_GAP = 20;
const COLS = 3;

/** Full-screen overlay shop for browsing and buying upgrades. */
export class ShopScene extends Phaser.Scene {
  private eventGroup!: EventGroup;
  private upgradeSystem!: UpgradeSystem;
  private backdrop!: Phaser.GameObjects.Graphics;
  private panel!: Phaser.GameObjects.Graphics;
  private titleText!: Phaser.GameObjects.Text;
  private closeHint!: Phaser.GameObjects.Text;
  private cardContainers: Phaser.GameObjects.Container[] = [];
  private escKey!: Phaser.Input.Keyboard.Key;

  constructor() {
    super({ key: 'ShopScene', active: false });
  }

  create() {
    this.eventGroup = eventBus.createGroup();
    this.upgradeSystem = new UpgradeSystem(eventBus);
    this.cardContainers = [];

    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    this.backdrop = this.add.graphics();
    this.backdrop.fillStyle(0x000000, 0.7);
    this.backdrop.fillRect(0, 0, w, h);
    this.backdrop.setDepth(0);

    const marginX = Math.round(w * PANEL_PCT);
    const marginY = Math.round(h * PANEL_PCT);
    const panelX = marginX;
    const panelY = marginY;
    const panelW = w - marginX * 2;
    const panelH = h - marginY * 2;

    this.panel = this.add.graphics();
    this.panel.fillStyle(0x1a1a2e, 0.95);
    this.panel.fillRoundedRect(panelX, panelY, panelW, panelH, 16);
    this.panel.lineStyle(2, 0x444466, 1);
    this.panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 16);
    this.panel.setDepth(1);

    this.titleText = this.add.text(w / 2, panelY + 28, 'UPGRADES', {
      fontFamily: '"Courier New", monospace',
      fontSize: '40px',
      color: '#ffcc44',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    });
    this.titleText.setOrigin(0.5, 0);
    this.titleText.setDepth(2);

    this.closeHint = this.add.text(w / 2, panelY + panelH - 30, '[ESC] Close', {
      fontFamily: '"Courier New", monospace',
      fontSize: '20px',
      color: '#888888',
    });
    this.closeHint.setOrigin(0.5, 0.5);
    this.closeHint.setDepth(2);

    this.buildCards();

    this.escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

    this.eventGroup.on('upgrade:acquired', () => {
      this.refreshCards();
    });

    eventBus.emit('shop:opened', {});
  }

  update() {
    if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
      this.closeShop();
    }
  }

  private closeShop(): void {
    eventBus.emit('shop:closed', {});
    this.scene.stop('ShopScene');
  }

  private buildCards(): void {
    const upgrades = registry.getAll('upgrade') as UpgradeDef[];
    if (upgrades.length === 0) return;

    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const panelTop = Math.round(h * PANEL_PCT) + 80;

    const totalW = COLS * CARD_W + (COLS - 1) * CARD_GAP;
    const startX = (w - totalW) / 2;

    for (let i = 0; i < upgrades.length; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const cx = startX + col * (CARD_W + CARD_GAP);
      const cy = panelTop + row * (CARD_H + CARD_GAP);
      const card = this.buildCard(upgrades[i], cx, cy);
      this.cardContainers.push(card);
    }
  }

  private refreshCards(): void {
    for (const c of this.cardContainers) {
      c.destroy();
    }
    this.cardContainers = [];
    this.buildCards();
  }

  private buildCard(upg: UpgradeDef, x: number, y: number): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    container.setDepth(3);

    const owned = this.upgradeSystem.hasUpgrade(upg.id);
    const canBuy = this.upgradeSystem.canAcquire(upg);

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
    const rarityText = this.add.text(CARD_W / 2, 10, rarityLabel, {
      fontFamily: '"Courier New", monospace',
      fontSize: '11px',
      color: '#' + (rarityGlow[upg.rarity] ?? 0x888888).toString(16).padStart(6, '0'),
    });
    rarityText.setOrigin(0.5, 0);
    container.add(rarityText);

    const nameColor = owned ? '#66aa66' : '#ffffff';
    const nameText = this.add.text(CARD_W / 2, 26, upg.name, {
      fontFamily: '"Courier New", monospace',
      fontSize: '18px',
      color: nameColor,
      fontStyle: 'bold',
    });
    nameText.setOrigin(0.5, 0);
    container.add(nameText);

    const effectParts: string[] = [];
    for (const eff of upg.effects) {
      if (eff.kind === 'stat') {
        const sign = eff.value >= 0 ? '+' : '';
        const pct = eff.mod === 'flat' ? '' : '%';
        const val = eff.mod === 'flat' ? eff.value : Math.round(eff.value * 100);
        effectParts.push(`${sign}${val}${pct} ${eff.stat}`);
      }
    }
    const effectText = this.add.text(CARD_W / 2, 52, effectParts.join('\n'), {
      fontFamily: '"Courier New", monospace',
      fontSize: '13px',
      color: '#88ccff',
      align: 'center',
    });
    effectText.setOrigin(0.5, 0);
    container.add(effectText);

    const costParts: string[] = [];
    for (const [itemId, qty] of Object.entries(upg.cost)) {
      const itemDef = registry.get('item', itemId);
      const name = itemDef?.name ?? itemId.split(':')[1];
      costParts.push(`${qty} ${name}`);
    }
    const costStr = costParts.length > 0 ? costParts.join(', ') : 'Free';

    if (upg.requires.length > 0 && !canBuy && !owned) {
      const reqNames = upg.requires.map((r) => {
        const def = registry.get('upgrade', r);
        return def?.name ?? r.split(':')[1];
      });
      const reqText = this.add.text(CARD_W / 2, 86, `Requires: ${reqNames.join(', ')}`, {
        fontFamily: '"Courier New", monospace',
        fontSize: '11px',
        color: '#ff6666',
      });
      reqText.setOrigin(0.5, 0);
      container.add(reqText);
    }

    if (owned) {
      const ownedText = this.add.text(CARD_W / 2, CARD_H - 30, 'OWNED', {
        fontFamily: '"Courier New", monospace',
        fontSize: '16px',
        color: '#66aa66',
        fontStyle: 'bold',
      });
      ownedText.setOrigin(0.5, 0.5);
      container.add(ownedText);
    } else {
      const btnY = CARD_H - 36;
      const btnW = CARD_W - 30;
      const btnH = 28;
      const btnX = (CARD_W - btnW) / 2;

      const btnColor = canBuy ? 0x335533 : 0x333333;
      const btnBorder = canBuy ? 0x55aa55 : 0x555555;
      const btnTextColor = canBuy ? '#aaffaa' : '#666666';

      const btnGfx = this.add.graphics();
      btnGfx.fillStyle(btnColor, 1);
      btnGfx.fillRoundedRect(btnX, btnY, btnW, btnH, 6);
      btnGfx.lineStyle(1, btnBorder, 1);
      btnGfx.strokeRoundedRect(btnX, btnY, btnW, btnH, 6);
      container.add(btnGfx);

      const btnLabel = this.add.text(CARD_W / 2, btnY + btnH / 2, costStr, {
        fontFamily: '"Courier New", monospace',
        fontSize: '12px',
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
    // TODO: deduct cost from player inventory once inventory spending is wired
    this.upgradeSystem.acquire(upg, this.getPlayerStats());
  }

  /** Reach into the running GameScene to get the player's StatSheet. */
  private getPlayerStats(): import('../stats/StatSheet').StatSheet {
    const gameScene = this.scene.get('GameScene') as Phaser.Scene & {
      getPlayerStats?: () => import('../stats/StatSheet').StatSheet;
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
