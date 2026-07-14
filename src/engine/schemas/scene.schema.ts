import { z } from 'zod';

const TilemapGenerationSchema = z.object({
  method: z.literal('tilemap'),
  map: z.string(),
});

// "rooms" is implemented as a procedural cave (cellular-automata carving with a
// guaranteed-connectivity flood-fill prune — see generation/caveGenerator.ts).
// roomCount loosely scales the generated grid size (GameScene derives width/height
// from it) so existing content authored against this schema needs no changes; the
// fields below are optional tuning knobs with defaults already proven in the
// asset-pipeline admin tool's cave preview (fillRatio 0.4, smoothIterations 6,
// widenPasses 2 — tuned there for "wide corridor, not cramped" per design notes).
const RoomsGenerationSchema = z.object({
  method: z.literal('rooms'),
  roomCount: z.tuple([z.number().int().positive(), z.number().int().positive()]),
  seed: z.number().int().optional(),
  fillRatio: z.number().min(0.2).max(0.6).default(0.4),
  smoothIterations: z.number().int().min(0).max(10).default(6),
  widenPasses: z.number().int().min(0).max(5).default(2),
  pillarCount: z.number().int().nonnegative().default(0),
  exitCount: z.number().int().positive().default(2),
  openItemCount: z.number().int().nonnegative().default(8),
  behindWallItemCount: z.number().int().nonnegative().default(3),
  /** How many cave tiles one floor texture tile covers. Higher = bigger tiles. */
  floorTileScale: z.number().positive().default(6),
  spawnTables: z
    .object({
      enemies: z.string().optional(),
      trash: z.string().optional(),
    })
    .optional(),
});

const BackgroundGenerationSchema = z.object({
  method: z.literal('background'),
  image: z.string(),
  wallInset: z.number().nonnegative().default(32),
  scale: z.number().positive().default(1),
});

const TiledGenerationSchema = z.object({
  method: z.literal('tiled'),
  width: z.number().int().positive().default(640),
  height: z.number().int().positive().default(480),
  wallThickness: z.number().int().nonnegative().default(16),
});

const FloorTileDefSchema = z.object({
  texture: z.enum(['wood', 'stone', 'metal', 'marble']).default('wood'),
  baseColor: z.string().default('#4a4035'),
  accentColor: z.string().default('#3a3530'),
  variation: z.number().min(0).max(1).default(0.5),
  roughness: z.number().min(0).max(1).default(0.4),
  variant: z.number().int().nonnegative().default(0),
});

const CorridorSegmentSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
  label: z.string().optional(),
  tileImage: z.string().optional(),
  wallImage: z.string().optional(),
});

const CorridorGenerationSchema = z.object({
  method: z.literal('corridor'),
  cellSize: z.number().int().positive().default(32),
  gridWidth: z.number().int().positive(),
  gridHeight: z.number().int().positive(),
  tileImage: z.string().optional(),
  wallImage: z.string().optional(),
  segments: z.array(CorridorSegmentSchema).min(1),
});

const TileFloorGenerationSchema = z.object({
  method: z.literal('tileFloor'),
  width: z.number().int().positive().default(640),
  height: z.number().int().positive().default(480),
  wallThickness: z.number().int().nonnegative().default(16),
  tileSize: z.number().int().positive().default(128),
  /** If set, uses this image key as the seamless tile (repeated via GL_REPEAT). */
  tileImage: z.string().optional(),
  /** Default tile used for cells not specified in the map. */
  defaultTile: FloorTileDefSchema.default({}),
  /**
   * Grid map of tile indices (row-major). Each number references a tile def
   * from the `tiles` array. Omit to fill the whole floor with defaultTile.
   */
  map: z.array(z.array(z.number().int().nonnegative())).optional(),
  /** Palette of tile definitions referenced by the map indices. */
  tiles: z.array(FloorTileDefSchema).default([]),
});

const GenerationSchema = z.discriminatedUnion('method', [
  TilemapGenerationSchema,
  RoomsGenerationSchema,
  BackgroundGenerationSchema,
  TiledGenerationSchema,
  TileFloorGenerationSchema,
  CorridorGenerationSchema,
]);

const ExitSchema = z.object({
  to: z.string(),
  condition: z.string().default('always'),
  label: z.string().optional(),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
});

const ShopSchema = z.object({
  label: z.string().default('Shop'),
  position: z.object({ x: z.number(), y: z.number() }),
});

