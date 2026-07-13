import { describe, expect, it } from 'vitest';
import { TransformerObjective } from '../src/engine/systems/TransformerObjective';

describe('TransformerObjective', () => {
  it('completes only after every transformer has been activated', () => {
    const objective = new TransformerObjective(3);

    expect(objective.activate('west')).toEqual({
      activated: true,
      activatedCount: 1,
      total: 3,
      complete: false,
    });
    expect(objective.activate('east').complete).toBe(false);
    expect(objective.activate('south')).toEqual({
      activated: true,
      activatedCount: 3,
      total: 3,
      complete: true,
    });
  });

  it('does not count the same transformer twice', () => {
    const objective = new TransformerObjective(2);

    objective.activate('west');
    expect(objective.activate('west')).toEqual({
      activated: false,
      activatedCount: 1,
      total: 2,
      complete: false,
    });
  });
});
