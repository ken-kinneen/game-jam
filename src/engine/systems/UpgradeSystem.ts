import type { StatSheet } from '../stats/StatSheet';
import type { UpgradeDef } from '../schemas/upgrade.schema';
import type { EventBus } from '../core/EventBus';
import { configManager, type ConfigManager } from '../core/ConfigManager';

/** Applies upgrade effects as StatSheet modifiers, tracks which upgrades are active. */
export class UpgradeSystem {
  private acquired = new Set<string>();

  constructor(
    private eventBus: EventBus,
    private config: ConfigManager = configManager,
  ) {}

  /** Check if an upgrade has been acquired. */
  hasUpgrade(upgradeId: string): boolean {
    return this.acquired.has(upgradeId);
  }

  /** Check if all prerequisites for an upgrade are met. */
  canAcquire(upgrade: UpgradeDef): boolean {
    if (this.acquired.has(upgrade.id)) return false;
    return upgrade.requires.every((req) => this.acquired.has(req));
  }

  /** Apply an upgrade's effects to a StatSheet. */
  acquire(upgrade: UpgradeDef, stats: StatSheet): void {
    if (this.acquired.has(upgrade.id)) return;
    this.acquired.add(upgrade.id);

    for (const effect of upgrade.effects) {
      if (effect.kind === 'stat') {
        stats.addModifier({
          stat: effect.stat,
          mod: effect.mod,
          value: effect.value,
          source: upgrade.id,
        });
        this.applyLampStat(effect.stat, stats.get(effect.stat));
      } else if (effect.kind === 'behavior') {
        this.applyBehavior(effect.behavior);
      }
    }

    this.eventBus.emit('upgrade:acquired', { upgradeId: upgrade.id });
  }

  /** Dispatch a behavior effect via the event bus. */
  private applyBehavior(behavior: string): void {
    if (behavior.startsWith('lamp_color_')) {
      const color = behavior.replace('lamp_color_', '');
      this.config.set('lamp', 'glowColorName', color);
      this.eventBus.emit('lamp:color_changed', { color });
    }
  }

  private applyLampStat(stat: string, value: number): void {
    if (stat === 'glowRadius') {
      this.config.set('lamp', 'glowRadiusMax', value);
    } else if (stat === 'fuelBurnRate') {
      this.config.set('lamp', 'burnRate', value);
    }
  }

  /** Remove an upgrade's effects. */
  remove(upgradeId: string, stats: StatSheet): void {
    if (!this.acquired.has(upgradeId)) return;
    this.acquired.delete(upgradeId);
    stats.removeBySource(upgradeId);
  }

  /** Get all acquired upgrade IDs (for saves). */
  getAcquired(): string[] {
    return Array.from(this.acquired);
  }

  /** Restore acquired upgrades from save data. */
  restoreAcquired(ids: string[]): void {
    for (const id of ids) {
      this.acquired.add(id);
    }
  }
}
