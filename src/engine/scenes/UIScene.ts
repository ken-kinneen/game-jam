import { eventBus, type EventGroup } from '../core/EventBus';
import { registry } from '../core/ContentRegistry';
import { configManager } from '../core/ConfigManager';
import { inventoryManager } from '../core/InventoryManager';
import { CaveMinimap } from '../ui/CaveMinimap';
import type { CaveMinimapSnapshot } from '../systems/CaveExploration';

const BAR_WIDTH = 360;
const BAR_HEIGHT = 28;
const HUD_PADDING = 32;

/** HUD overlay: lamp fuel bar, trash counter, status messages. Driven entirely by events. */
export class UIScene extends Phaser.Scene {
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
  private questText!: Phaser.GameObjects.Text;
  private cableEfficiencyText!: Phaser.GameObjects.Text;
  private homeTitle!: Phaser.GameObjects.Text;
  private caveMinimap!: CaveMinimap;

  private currentFuelRatio = 1;
  private displayedFuelRatio = 1;
  private statusTimer: Phaser.Time.TimerEvent | null = null;

  private isCave = false;
  private minimapUnlocked = true;
  private minimapUnlockAt: number | null = null;
  private initialSceneId: string | undefined;

  constructor() {
    super({ key: 'UIScene', active: false });
  }

  init(data: { sceneId?: string }) {
    this.initialSceneId = data.sceneId;
  }

  create() {
    this.eventGroup = eventBus.createGroup();
    this.currentFuelRatio = 1;
    this.displayedFuelRatio = 1;

    this.buildHUD();
    this.caveMinimap = new CaveMinimap(this);
    this.bindEvents();
    this.bindMapKeys();
    this.refreshTrashDisplay();

    const activeSceneId = this.initialSceneId ?? 'core:home';
    const sceneDef = registry.get('scene', activeSceneId);
    this.setMode(sceneDef?.kind === 'cave', sceneDef?.quest?.minimapUnlockAt);
  }

  update() {
    if (this.isCave) {
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

      this.syncMinimap();
    }
  }

