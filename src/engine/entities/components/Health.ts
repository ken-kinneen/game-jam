/** Tracks an entity's current and max health. */
export class Health {
  current: number;
  max: number;

  constructor(max: number) {
    this.max = max;
    this.current = max;
  }

  /** Apply damage, clamped to 0. Returns actual damage dealt. */
  damage(amount: number): number {
    const actual = Math.min(this.current, amount);
    this.current -= actual;
    return actual;
  }

  /** Heal, clamped to max. Returns actual healing done. */
  heal(amount: number): number {
    const actual = Math.min(this.max - this.current, amount);
    this.current += actual;
    return actual;
  }

  get isDead(): boolean {
    return this.current <= 0;
  }

  get ratio(): number {
    return this.max > 0 ? this.current / this.max : 0;
  }
}
