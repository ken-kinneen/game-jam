import { describe, expect, it } from 'vitest';
import { PowerCablePath } from '../src/engine/systems/PowerCablePath';

describe('PowerCablePath', () => {
  it('samples the loose cable only after the player moves far enough', () => {
    const cable = new PowerCablePath({ x: 0, y: 0 }, 10);

    expect(cable.record({ x: 6, y: 0 })).toBe(false);
    expect(cable.record({ x: 10, y: 0 })).toBe(true);
    expect(cable.activeSegment).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]);
  });

  it('locks the current trail when a transformer energizes it', () => {
    const cable = new PowerCablePath({ x: 0, y: 0 }, 10);
    cable.record({ x: 20, y: 0 });
    cable.energizeAt({ x: 30, y: 0 });

    expect(cable.poweredSegments).toHaveLength(1);
    expect(cable.poweredSegments[0]).toEqual([
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 30, y: 0 },
    ]);
    expect(cable.activeSegment).toEqual([{ x: 30, y: 0 }]);
    expect(cable.revision).toBe(1);
  });

  it('detects the fuel-saving area around powered cable segments', () => {
    const cable = new PowerCablePath({ x: 0, y: 0 }, 10);
    cable.energizeAt({ x: 100, y: 0 });

    expect(cable.isNearPoweredCable({ x: 50, y: 9 }, 10)).toBe(true);
    expect(cable.isNearPoweredCable({ x: 50, y: 11 }, 10)).toBe(false);
    expect(cable.isNearPoweredCable({ x: 110, y: 0 }, 10)).toBe(true);
  });
});
