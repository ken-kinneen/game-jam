import type { EventBus } from '../core/EventBus';
import type { ConfigManager } from '../core/ConfigManager';

/**
 * The lamp is the player's lifeline. Fuel depletes over time — when it hits zero, you die.
 * Picking up fuel items refills it. All tuning comes from the lamp config section.
 */
export class LampSystem {
  private fuel: number;
  private maxFuel: number;
  private extinguished = false;

  constructor(
    private eventBus: EventBus,
    private config: ConfigManager,
  ) {
    this.maxFuel = config.get<number>('lamp', 'maxFuel');
    this.fuel = config.get<number>('lamp', 'startingFuel');
  }

  /** Call every frame with delta in seconds. */
  update(dt: number): void {
    if (this.extinguished) return;

    const burnRate = this.config.get<number>('lamp', 'burnRate');
    this.fuel = Math.max(0, this.fuel - burnRate * dt);
    this.maxFuel = this.config.get<number>('lamp', 'maxFuel');

    this.eventBus.emit('lamp:fuel_changed', {
      fuel: this.fuel,
      maxFuel: this.maxFuel,
      ratio: this.maxFuel > 0 ? this.fuel / this.maxFuel : 0,
    });

    if (this.fuel <= 0) {
      this.extinguished = true;
      this.eventBus.emit('lamp:extinguished', {});
    }
  }

  /** Add fuel (from picking up a fuel item). Clamped to max. */
  addFuel(amount: number): void {
    if (this.extinguished) return;
    this.fuel = Math.min(this.maxFuel, this.fuel + amount);
    this.eventBus.emit('lamp:refueled', { amount, fuel: this.fuel });
  }

  get currentFuel(): number {
    return this.fuel;
  }

  get ratio(): number {
    return this.maxFuel > 0 ? this.fuel / this.maxFuel : 0;
  }

  get isOut(): boolean {
    return this.extinguished;
  }

  /** Reset for a new run. */
  reset(): void {
    this.maxFuel = this.config.get<number>('lamp', 'maxFuel');
    this.fuel = this.config.get<number>('lamp', 'startingFuel');
    this.extinguished = false;
  }
}
