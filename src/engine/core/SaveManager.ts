const SAVE_KEY = 'trashed_save';
const CURRENT_VERSION = 1;

export interface SaveData {
  version: number;
  unlockedUpgrades: string[];
  homeInventory: { itemId: string; qty: number }[];
  discoveredRecipes: string[];
  settings: Record<string, unknown>;
}

type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

const MIGRATIONS: Record<number, Migration> = {};

/** Creates a fresh save state. */
function createDefault(): SaveData {
  return {
    version: CURRENT_VERSION,
    unlockedUpgrades: [],
    homeInventory: [],
    discoveredRecipes: [],
    settings: {},
  };
}

/** Manages save/load to localStorage with versioned migrations. */
export class SaveManager {
  /** Load save data, running migrations if needed. Returns fresh save if none exists. */
  load(): SaveData {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return createDefault();

    try {
      let data = JSON.parse(raw) as Record<string, unknown>;
      let version = (data['version'] as number) ?? 0;

      while (version < CURRENT_VERSION) {
        const migrate = MIGRATIONS[version];
        if (!migrate) {
          console.warn(`No migration for save version ${version}, resetting`);
          return createDefault();
        }
        data = migrate(data);
        version = (data['version'] as number) ?? version + 1;
      }

      return data as unknown as SaveData;
    } catch {
      console.warn('Corrupted save data, resetting');
      return createDefault();
    }
  }

  /** Persist save data to localStorage. */
  save(data: SaveData): void {
    data.version = CURRENT_VERSION;
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  }

  /** Delete saved data. */
  clear(): void {
    localStorage.removeItem(SAVE_KEY);
  }
}

export const saveManager = new SaveManager();
