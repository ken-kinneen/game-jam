import Phaser from 'phaser';
import { ModLoader, type AssetManifest } from './engine/core/ModLoader';
import { registry } from './engine/core/ContentRegistry';
import { BootScene } from './engine/scenes/BootScene';
import { GameScene } from './engine/scenes/GameScene';
import { UIScene } from './engine/scenes/UIScene';

import coreMod from '../mods/core/mod.json';
import coreManifest from '../mods/core/assets/manifest.json';

import playerDef from '../mods/core/entities/player.json';
import rustyCan from '../mods/core/items/rusty-can.json';
import bananaPeel from '../mods/core/items/banana-peel.json';
import plasticBag from '../mods/core/items/plastic-bag.json';
import homeScene from '../mods/core/scenes/home.json';
import homeTrash from '../mods/core/loot-tables/home-trash.json';

async function boot() {
  const loader = new ModLoader();

  const defFiles = [
    { filename: 'entities/player.json', data: playerDef },
    { filename: 'items/rusty-can.json', data: rustyCan },
    { filename: 'items/banana-peel.json', data: bananaPeel },
    { filename: 'items/plastic-bag.json', data: plasticBag },
    { filename: 'scenes/home.json', data: homeScene },
    { filename: 'loot-tables/home-trash.json', data: homeTrash },
  ];

  const { errors } = loader.loadMod(
    coreMod,
    defFiles,
    coreManifest,
    'mods/core/assets',
    registry,
  );

  if (errors.length > 0) {
    console.error('Mod loading errors:');
    for (const err of errors) {
      console.error('  ', err);
    }
  }

  console.log(`Loaded ${registry.size} defs`);

  const manifests = [{ basePath: 'mods/core/assets', manifest: coreManifest as AssetManifest }];

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game-container',
    width: 320,
    height: 240,
    pixelArt: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    scene: [BootScene, GameScene, UIScene],
  });

  game.scene.start('BootScene', { manifests });
}

boot();
