import Phaser from 'phaser';
import PhaserRaycaster from 'phaser-raycaster';
import { ModLoader, type AssetManifest } from './engine/core/ModLoader';
import { registry } from './engine/core/ContentRegistry';
import { configManager } from './engine/core/ConfigManager';
import { BootScene } from './engine/scenes/BootScene';
import { GameScene } from './engine/scenes/GameScene';
import { UIScene } from './engine/scenes/UIScene';
import { ShopScene } from './engine/scenes/ShopScene';
import { UpgradeScene } from './engine/scenes/UpgradeScene';
import { DebugPanel } from './ui/DebugPanel';
import { cameraConfig } from './engine/configs/cameraConfig';
import { playerConfig } from './engine/configs/playerConfig';
import { audioConfig } from './engine/configs/audioConfig';
import { lampConfig } from './engine/configs/lampConfig';
import { devConfig } from './engine/configs/devConfig';

import coreMod from '../mods/core/mod.json';
import coreManifest from '../mods/core/assets/manifest.json';

import playerDef from '../mods/core/entities/player.json';
import rustyCan from '../mods/core/items/rusty-can.json';
import bananaPeel from '../mods/core/items/banana-peel.json';
import plasticBag from '../mods/core/items/plastic-bag.json';
import homeScene from '../mods/core/scenes/home.json';
import caveScene from '../mods/core/scenes/cave.json';
import shopScene from '../mods/core/scenes/shop.json';
import demoScene from '../mods/core/scenes/demo.json';
import homeTrash from '../mods/core/loot-tables/home-trash.json';
import caveTrash from '../mods/core/loot-tables/cave-trash.json';
import oilCan from '../mods/core/items/oil-can.json';
import fuelBottle from '../mods/core/items/fuel-bottle.json';
import battery from '../mods/core/items/battery.json';
import quickFeet from '../mods/core/upgrades/quick-feet.json';
import brightLamp from '../mods/core/upgrades/bright-lamp.json';
import deepPockets from '../mods/core/upgrades/deep-pockets.json';
import fuelEfficiency from '../mods/core/upgrades/fuel-efficiency.json';
import lampBlue from '../mods/core/upgrades/lamp-blue.json';
import lampPurple from '../mods/core/upgrades/lamp-purple.json';
import lampOrange from '../mods/core/upgrades/lamp-orange.json';
import sndItemPickup from '../mods/core/sounds/item-pickup.json';
import sndUpgradeAcquired from '../mods/core/sounds/upgrade-acquired.json';
import sndCaveEnter from '../mods/core/sounds/cave-enter.json';
import sndCaveExit from '../mods/core/sounds/cave-exit.json';
import sndPlayerDeath from '../mods/core/sounds/player-death.json';

async function boot() {
  const loader = new ModLoader();

  const defFiles = [
    { filename: 'entities/player.json', data: playerDef },
    { filename: 'items/rusty-can.json', data: rustyCan },
    { filename: 'items/banana-peel.json', data: bananaPeel },
    { filename: 'items/plastic-bag.json', data: plasticBag },
    { filename: 'items/oil-can.json', data: oilCan },
    { filename: 'items/fuel-bottle.json', data: fuelBottle },
    { filename: 'items/battery.json', data: battery },
    { filename: 'scenes/home.json', data: homeScene },
    { filename: 'scenes/cave.json', data: caveScene },
    { filename: 'scenes/shop.json', data: shopScene },
    { filename: 'scenes/demo.json', data: demoScene },
    { filename: 'loot-tables/home-trash.json', data: homeTrash },
    { filename: 'loot-tables/cave-trash.json', data: caveTrash },
    { filename: 'upgrades/quick-feet.json', data: quickFeet },
    { filename: 'upgrades/bright-lamp.json', data: brightLamp },
    { filename: 'upgrades/deep-pockets.json', data: deepPockets },
    { filename: 'upgrades/fuel-efficiency.json', data: fuelEfficiency },
    { filename: 'upgrades/lamp-blue.json', data: lampBlue },
    { filename: 'upgrades/lamp-purple.json', data: lampPurple },
    { filename: 'upgrades/lamp-orange.json', data: lampOrange },
    { filename: 'sounds/item-pickup.json', data: sndItemPickup },
    { filename: 'sounds/upgrade-acquired.json', data: sndUpgradeAcquired },
    { filename: 'sounds/cave-enter.json', data: sndCaveEnter },
    { filename: 'sounds/cave-exit.json', data: sndCaveExit },
    { filename: 'sounds/player-death.json', data: sndPlayerDeath },
  ];

  const { errors } = loader.loadMod(coreMod, defFiles, coreManifest, 'mods/core/assets', registry);

  if (errors.length > 0) {
    console.error('Mod loading errors:');
    for (const err of errors) {
      console.error('  ', err);
    }
  }

  console.log(`Loaded ${registry.size} defs`);

  configManager.register(cameraConfig);
  configManager.register(playerConfig);
  configManager.register(audioConfig);
  configManager.register(lampConfig);
  configManager.register(devConfig);
  configManager.loadPersisted();

  const debugPanel = new DebugPanel(configManager);
  debugPanel.mount();

  const manifests = [{ basePath: 'mods/core/assets', manifest: coreManifest as AssetManifest }];

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game-container',
    width: Math.round(960 * dpr),
    height: Math.round(720 * dpr),
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
    plugins: {
      scene: [
        {
          key: 'PhaserRaycaster',
          plugin: PhaserRaycaster,
          mapping: 'raycasterPlugin',
        },
      ],
    },
    scene: [BootScene, GameScene, UIScene, ShopScene, UpgradeScene],
  });

  game.scene.start('BootScene', { manifests });
}

boot();
