import { describe, expect, it } from 'vitest';
import { ConfigManager } from '../src/engine/core/ConfigManager';
import { EventBus } from '../src/engine/core/EventBus';
import { lampConfig } from '../src/engine/configs/lampConfig';
import { LampSystem } from '../src/engine/systems/LampSystem';

describe('LampSystem', () => {
  it('applies the powered-cable fuel multiplier to burn rate', () => {
    const config = new ConfigManager();
    config.register(lampConfig);
    const lamp = new LampSystem(new EventBus(), config);

    lamp.update(1, 0.5);

    expect(lamp.currentFuel).toBe(98.5);
  });
});
