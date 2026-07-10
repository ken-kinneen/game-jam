import { eventBus, type EventGroup } from '../core/EventBus';
import { configManager } from '../core/ConfigManager';

const BAR_WIDTH = 360;
const BAR_HEIGHT = 28;
const HUD_PADDING = 32;

/** HUD overlay: lamp fuel bar, trash counter, status messages. Driven entirely by events. */
export class UIScene extends Phaser.Scene {
  private trashCount = 0;
  private eventGroup!: EventGroup;

  private hudBg!: Phaser.GameObjects.Graphics;
  private fuelBarBg!: Phaser.GameObjects.Graphics;
  private fuelBarFill!: Phaser.GameObjects.Graphics;
  private fuelLabel!: Phaser.GameObjects.Text;
  private fuelValueText!: Phaser.GameObjects.Text;
  private trashIcon!: Phaser.GameObjects.Text;
  private trashText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private lampWarning!: Phaser.GameObjects.Text;

  private currentFuelRatio = 1;
  private displayedFuelRatio = 1;
  private statusTimer: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super({ key: 'UIScene', active: false });
  }

  create() {
    this.eventGroup = eventBus.createGroup();
    this.trashCount = 0;
    this.currentFuelRatio = 1;
    this.displayedFuelRatio = 1;

    this.buildHUD();
    this.bindEvents();
  }

  update() {
    this.displayedFuelRatio = Phaser.Math.Linear(
      this.displayedFuelRatio,
      this.currentFuelRatio,
      0.1,
    );
    this.drawFuelBar();

    const critical = configManager.get<number>('lamp', 'criticalThreshold');
    if (this.currentFuelRatio > 0 && this.currentFuelRatio < critical) {
      const flash = Math.sin(this.time.now * 0.008) > 0;
      this.lampWarning.setVisible(flash);
    } else {
      this.lampWarning.setVisible(false);
    }
  }

  private buildHUD(): void {
    const w = this.cameras.main.width;

    this.hudBg = this.add.graphics();
    this.hudBg.fillStyle(0x000000, 0.5);
    this.hudBg.fillRoundedRect(HUD_PADDING - 8, HUD_PADDING - 8, BAR_WIDTH + 100, 140, 12);
    this.hudBg.setScrollFactor(0).setDepth(100);

    this.fuelLabel = this.add
      .text(HUD_PADDING, HUD_PADDING, 'LAMP', {
        fontFamily: '"Courier New", monospace',
        fontSize: '28px',
        color: '#ffcc44',
        fontStyle: 'bold',
      })
      .setScrollFactor(0)
      .setDepth(101);

    this.fuelBarBg = this.add.graphics();
    this.fuelBarBg.setScrollFactor(0).setDepth(101);

    this.fuelBarFill = this.add.graphics();
    this.fuelBarFill.setScrollFactor(0).setDepth(102);

    this.fuelValueText = this.add
      .text(HUD_PADDING + BAR_WIDTH + 12, HUD_PADDING + 40, '100%', {
        fontFamily: '"Courier New", monospace',
        fontSize: '24px',
        color: '#aaa',
      })
      .setScrollFactor(0)
      .setDepth(102);

    this.drawFuelBar();

    const trashY = HUD_PADDING + 84;

    this.trashIcon = this.add
      .text(HUD_PADDING, trashY, '\u{1F5D1}', {
        fontSize: '36px',
      })
      .setScrollFactor(0)
      .setDepth(101);

    this.trashText = this.add
      .text(HUD_PADDING + 48, trashY + 4, '0', {
        fontFamily: '"Courier New", monospace',
        fontSize: '32px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setScrollFactor(0)
      .setDepth(101);

    this.statusText = this.add
      .text(w / 2, 140, '', {
        fontFamily: '"Courier New", monospace',
        fontSize: '32px',
        color: '#ffcc44',
        stroke: '#000000',
        strokeThickness: 6,
        align: 'center',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(103);

    this.lampWarning = this.add
      .text(HUD_PADDING + BAR_WIDTH / 2, HUD_PADDING + 40 + BAR_HEIGHT / 2, 'LOW FUEL', {
        fontFamily: '"Courier New", monospace',
        fontSize: '20px',
        color: '#ff3333',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(103)
      .setVisible(false);
  }

  private drawFuelBar(): void {
    const barX = HUD_PADDING;
    const barY = HUD_PADDING + 38;
    const ratio = Math.max(0, Math.min(1, this.displayedFuelRatio));

    this.fuelBarBg.clear();
    this.fuelBarBg.fillStyle(0x222222, 1);
    this.fuelBarBg.fillRoundedRect(barX, barY, BAR_WIDTH, BAR_HEIGHT, 6);
    this.fuelBarBg.lineStyle(2, 0x555555, 1);
    this.fuelBarBg.strokeRoundedRect(barX, barY, BAR_WIDTH, BAR_HEIGHT, 6);

    this.fuelBarFill.clear();
    if (ratio > 0.01) {
      const fillW = Math.max(8, ratio * (BAR_WIDTH - 4));
      let color: number;
      if (ratio > 0.5) {
        color = 0xffaa22;
      } else if (ratio > 0.2) {
        color = 0xff6622;
      } else {
        color = 0xff2222;
      }
      this.fuelBarFill.fillStyle(color, 1);
      this.fuelBarFill.fillRoundedRect(barX + 2, barY + 2, fillW, BAR_HEIGHT - 4, 4);
    }

    const pct = Math.round(ratio * 100);
    this.fuelValueText.setText(`${pct}%`);
  }

  private bindEvents(): void {
    this.eventGroup.on('item:picked_up', ({ qty }) => {
      this.trashCount += qty;
      this.trashText.setText(String(this.trashCount));
      this.showStatus(`+${qty} picked up`);
    });

    this.eventGroup.on('lamp:fuel_changed', ({ ratio }) => {
      this.currentFuelRatio = ratio;
    });

    this.eventGroup.on('lamp:refueled', ({ amount }) => {
      this.showStatus(`+${amount} fuel`);
    });

    this.eventGroup.on('lamp:extinguished', () => {
      this.lampWarning.setVisible(false);
      this.showStatus('The lamp went out...', '#ff3333', 3000);
    });

    this.eventGroup.on('inventory:full', () => {
      this.showStatus('Inventory full!', '#ff6644');
    });
  }

  private showStatus(text: string, color = '#ffcc44', duration = 1200): void {
    this.statusText.setText(text);
    this.statusText.setColor(color);
    this.statusText.setAlpha(1);

    if (this.statusTimer) this.statusTimer.destroy();
    this.statusTimer = this.time.delayedCall(duration, () => {
      this.tweens.add({
        targets: this.statusText,
        alpha: 0,
        duration: 400,
      });
    });
  }

  shutdown() {
    this.eventGroup?.clear();
  }
}
