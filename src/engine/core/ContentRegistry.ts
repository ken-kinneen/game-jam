import type { ItemDef } from '../schemas/item.schema';
import type { EntityDef } from '../schemas/entity.schema';
import type { UpgradeDef } from '../schemas/upgrade.schema';
import type { RecipeDef } from '../schemas/recipe.schema';
import type { SceneDef } from '../schemas/scene.schema';
import type { LootTableDef } from '../schemas/loot-table.schema';
import type { SoundDef } from '../schemas/sound.schema';

/** Union of all def types the registry stores. */
export type AnyDef =
  ItemDef | EntityDef | UpgradeDef | RecipeDef | SceneDef | LootTableDef | SoundDef;

/** Map from def type string to its TypeScript type. */
export interface DefTypeMap {
  item: ItemDef;
  entity: EntityDef;
  upgrade: UpgradeDef;
  recipe: RecipeDef;
  scene: SceneDef;
  'loot-table': LootTableDef;
  sound: SoundDef;
}

export type DefType = keyof DefTypeMap;

/** Central index of all validated content definitions loaded from mods. */
export class ContentRegistry {
  private store = new Map<DefType, Map<string, AnyDef>>();

  constructor() {
    const types: DefType[] = [
      'item',
      'entity',
      'upgrade',
      'recipe',
      'scene',
      'loot-table',
      'sound',
    ];
    for (const t of types) {
      this.store.set(t, new Map());
    }
  }

  /** Register a validated def. Throws on duplicate ID within a type. */
  register<T extends DefType>(type: T, def: DefTypeMap[T]): void {
    const bucket = this.store.get(type)!;
    if (bucket.has(def.id)) {
      throw new Error(`Duplicate ${type} ID: ${def.id}`);
    }
    bucket.set(def.id, def);
  }

  /** Get a def by type and ID. Returns undefined if not found. */
  get<T extends DefType>(type: T, id: string): DefTypeMap[T] | undefined {
    return this.store.get(type)?.get(id) as DefTypeMap[T] | undefined;
  }

  /** Get a def or throw if missing. */
  getOrThrow<T extends DefType>(type: T, id: string): DefTypeMap[T] {
    const def = this.get(type, id);
    if (!def) {
      throw new Error(`Missing ${type} def: ${id}`);
    }
    return def;
  }

  /** Get all defs of a given type. */
  getAll<T extends DefType>(type: T): DefTypeMap[T][] {
    return Array.from(this.store.get(type)!.values()) as DefTypeMap[T][];
  }

  /** Get all defs of a type that have a specific tag (items, entities with tags). */
  getByTag<T extends DefType>(type: T, tag: string): DefTypeMap[T][] {
    return this.getAll(type).filter((def) => {
      if ('tags' in def && Array.isArray(def.tags)) {
        return def.tags.includes(tag);
      }
      return false;
    });
  }

  /** Total number of registered defs across all types. */
  get size(): number {
    let total = 0;
    for (const bucket of this.store.values()) {
      total += bucket.size;
    }
    return total;
  }

  /** Clear all registered defs. */
  clear(): void {
    for (const bucket of this.store.values()) {
      bucket.clear();
    }
  }
}

/** Singleton registry for the game. */
export const registry = new ContentRegistry();
