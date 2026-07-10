import { describe, it, expect } from 'vitest';
import { StatSheet } from '../src/engine/stats/StatSheet';

describe('StatSheet', () => {
  it('returns base value with no modifiers', () => {
    const sheet = new StatSheet();
    sheet.setBase('maxHealth', 100);
    expect(sheet.get('maxHealth')).toBe(100);
  });

  it('returns 0 for unknown stats', () => {
    const sheet = new StatSheet();
    expect(sheet.get('nonexistent')).toBe(0);
  });

  it('applies flat modifier', () => {
    const sheet = new StatSheet();
    sheet.setBase('maxHealth', 100);
    sheet.addModifier({ stat: 'maxHealth', mod: 'flat', value: 20, source: 'test' });
    expect(sheet.get('maxHealth')).toBe(120);
  });

  it('applies increased modifier', () => {
    const sheet = new StatSheet();
    sheet.setBase('moveSpeed', 200);
    sheet.addModifier({ stat: 'moveSpeed', mod: 'increased', value: 0.5, source: 'boots' });
    expect(sheet.get('moveSpeed')).toBe(300);
  });

  it('applies more modifier (multiplicative)', () => {
    const sheet = new StatSheet();
    sheet.setBase('damage', 10);
    sheet.addModifier({ stat: 'damage', mod: 'more', value: 0.5, source: 'buff' });
    expect(sheet.get('damage')).toBe(15);
  });

  it('stacks flat + increased + more correctly: (base+flat)*(1+inc)*Π(1+more)', () => {
    const sheet = new StatSheet();
    sheet.setBase('damage', 10);
    sheet.addModifier({ stat: 'damage', mod: 'flat', value: 10, source: 'a' });
    sheet.addModifier({ stat: 'damage', mod: 'increased', value: 0.5, source: 'b' });
    sheet.addModifier({ stat: 'damage', mod: 'more', value: 1.0, source: 'c' });
    // (10+10) * (1+0.5) * (1+1.0) = 20 * 1.5 * 2 = 60
    expect(sheet.get('damage')).toBe(60);
  });

  it('multiple increased% sources are additive', () => {
    const sheet = new StatSheet();
    sheet.setBase('moveSpeed', 100);
    sheet.addModifier({ stat: 'moveSpeed', mod: 'increased', value: 0.2, source: 'a' });
    sheet.addModifier({ stat: 'moveSpeed', mod: 'increased', value: 0.3, source: 'b' });
    // 100 * (1 + 0.2 + 0.3) = 100 * 1.5 = 150
    expect(sheet.get('moveSpeed')).toBe(150);
  });

  it('multiple more% sources are multiplicative', () => {
    const sheet = new StatSheet();
    sheet.setBase('damage', 100);
    sheet.addModifier({ stat: 'damage', mod: 'more', value: 0.5, source: 'a' });
    sheet.addModifier({ stat: 'damage', mod: 'more', value: 0.5, source: 'b' });
    // 100 * 1.5 * 1.5 = 225
    expect(sheet.get('damage')).toBe(225);
  });

  it('removes modifiers by source', () => {
    const sheet = new StatSheet();
    sheet.setBase('maxHealth', 100);
    sheet.addModifier({ stat: 'maxHealth', mod: 'flat', value: 50, source: 'upgrade_a' });
    sheet.addModifier({ stat: 'maxHealth', mod: 'flat', value: 25, source: 'upgrade_b' });
    expect(sheet.get('maxHealth')).toBe(175);

    sheet.removeBySource('upgrade_a');
    expect(sheet.get('maxHealth')).toBe(125);
  });

  it('removes specific modifier instance', () => {
    const sheet = new StatSheet();
    sheet.setBase('luck', 0);
    const mod = sheet.addModifier({ stat: 'luck', mod: 'flat', value: 5, source: 'charm' });
    expect(sheet.get('luck')).toBe(5);

    sheet.removeModifier(mod);
    expect(sheet.get('luck')).toBe(0);
  });
});
