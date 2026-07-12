import { ModLoader, type AssetManifest } from './engine/core/ModLoader';
import { registry } from './engine/core/ContentRegistry';
import { configManager } from './engine/core/ConfigManager';
import { DebugPanel } from './ui/DebugPanel';
import { cameraConfig } from './engine/configs/cameraConfig';
import { playerConfig } from './engine/configs/playerConfig';
import { audioConfig } from './engine/configs/audioConfig';
import { lampConfig } from './engine/configs/lampConfig';
import { devConfig } from './engine/configs/devConfig';
import { animationConfig } from './engine/configs/animationConfig';
import { BabylonEngine } from './engine/rendering/BabylonEngine';
import { IsometricCamera } from './engine/rendering/IsometricCamera';
import { RenderProbe } from './engine/rendering/RenderProbe';
import { SceneManager } from './engine/scenes/SceneManager';
import { loadAssets } from './engine/scenes/BootScene';

import coreMod from '../mods/core/mod.json';
import coreManifest from '../mods/core/assets/manifest.json';
import playerDef from '../mods/core/entities/player.json';
import rustyCan from '../mods/core/items/rusty-can.json';
import bananaPeel from '../mods/core/items/banana-peel.json';
import plasticBag from '../mods/core/items/plastic-bag.json';
import homeScene from '../mods/core/scenes/home.json';
import caveScene from '../mods/core/scenes/cave.json';
import shopScene from '../mods/core/scenes/shop.json';

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

console.log('[TRASHED] main.ts module loaded — all imports resolved');

async function boot() {
  console.log('[TRASHED] boot() called');
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
  configManager.register(animationConfig);
  configManager.loadPersisted();

  const debugPanel = new DebugPanel(configManager);
  debugPanel.mount();

  const container = document.getElementById('game-container');
  if (!container) throw new Error('#game-container missing');

  const engine = new BabylonEngine(container);
  const camera = new IsometricCamera(engine.scene, engine.canvas);
  const probe = new RenderProbe(engine.scene, engine.engine, camera.camera);
  const syncProbe = () => probe.setVisible(configManager.get<boolean>('dev', 'showRenderProbe'));
  syncProbe();
  configManager.onChange((sectionId, key) => {
    if (sectionId === 'dev' && key === 'showRenderProbe') syncProbe();
  });

  // Paint immediately so load never looks like a frozen black screen
  let scenes: SceneManager | null = null;
  engine.start((dt) => {
    scenes?.update(dt);
    probe.update();
  });

  console.log('Babylon engine created, loading assets...');
  const manifests = [{ basePath: 'mods/core/assets', manifest: coreManifest as AssetManifest }];
  await loadAssets(engine.scene, manifests);
  console.log('Assets loaded');

  scenes = new SceneManager(engine.scene, camera);
  const startScene = configManager.get<string>('dev', 'startScene');
  console.log('Starting scene:', startScene);
  await scenes.start(startScene);

  const t = camera.camera.getTarget();
  probe.markAt(t.x, 1.5, t.z);
  console.log(
    '[boot] post-start meshes=',
    engine.scene.meshes.length,
    'camTarget=',
    t.x.toFixed(1),
    t.z.toFixed(1),
  );

  engine.canvas.focus();
  console.log('Render loop running');
}

boot().catch((err) => {
  console.error('Boot failed', err);
  const msg = document.createElement('pre');
  msg.style.cssText =
    'position:fixed;inset:20px;color:red;font-size:16px;z-index:9999;white-space:pre-wrap;';
  msg.textContent = `BOOT FAILED:\n${err?.stack ?? err}`;
  document.body.appendChild(msg);
});
