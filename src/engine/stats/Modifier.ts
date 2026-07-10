/** The three modifier stacking types per the formula: (base + Σflat) × (1 + Σincreased) × Π(1 + more_i) */
export type ModType = 'flat' | 'increased' | 'more';

/** A single stat modifier, attached to a source that can be removed cleanly. */
export interface Modifier {
  stat: string;
  mod: ModType;
  value: number;
  source: string;
}
