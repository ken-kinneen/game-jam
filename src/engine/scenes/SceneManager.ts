import type { Scene } from '@babylonjs/core';
import type { IsometricCamera } from '../rendering/IsometricCamera';
import { SceneDirector } from './SceneDirector';
import { GameScene } from './GameScene';
import { eventBus } from '../core/EventBus';
import { registry } from '../core/ContentRegistry';
import { HudOverlay } from '../ui/HudOverlay';
import { ShopOverlay } from '../ui/ShopOverlay';
import { UpgradeOverlay } from '../ui/UpgradeOverlay';
import { playCutscene } from './CutsceneScene';
import { DebugButtons } from '../ui/DebugButtons';

/**
 * Owns GameScene lifecycle and DOM overlays.
 * Replaces Phaser's multi-scene stack with a single Babylon scene + overlays.
 */
export class SceneManager {
  readonly director: SceneDirector;
  private gameScene: GameScene;
  private hud: HudOverlay;
  private shop: ShopOverlay;
  private upgrade: UpgradeOverlay;
  private busy = false;

  constructor(
    private babylonScene: Scene,
    private camera: IsometricCamera,
  ) {
    this.director = new SceneDirector(registry, eventBus);
    this.hud = new HudOverlay();
    this.shop = new ShopOverlay(() => this.gameScene.getPlayerStats());
    this.upgrade = new UpgradeOverlay(() => this.gameScene.getPlayerStats());

    this.gameScene = new GameScene(
      babylonScene,
      camera,
      {
        openShop: () => this.shop.open(),
        openUpgrade: () => this.upgrade.open(),
        setPrompt: (text) => this.hud.setPrompt(text),
        ensureHud: (sceneId) => this.hud.show(sceneId),
      },
      this.director,
    );

    this.director.setTransitionHandler(({ sceneId, viaCutscene }) => {
      void this.transition(sceneId, viaCutscene);
    });

    new DebugButtons();
    eventBus.on('debug:request_transition', ({ sceneId }) => {
      void this.transition(sceneId, false);
    });
  }

  /** Start the first gameplay scene. */
  async start(sceneId: string): Promise<void> {
    await this.gameScene.start(sceneId);
  }

  /** Forward the render-loop tick. */
  update(dt: number): void {
    if (this.busy) return;
    this.gameScene.update(dt);
    this.hud.update();
  }

  private async transition(sceneId: string, viaCutscene: boolean): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      if (viaCutscene) {
        await playCutscene('mods/core/assets/video/cave_exit.mp4');
      }
      await this.gameScene.start(sceneId);
    } finally {
      this.busy = false;
    }
  }
}
