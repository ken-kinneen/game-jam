import type { Modifier, ModType } from './Modifier';

/**
 * Stat calculation engine: base values + modifier stack.
 * final = (base + Σflat) × (1 + Σincreased) × Π(1 + more_i)
 */
export class StatSheet {
  private baseValues = new Map<string, number>();
  private modifiers: Modifier[] = [];
  private cache = new Map<string, number>();
  private dirty = true;

  /** Set a base stat value. */
  setBase(stat: string, value: number): void {
    this.baseValues.set(stat, value);
    this.dirty = true;
  }

  /** Get a base stat value before modifiers. */
  getBase(stat: string): number {
    return this.baseValues.get(stat) ?? 0;
  }

  /** Add a modifier. Returns it for convenience. */
  addModifier(mod: Modifier): Modifier {
    this.modifiers.push(mod);
    this.dirty = true;
    return mod;
  }

  /** Remove all modifiers from a given source. */
  removeBySource(source: string): void {
    const before = this.modifiers.length;
    this.modifiers = this.modifiers.filter((m) => m.source !== source);
    if (this.modifiers.length !== before) {
      this.dirty = true;
    }
  }

  /** Remove a specific modifier instance. */
  removeModifier(mod: Modifier): void {
    const idx = this.modifiers.indexOf(mod);
    if (idx !== -1) {
      this.modifiers.splice(idx, 1);
      this.dirty = true;
    }
  }

  /** Get the fully computed value of a stat. */
  get(stat: string): number {
    if (this.dirty) {
      this.recompute();
    }
    return this.cache.get(stat) ?? this.getBase(stat);
  }

  /** Get all stat names that have base values or modifiers. */
  allStats(): string[] {
    const stats = new Set<string>();
    for (const key of this.baseValues.keys()) stats.add(key);
    for (const mod of this.modifiers) stats.add(mod.stat);
    return Array.from(stats);
  }

  private recompute(): void {
    this.cache.clear();

    const stats = this.allStats();
    for (const stat of stats) {
      this.cache.set(stat, this.compute(stat));
    }
    this.dirty = false;
  }

  private compute(stat: string): number {
    const base = this.getBase(stat);
    const mods = this.modifiers.filter((m) => m.stat === stat);

    let flat = 0;
    let increased = 0;
    let moreMult = 1;

    for (const m of mods) {
      switch (m.mod) {
        case 'flat':
          flat += m.value;
          break;
        case 'increased':
          increased += m.value;
          break;
        case 'more':
          moreMult *= 1 + m.value;
          break;
      }
    }

    return (base + flat) * (1 + increased) * moreMult;
  }
}
