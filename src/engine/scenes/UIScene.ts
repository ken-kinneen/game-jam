import { eventBus, type EventGroup } from '../core/EventBus';

/** HUD overlay scene, runs in parallel on top of GameScene. Listens to events, never touches game objects. */
export class UIScene extends Phaser.Scene {
  private trashCount = 0;
  private trashText!: Phaser.GameObjects.Text;
  private healthText!: Phaser.GameObjects.Text;
  private eventGroup!: EventGroup;

  constructor() {
    super({ key: 'UIScene', active: false });
  }

  create() {
    this.eventGroup = eventBus.createGroup();
    this.trashCount = 0;

    this.trashText = this.add
      .text(16, 16, 'Trash: 0', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setScrollFactor(0)
      .setDepth(100);

    this.healthText = this.add
      .text(16, 40, '', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#ff6666',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setScrollFactor(0)
      .setDepth(100);

    this.eventGroup.on('item:picked_up', ({ qty }) => {
      this.trashCount += qty;
      this.trashText.setText(`Trash: ${this.trashCount}`);
    });

    this.eventGroup.on('player:damaged', ({ amount }) => {
      this.healthText.setText(`-${amount} HP!`);
      this.time.delayedCall(1000, () => {
        this.healthText.setText('');
      });
    });

    this.eventGroup.on('inventory:full', () => {
      this.healthText.setText('Inventory full!');
      this.time.delayedCall(1500, () => {
        this.healthText.setText('');
      });
    });
  }

  /** Reset HUD state (e.g., on new run). */
  resetCount(): void {
    this.trashCount = 0;
    this.trashText?.setText('Trash: 0');
  }

  shutdown() {
    this.eventGroup?.clear();
  }
}
