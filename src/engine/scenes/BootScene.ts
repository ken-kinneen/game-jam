import type { AssetManifest, ManifestEntry } from '../core/ModLoader';

/**
 * First scene: loads all assets from mod manifests.
 * Generates a magenta placeholder texture for missing/placeholder keys.
 */
export class BootScene extends Phaser.Scene {
  private manifests: { basePath: string; manifest: AssetManifest }[] = [];

  constructor() {
    super({ key: 'BootScene' });
  }

  init(data: { manifests: { basePath: string; manifest: AssetManifest }[] }) {
    this.manifests = data.manifests;
  }

  preload() {
    this.createPlaceholderTexture();

    for (const { basePath, manifest } of this.manifests) {
      for (const [key, entry] of Object.entries(manifest)) {
        const filePath = `${basePath}/${entry.file}`;
        this.loadAsset(key, entry, filePath);
      }
    }
  }

  create() {
    this.validateLoads();
    this.scene.start('GameScene', { sceneId: 'core:home' });
  }

  private loadAsset(key: string, entry: ManifestEntry, filePath: string): void {
    switch (entry.type) {
      case 'image':
        this.load.image(key, filePath);
        break;
      case 'spritesheet':
        this.load.spritesheet(key, filePath, {
          frameWidth: entry.frameWidth ?? 16,
          frameHeight: entry.frameHeight ?? 16,
        });
        break;
      case 'audio':
        this.load.audio(key, filePath);
        break;
      case 'tilemapJSON':
        this.load.tilemapTiledJSON(key, filePath);
        break;
      default:
        console.warn(`Unknown asset type for key "${key}": ${entry.type}`);
    }
  }

  private createPlaceholderTexture(): void {
    const size = 16;
    const gfx = this.add.graphics();
    gfx.fillStyle(0xff00ff, 1);
    gfx.fillRect(0, 0, size, size);
    gfx.generateTexture('__placeholder', size, size);
    gfx.destroy();
  }

  private validateLoads(): void {
    const missing: string[] = [];
    for (const { manifest } of this.manifests) {
      for (const key of Object.keys(manifest)) {
        if (!this.textures.exists(key) && manifest[key].type === 'image') {
          missing.push(key);
        }
      }
    }
    if (missing.length > 0) {
      console.error('Missing asset keys (will show placeholder):', missing);
    }
  }
}
