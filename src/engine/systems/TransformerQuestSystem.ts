import { eventBus } from '../core/EventBus';
import { TransformerObjective, type TransformerProgress } from './TransformerObjective';

export interface TransformerQuestConfig {
  title: string;
  completionText: string;
  exitTitle: string;
}

/** Owns transformer quest progress, HUD feedback, and map-completion timing. */
export class TransformerQuestSystem {
  private readonly objective: TransformerObjective;
  private completionTimer: Phaser.Time.TimerEvent | null = null;
  private readyToExit = false;
  private completionStarted = false;

  constructor(
    private readonly scene: Phaser.Scene,
    transformerCount: number,
    private readonly config: TransformerQuestConfig,
    private readonly onComplete: () => void,
  ) {
    this.objective = new TransformerObjective(transformerCount);
  }

  activate(transformerId: string, position: { x: number; y: number }): TransformerProgress {
    const progress = this.objective.activate(transformerId);
    if (!progress.activated) return progress;

    eventBus.emit('transformer:activated', {
      id: transformerId,
      x: position.x,
      y: position.y,
      activated: progress.activatedCount,
      total: progress.total,
      complete: progress.complete,
    });

    if (progress.complete) this.readyToExit = true;
    this.publishObjective();
    this.showActivationFeedback(progress);
    return progress;
  }

  get canExitSuccessfully(): boolean {
    return this.readyToExit;
  }

  showExitBlockedFeedback(): void {
    this.showFeedback('RESTORE ALL TRANSFORMERS\nBEFORE LEAVING', 1000, '#ffb36b');
  }

  completeAtExit(): boolean {
    if (!this.readyToExit || this.completionStarted) return false;
    this.completionStarted = true;
    const { activatedCount, total } = this.objective;
    eventBus.emit('quest:updated', {
      title: this.config.exitTitle,
      current: activatedCount,
      total,
      complete: true,
    });
    this.showFeedback('CAVE POWER RESTORED\nMISSION COMPLETE', 900, '#9dffad');
    this.scheduleCompletion();
    return true;
  }

  destroy(): void {
    this.completionTimer?.remove(false);
    eventBus.emit('quest:cleared', {});
  }

  private publishObjective(): void {
    const { activatedCount, total } = this.objective;
    eventBus.emit('quest:updated', {
      title: this.readyToExit ? this.config.exitTitle : this.config.title,
      current: activatedCount,
      total,
      complete: false,
    });
  }

  private showActivationFeedback(progress: TransformerProgress): void {
    this.scene.cameras.main.flash(progress.complete ? 600 : 300, 255, 220, 120);

    this.showFeedback(
      progress.complete
        ? `${this.config.completionText}\nRETURN TO THE CAVE ENTRANCE`
        : `TRANSFORMER ONLINE  ${progress.activatedCount} / ${progress.total}`,
      progress.complete ? 1500 : 900,
    );
  }

  private showFeedback(text: string, hold: number, color = '#ffdd44'): void {
    const statusText = this.scene.add.text(
      this.scene.cameras.main.width / 2,
      this.scene.cameras.main.height / 2,
      text,
      {
        fontFamily: '"Courier New", monospace',
        fontSize: '18px',
        color,
        backgroundColor: '#000000aa',
        padding: { x: 10, y: 6 },
        stroke: '#000000',
        strokeThickness: 3,
        align: 'center',
      },
    );
    statusText.setOrigin(0.5, 0.5);
    statusText.setScrollFactor(0);
    statusText.setDepth(1000);
    statusText.setAlpha(0);

    this.scene.tweens.add({
      targets: statusText,
      alpha: 1,
      duration: 400,
      yoyo: true,
      hold,
      onComplete: () => statusText.destroy(),
    });
  }

  private scheduleCompletion(): void {
    this.completionTimer = this.scene.time.delayedCall(2500, () => {
      this.scene.cameras.main.fade(1000, 0, 0, 0, false, (_camera: unknown, progress: number) => {
        if (progress >= 1) this.onComplete();
      });
    });
  }
}