/** Built-in Phaser preFX effects that can be applied to props via JSON. */
const PropFxSchema = z.enum(['shine', 'glow', 'shadow', 'bloom']);

const PropSchema = z.object({
  image: z.string(),
  position: z.object({ x: z.number(), y: z.number() }),
  /** Raw scale factor. Ignored when `height` is set. */
  scale: z.number().positive().default(1),
  /** Desired display height in pixels; overrides `scale`. */
  height: z.number().positive().optional(),
  depth: z.number().default(2),
  collides: z.boolean().default(false),
  /** Scale of the physical collision body relative to the displayed prop. */
  collisionScale: z.number().min(0.1).max(1).optional(),
  /** Visual rotation in degrees. Arcade physics bodies stay axis-aligned. */
  angle: z.number().default(0),
  /** If set, this prop acts as an interaction point when the player presses E nearby. */
  action: z.enum(['shop', 'exit', 'upgrade', 'transformer']).optional(),
  /** For exit actions: the scene to transition to. */
  actionTarget: z.string().optional(),
  /** Label shown in the [E] prompt when near this prop. */
  actionLabel: z.string().optional(),
  /** Overrides the scene-wide interaction reach for this prop. */
  interactionRadius: z.number().positive().optional(),
  /** Visual feedback used when the player is close enough to interact. */
  interactionHighlight: z.enum(['glow', 'tint', 'none']).default('glow'),
  /** Skip the Light2D normal-map pipeline while retaining cave fog lighting. */
  unlit: z.boolean().default(false),
  /** Phaser preFX effects to apply permanently to this prop. */
  fx: z.array(PropFxSchema).default([]),
  /** Render as a real-time 3D object with dynamic lamp shadows. */
  render3d: z
    .union([
      z.boolean(),
      z.object({
        shape: z.enum(['table', 'box', 'cylinder']).default('box'),
        color: z.number().optional(),
        modelUrl: z.string().optional(),
      }),
    ])
    .optional(),
});

const GroundItemSchema = z.object({
  itemId: z.string(),
  position: z.object({ x: z.number(), y: z.number() }),
  qty: z.number().int().positive().default(1),
  image: z.string().optional(),
  scale: z.number().positive().optional(),
  angle: z.number().optional(),
});

const PowerCableSchema = z.object({
  sampleDistance: z.number().positive().default(18),
  poweredRadius: z.number().positive().default(30),
  fuelBurnMultiplier: z.number().min(0).max(1).default(0.5),
});

const TransformerQuestSchema = z.object({
  type: z.literal('activate_all_transformers'),
  title: z.string().min(1).default('Restore the power grid'),
  completionText: z.string().min(1).default('POWER GRID RESTORED'),
  exitTitle: z.string().min(1).default('Return to the cave entrance'),
  completionScene: z.string().min(1).default('core:home'),
  /** Optional cable trail that becomes powered whenever a transformer is activated. */
  powerCable: PowerCableSchema.optional(),
  /** Transformer count required before the cave mapping system comes online. */
  minimapUnlockAt: z.number().int().positive().optional(),
});

const PoweredLightSchema = z.object({
  position: z.object({ x: z.number(), y: z.number() }),
  /** Quest whose completion supplies power to this fixture. */
  poweredByQuest: z.string().min(1),
  radius: z.number().positive().default(120),
  color: z.number().int().nonnegative().default(0xffc864),
  intensity: z.number().positive().default(1.2),
});

/** Schema for scene content definitions. */
export const SceneDefSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+:[a-z0-9_]+$/),
  type: z.literal('scene'),
  kind: z.string().min(1),
  tileset: z.string().optional(),
  music: z.string().optional(),
  generation: GenerationSchema,
  exits: z.array(ExitSchema).default([]),
  shops: z.array(ShopSchema).default([]),
  props: z.array(PropSchema).default([]),
  /** Optional scene objective backed by a dedicated engine quest system. */
  quest: TransformerQuestSchema.optional(),
  /** Environmental fixtures that illuminate after persistent quest completion. */
  poweredLights: z.array(PoweredLightSchema).default([]),
  groundItems: z.array(GroundItemSchema).default([]),
  playerSpawn: z.object({ x: z.number(), y: z.number() }).optional(),
  /** Per-scene override for player max speed. Falls back to playerConfig default. */
  playerMaxSpeed: z.number().positive().optional(),
  /** Per-scene override for player sprite height (px). Falls back to playerConfig default. */
  playerHeight: z.number().positive().optional(),
});

export type SceneDef = z.infer<typeof SceneDefSchema>;
