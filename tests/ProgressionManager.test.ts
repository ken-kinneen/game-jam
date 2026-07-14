import { describe, expect, it } from 'vitest';
import { ProgressionManager } from '../src/engine/core/ProgressionManager';
import type { SaveData } from '../src/engine/core/SaveManager';

function freshSave(): SaveData {
  return {
    version: 2,
    unlockedUpgrades: [],
    homeInventory: [],
    discoveredRecipes: [],
    completedQuests: [],
    settings: {},
  };
}

describe('ProgressionManager', () => {
  it('persists a quest completion only once', () => {
    let data = freshSave();
    const manager = new ProgressionManager({
      load: () => structuredClone(data),
      save: (next) => {
        data = structuredClone(next);
      },
    });

    expect(manager.hasCompletedQuest('core:tunnel_1')).toBe(false);
    expect(manager.completeQuest('core:tunnel_1')).toBe(true);
    expect(manager.completeQuest('core:tunnel_1')).toBe(false);
    expect(manager.hasCompletedQuest('core:tunnel_1')).toBe(true);
    expect(data.completedQuests).toEqual(['core:tunnel_1']);
  });
});
