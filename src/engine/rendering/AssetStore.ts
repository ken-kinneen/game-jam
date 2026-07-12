import { Texture, RawTexture, Sound, type AssetContainer, type Scene } from '@babylonjs/core';

/** Metadata for a loaded spritesheet texture. */
export interface SpritesheetMeta {
  texture: Texture;
  frameWidth: number;
  frameHeight: number;
  columns: number;
  rows: number;
}

/** Holds loaded Babylon textures, spritesheet metadata, sounds, and model containers. */
export class AssetStore {
  private textures = new Map<string, Texture>();
  private sheets = new Map<string, SpritesheetMeta>();
  private sounds = new Map<string, Sound>();
  private tilemaps = new Map<string, unknown>();
  private modelUrls = new Map<string, string>();
  private modelContainers = new Map<string, AssetContainer>();
  private placeholder: Texture | null = null;

  /** Create a magenta placeholder texture for missing assets. */
  ensurePlaceholder(scene: Scene): Texture {
    if (this.placeholder) return this.placeholder;
    const size = 4;
    const pixels = new Uint8Array(size * size * 4);
    for (let i = 0; i < size * size; i++) {
      pixels[i * 4] = 255;
      pixels[i * 4 + 1] = 0;
      pixels[i * 4 + 2] = 255;
      pixels[i * 4 + 3] = 255;
    }
    this.placeholder = RawTexture.CreateRGBATexture(
      pixels,
      size,
      size,
      scene,
      false,
      false,
      Texture.NEAREST_SAMPLINGMODE,
    );
    this.placeholder.name = '__placeholder';
    this.textures.set('__placeholder', this.placeholder);
    return this.placeholder;
  }

  /** Register a loaded image texture. */
  setTexture(key: string, texture: Texture): void {
    this.textures.set(key, texture);
  }

  /** Register a spritesheet with frame dimensions. */
  setSpritesheet(key: string, texture: Texture, frameWidth: number, frameHeight: number): void {
    const size = texture.getSize();
    const columns = Math.max(1, Math.floor(size.width / frameWidth));
    const rows = Math.max(1, Math.floor(size.height / frameHeight));
    texture.wrapU = Texture.CLAMP_ADDRESSMODE;
    texture.wrapV = Texture.CLAMP_ADDRESSMODE;
    this.textures.set(key, texture);
    this.sheets.set(key, { texture, frameWidth, frameHeight, columns, rows });
  }

  /** Register a Babylon Sound under an asset key. */
  setSound(key: string, sound: Sound): void {
    this.sounds.set(key, sound);
  }

  /** Register parsed tilemap JSON. */
  setTilemap(key: string, data: unknown): void {
    this.tilemaps.set(key, data);
  }

  /** Register a GLB/GLTF URL (fallback if container not preloaded). */
  setModelUrl(key: string, url: string): void {
    this.modelUrls.set(key, url);
  }

  /** Store a preloaded AssetContainer for fast instantiateModelsToScene. */
  setModelContainer(key: string, container: AssetContainer): void {
    this.modelContainers.set(key, container);
  }

  /** Get a texture by key, falling back to placeholder. */
  getTexture(key: string): Texture {
    return this.textures.get(key) ?? this.textures.get('__placeholder')!;
  }

  /** Whether a texture key exists. */
  hasTexture(key: string): boolean {
    return this.textures.has(key);
  }

  /** Get spritesheet metadata if this key is a spritesheet. */
  getSpritesheet(key: string): SpritesheetMeta | undefined {
    return this.sheets.get(key);
  }

  /** Get a sound by asset key. */
  getSound(key: string): Sound | undefined {
    return this.sounds.get(key);
  }

  /** Get tilemap JSON by key. */
  getTilemap(key: string): unknown {
    return this.tilemaps.get(key);
  }

  /** Get a registered model URL, if any. */
  getModelUrl(key: string): string | undefined {
    return this.modelUrls.get(key);
  }

  /** Get a preloaded model AssetContainer. */
  getModelContainer(key: string): AssetContainer | undefined {
    return this.modelContainers.get(key);
  }

  /** Dispose all owned GPU resources. */
  dispose(): void {
    for (const t of this.textures.values()) t.dispose();
    for (const s of this.sounds.values()) s.dispose();
    for (const c of this.modelContainers.values()) c.dispose();
    this.textures.clear();
    this.sheets.clear();
    this.sounds.clear();
    this.tilemaps.clear();
    this.modelUrls.clear();
    this.modelContainers.clear();
    this.placeholder = null;
  }
}

/** Singleton asset store shared across the game. */
export const assetStore = new AssetStore();
