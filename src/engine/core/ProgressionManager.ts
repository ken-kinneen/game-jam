import { saveManager, type SaveData } from './SaveManager';

interface ProgressionStore {
  load(): SaveData;
  save(data: SaveData): void;
}

/** Persistent story progression shared by quests and data-driven scene rewards. */
export class ProgressionManager {
  constructor(private readonly store: ProgressionStore = saveManager) {}

  hasCompletedQuest(questId: string): boolean {
    return this.store.load().completedQuests.includes(questId);
  }

  /** Records a quest once. Returns true only when it was newly completed. */
  completeQuest(questId: string): boolean {
    const save = this.store.load();
    if (save.completedQuests.includes(questId)) return false;
    save.completedQuests.push(questId);
    this.store.save(save);
    return true;
  }
}

export const progressionManager = new ProgressionManager();
