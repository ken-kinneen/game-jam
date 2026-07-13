export interface TransformerProgress {
  activated: boolean;
  activatedCount: number;
  total: number;
  complete: boolean;
}

/** Tracks the one-time transformer activations required to complete a cave. */
export class TransformerObjective {
  private readonly activatedIds = new Set<string>();

  constructor(readonly total: number) {
    if (!Number.isInteger(total) || total < 1) {
      throw new Error('TransformerObjective requires at least one transformer');
    }
  }

  activate(id: string): TransformerProgress {
    const previousCount = this.activatedIds.size;
    this.activatedIds.add(id);
    const activatedCount = this.activatedIds.size;

    return {
      activated: activatedCount > previousCount,
      activatedCount,
      total: this.total,
      complete: activatedCount >= this.total,
    };
  }

  get activatedCount(): number {
    return this.activatedIds.size;
  }
}
