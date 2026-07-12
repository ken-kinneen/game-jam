import { type ZodSchema } from 'zod';
import { ModMetaSchema, type ModMeta } from '../schemas/mod.schema';
import { ItemDefSchema } from '../schemas/item.schema';
import { EntityDefSchema } from '../schemas/entity.schema';
import { UpgradeDefSchema } from '../schemas/upgrade.schema';
import { RecipeDefSchema } from '../schemas/recipe.schema';
import { SceneDefSchema } from '../schemas/scene.schema';
import { LootTableDefSchema } from '../schemas/loot-table.schema';
import { SoundDefSchema } from '../schemas/sound.schema';
import { type ContentRegistry, type DefType } from './ContentRegistry';

/** Maps def type strings to their Zod validation schemas. */
const SCHEMA_MAP: Record<string, { type: DefType; schema: ZodSchema }> = {
  item: { type: 'item', schema: ItemDefSchema },
  entity: { type: 'entity', schema: EntityDefSchema },
  upgrade: { type: 'upgrade', schema: UpgradeDefSchema },
  recipe: { type: 'recipe', schema: RecipeDefSchema },
  scene: { type: 'scene', schema: SceneDefSchema },
  'loot-table': { type: 'loot-table', schema: LootTableDefSchema },
  sound: { type: 'sound', schema: SoundDefSchema },
};

export interface ManifestEntry {
  file: string;
  type:
    | 'image'
    | 'spritesheet'
    | 'audio'
    | 'tilemap'
    | 'tilemapJSON'
    | 'model'
    | 'texture'
    | 'material';
  frameWidth?: number;
  frameHeight?: number;
}

export type AssetManifest = Record<string, ManifestEntry>;

export interface LoadedMod {
  meta: ModMeta;
  defs: { type: DefType; data: Record<string, unknown> }[];
  manifest: AssetManifest;
  basePath: string;
}

/** Discovers mods, validates defs against Zod schemas, and fills the ContentRegistry. */
export class ModLoader {
  private errors: string[] = [];

  /** Load a mod from pre-fetched JSON data (used at runtime via Vite imports). */
  loadMod(
    meta: unknown,
    defFiles: { filename: string; data: unknown }[],
    manifest: unknown,
    basePath: string,
    targetRegistry: ContentRegistry,
  ): { errors: string[] } {
    this.errors = [];

    const metaResult = ModMetaSchema.safeParse(meta);
    if (!metaResult.success) {
      this.errors.push(`Invalid mod.json: ${metaResult.error.message}`);
      return { errors: this.errors };
    }
    const modMeta = metaResult.data;

    const parsedManifest = (manifest ?? {}) as AssetManifest;

    for (const { filename, data } of defFiles) {
      this.loadDef(filename, data, modMeta.id, parsedManifest, targetRegistry);
    }

    return { errors: [...this.errors] };
  }

  private loadDef(
    filename: string,
    data: unknown,
    _modId: string,
    manifest: AssetManifest,
    targetRegistry: ContentRegistry,
  ): void {
    if (typeof data !== 'object' || data === null) {
      this.errors.push(`${filename}: not a valid JSON object`);
      return;
    }

    const raw = data as Record<string, unknown>;
    const typeName = raw['type'] as string;

    if (!typeName || !SCHEMA_MAP[typeName]) {
      this.errors.push(`${filename}: unknown or missing "type" field: "${typeName}"`);
      return;
    }

    const { type, schema } = SCHEMA_MAP[typeName];
    const result = schema.safeParse(data);

    if (!result.success) {
      const issues = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
      this.errors.push(`${filename}: validation failed:\n${issues.join('\n')}`);
      return;
    }

    const def = result.data as Record<string, unknown> & { id: string; sprite?: string };

    if (def.sprite && def.sprite !== 'placeholder' && !manifest[def.sprite]) {
      this.errors.push(`${filename}: sprite key "${def.sprite}" not found in manifest`);
    }

    try {
      targetRegistry.register(type, def as Parameters<ContentRegistry['register']>[1]);
    } catch (e) {
      this.errors.push(`${filename}: ${(e as Error).message}`);
    }
  }
}
