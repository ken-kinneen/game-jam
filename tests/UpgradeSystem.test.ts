import { describe, expect, it, vi } from 'vitest';
import { ConfigManager } from '../src/engine/core/ConfigManager';
import { EventBus } from '../src/engine/core/EventBus';
import { lampConfig } from '../src/engine/configs/lampConfig';
import type { UpgradeDef } from '../src/engine/schemas/upgrade.schema';
import { StatSheet } from '../src/engine/stats/StatSheet';
import { UpgradeSystem } from '../src/engine/systems/UpgradeSystem';

describe('UpgradeSystem lamp integration', () => {
  it('applies lamp stat upgrades to the runtime lamp configuration', () => {
    const config = new ConfigManager();
    config.register(lampConfig);
    const stats = new StatSheet();
    stats.setBase('glowRadius', 200);
    const system = new UpgradeSystem(new EventBus(), config);
    const upgrade: UpgradeDef = {
      id: 'core:test_lamp',
      type: 'upgrade',
      name: 'Test Lamp',
      sprite: 'placeholder',
      rarity: 'common',
      cost: {},
      effects: [{ kind: 'stat', stat: 'glowRadius', mod: 'increased', value: 0.25 }],
      requires: [],
    };

    system.acquire(upgrade, stats);

    expect(config.get('lamp', 'glowRadiusMax')).toBe(250);
  });

  it('persists lamp color behavior in configuration', () => {
    vi.useFakeTimers();
    const config = new ConfigManager();
    config.register(lampConfig);
    const system = new UpgradeSystem(new EventBus(), config);
    const upgrade: UpgradeDef = {
      id: 'core:test_color',
      type: 'upgrade',
      name: 'Test Color',
      sprite: 'placeholder',
      rarity: 'rare',
      cost: {},
      effects: [{ kind: 'behavior', behavior: 'lamp_color_blue' }],
      requires: [],
    };

    system.acquire(upgrade, new StatSheet());

    expect(config.get('lamp', 'glowColorName')).toBe('blue');
    vi.clearAllTimers();
    vi.useRealTimers();
  });
});
