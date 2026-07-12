import { Texture, type Scene } from '@babylonjs/core';
import type { AssetManifest, ManifestEntry } from '../core/ModLoader';
import { assetCache } from '../rendering/AssetCache';
import { assetStore } from '../rendering/AssetStore';
import { generatePlaceholderSoundUrls } from '../audio/generatePlaceholderSounds';
import { registerSoundFromUrl } from '../systems/SoundSystem';
import { ensureBabylonLoaders, preloadModelContainer } from '../entities/ModelAnimator';

/**
 * Loads all assets from mod manifests into the AssetStore.
 * Binaries go through AssetCache (Cache API) so the second boot is local.
 */
export async function loadAssets(
  scene: Scene,
  manifests: { basePath: string; manifest: AssetManifest }[],
): Promise<void> {
  ensureBabylonLoaders();
  assetStore.ensurePlaceholder(scene);

  const audioKeys = new Set<string>();
  const jobs: Promise<void>[] = [];

  for (const { basePath, manifest } of manifests) {
    for (const [key, entry] of Object.entries(manifest)) {
      const filePath = `/${basePath}/${entry.file}`;
      jobs.push(loadAsset(scene, key, entry, filePath, audioKeys));
    }
  }

  await Promise.all(jobs);

  const placeholders = await generatePlaceholderSoundUrls(audioKeys);
  await Promise.all(
    [...placeholders].map(async ([key, url]) => {
      try {
        await registerSoundFromUrl(scene, key, url);
      } catch (err) {
        console.warn('Failed to register placeholder sound', key, err);
      }
    }),
  );

  validateLoads(manifests);
}

async function loadAsset(
  scene: Scene,
  key: string,
  entry: ManifestEntry,
  filePath: string,
  audioKeys: Set<string>,
): Promise<void> {
  switch (entry.type) {
    case 'image':
    case 'texture': {
      try {
        const url = await assetCache.resolveUrl(filePath);
        const tex = await loadTexture(scene, key, url);
        assetStore.setTexture(key, tex);
      } catch (err) {
        console.warn(`Skipping texture "${key}":`, err);
      }
      break;
    }
    case 'spritesheet': {
      try {
        const url = await assetCache.resolveUrl(filePath);
        const tex = await loadTexture(scene, key, url);
        assetStore.setSpritesheet(key, tex, entry.frameWidth ?? 16, entry.frameHeight ?? 16);
      } catch (err) {
        console.warn(`Skipping spritesheet "${key}":`, err);
      }
      break;
    }
    case 'audio': {
      audioKeys.add(key);
      try {
        const url = await assetCache.resolveUrl(filePath);
        await registerSoundFromUrl(scene, key, url);
      } catch (err) {
        console.warn(`Audio load failed for ${key}`, err);
      }
      break;
    }
    case 'tilemapJSON':
    case 'tilemap': {
      try {
        const url = await assetCache.resolveUrl(filePath);
        const res = await fetch(url);
        const json = await res.json();
        assetStore.setTilemap(key, json);
      } catch (err) {
        console.warn(`Tilemap load failed for ${key}`, err);
      }
      break;
    }
    case 'model': {
      try {
        const url = await assetCache.resolveUrl(filePath);
        assetStore.setModelUrl(key, url);
        // Preload player + placeholder props (skip unused extras like run/dance)
        const shouldPreload =
          key === 'models/player_walk' || key.startsWith('models/placeholders/');
        if (shouldPreload) {
          const container = await preloadModelContainer(scene, url);
          assetStore.setModelContainer(key, container);
        }
      } catch (err) {
        console.warn(`Model preload failed for ${key}:`, err);
        assetStore.setModelUrl(key, filePath);
      }
      break;
    }
    case 'material': {
      break;
    }
    default:
      console.warn(`Unknown asset type for key "${key}": ${(entry as ManifestEntry).type}`);
  }
}

function loadTexture(scene: Scene, key: string, url: string): Promise<Texture> {
  return new Promise((resolve, reject) => {
    try {
      const tex = new Texture(
        url,
        scene,
        false,
        true,
        Texture.NEAREST_SAMPLINGMODE,
        () => {
          tex.name = key;
          resolve(tex);
        },
        (msg) => {
          console.warn(`Texture load failed for "${key}" (${url}):`, msg);
          reject(new Error(`Texture "${key}": ${String(msg)}`));
        },
      );
    } catch (err) {
      console.warn(`Texture constructor threw for "${key}":`, err);
      reject(err);
    }
  });
}

function validateLoads(manifests: { basePath: string; manifest: AssetManifest }[]): void {
  const missing: string[] = [];
  for (const { manifest } of manifests) {
    for (const [key, entry] of Object.entries(manifest)) {
      if (
        (entry.type === 'image' || entry.type === 'texture' || entry.type === 'spritesheet') &&
        !assetStore.hasTexture(key)
      ) {
        missing.push(key);
      }
    }
  }
  if (missing.length > 0) {
    console.error('Missing asset keys (will show placeholder):', missing);
  }
}