  private setMode(cave: boolean, minimapUnlockAt?: number): void {
    if (!cave && this.caveMinimap.isExpanded) {
      this.setMapExpanded(false);
    }
    this.isCave = cave;
    this.minimapUnlockAt = cave && minimapUnlockAt ? minimapUnlockAt : null;
    this.minimapUnlocked = this.minimapUnlockAt === null;

    this.hudBg.setVisible(cave);
    this.fuelBarBg.setVisible(cave);
    this.fuelBarFill.setVisible(cave);
    this.fuelLabel.setVisible(cave);
    this.fuelValueText.setVisible(cave);
    this.lampWarning.setVisible(false);
    this.cableEfficiencyText.setVisible(false);
    if (!cave) this.questText.setVisible(false);
    this.caveMinimap.setActive(cave);
    this.caveMinimap.setUnlocked(this.minimapUnlocked);

    this.homeTitle.setVisible(!cave);
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

    this.cableEfficiencyText = this.add
      .text(HUD_PADDING + 92, HUD_PADDING + 7, '', {
        fontFamily: '"Courier New", monospace',
        fontSize: '15px',
        color: '#ffd36a',
        fontStyle: 'bold',
      })
      .setScrollFactor(0)
      .setDepth(102)
      .setVisible(false);

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

    this.questText = this.add
      .text(HUD_PADDING, HUD_PADDING + 150, '', {
        fontFamily: '"Courier New", monospace',
        fontSize: '20px',
        color: '#f4e8c1',
        backgroundColor: '#080a0ed9',
        padding: { x: 12, y: 10 },
        stroke: '#000000',
        strokeThickness: 3,
        lineSpacing: 4,
      })
      .setScrollFactor(0)
      .setDepth(103)
      .setAlpha(0)
      .setVisible(false);

    this.homeTitle = this.add
      .text(w / 2, HUD_PADDING, 'HOME BASE', {
        fontFamily: '"Courier New", monospace',
        fontSize: '36px',
        color: '#88ff88',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(101)
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

  private refreshTrashDisplay(): void {
    this.trashText.setText(String(inventoryManager.totalCount()));
  }

  private syncMinimap(): void {
    const gameScene = this.scene.get('GameScene') as Phaser.Scene & {
      getCaveMinimapSnapshot?: () => CaveMinimapSnapshot | null;
    };
    this.caveMinimap.sync(gameScene.getCaveMinimapSnapshot?.() ?? null);
  }

  private bindMapKeys(): void {
    this.input.keyboard?.on('keydown-TAB', this.handleMapToggle, this);
    this.input.keyboard?.on('keydown-ESC', this.handleMapClose, this);
  }

  private handleMapToggle(event: KeyboardEvent): void {
    event.preventDefault();
    if (!this.isCave) return;
    if (!this.minimapUnlocked) {
      this.showStatus('CAVE SCANNER OFFLINE\nRestore more transformers', '#d6b96b', 1800);
      return;
    }
    this.setMapExpanded(!this.caveMinimap.isExpanded);
  }

  private handleMapClose(event: KeyboardEvent): void {
    if (!this.caveMinimap.isExpanded) return;
    event.preventDefault();
    this.setMapExpanded(false);
  }

  private setMapExpanded(expanded: boolean): void {
    if (this.caveMinimap.isExpanded === expanded) return;
    this.caveMinimap.setExpanded(expanded);
    eventBus.emit(expanded ? 'map:opened' : 'map:closed', {});
  }

  private bindEvents(): void {
    this.eventGroup.on('item:picked_up', ({ qty }) => {
      this.showStatus(`+${qty} picked up`);
    });

    this.eventGroup.on('inventory:changed', () => {
      this.refreshTrashDisplay();
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

    this.eventGroup.on('quest:updated', ({ title, current, total, complete }) => {
      const heading = complete ? 'OBJECTIVE COMPLETE' : 'OBJECTIVE';
      this.questText.setText(`${heading}\n${title}\nTransformers activated: ${current} / ${total}`);
      this.questText.setVisible(true);
      this.tweens.killTweensOf(this.questText);
      this.tweens.add({ targets: this.questText, alpha: 1, duration: 250 });
    });

    this.eventGroup.on('quest:cleared', () => {
      this.questText.setVisible(false);
    });

    this.eventGroup.on('transformer:activated', ({ activated }) => {
      if (
        this.minimapUnlockAt !== null &&
        !this.minimapUnlocked &&
        activated >= this.minimapUnlockAt
      ) {
        this.minimapUnlocked = true;
        this.caveMinimap.setUnlocked(true);
        this.showStatus('CAVE SCANNER ONLINE\nMINIMAP UNLOCKED', '#8fe8ff', 2600);
        eventBus.emit('minimap:unlocked', {});
      }
    });

    this.eventGroup.on('cable:proximity_changed', ({ powered, fuelMultiplier }) => {
      this.cableEfficiencyText.setText(
        powered ? `POWER CABLE  -${Math.round((1 - fuelMultiplier) * 100)}% FUEL` : '',
      );
      this.cableEfficiencyText.setVisible(this.isCave && powered);
      if (powered) this.showStatus('POWER CABLE LINKED\nFuel drain reduced', '#ffd36a', 1500);
    });

    this.eventGroup.on('scene:enter', ({ sceneId }) => {
      const sceneDef = registry.get('scene', sceneId);
      const cave = sceneDef?.kind === 'cave';
      this.setMode(cave, sceneDef?.quest?.minimapUnlockAt);

      if (cave) {
        this.currentFuelRatio = 1;
        this.displayedFuelRatio = 1;
        this.drawFuelBar();
      }
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
    if (this.caveMinimap?.isExpanded) this.setMapExpanded(false);
    this.input.keyboard?.off('keydown-TAB', this.handleMapToggle, this);
    this.input.keyboard?.off('keydown-ESC', this.handleMapClose, this);
    this.eventGroup?.clear();
  }
}
