import type { EventBus } from '../core/EventBus';
import type { ContentRegistry } from '../core/ContentRegistry';

export interface RunState {
  currentSceneId: string;
  isInCave: boolean;
}

/** Manages scene transitions and run state (home = persistent, cave = ephemeral). */
export class SceneDirector {
  private state: RunState = {
    currentSceneId: 'core:home',
    isInCave: false,
  };

  constructor(
    private registry: ContentRegistry,
    private eventBus: EventBus,
  ) {}

  /** Sync state with the actual scene that was loaded (e.g. from BootScene). */
  syncState(sceneId: string, isCave: boolean): void {
    this.state.currentSceneId = sceneId;
    this.state.isInCave = isCave;
  }

  /** Get the current scene ID. */
  get currentSceneId(): string {
    return this.state.currentSceneId;
  }

  /** Whether the player is currently in a cave run. */
  get isInCave(): boolean {
    return this.state.isInCave;
  }

  /** Transition to a new scene by def ID. */
  transitionTo(sceneId: string, phaserScene: Phaser.Scene): void {
    const sceneDef = this.registry.get('scene', sceneId);
    if (!sceneDef) {
      console.error(`Scene def not found: ${sceneId}`);
      return;
    }

    const leavingCave = this.state.isInCave && sceneDef.kind !== 'cave';

    this.eventBus.emit('scene:exit', { sceneId: this.state.currentSceneId });

    this.state.currentSceneId = sceneId;
    this.state.isInCave = sceneDef.kind === 'cave';

    if (leavingCave) {
      phaserScene.scene.start('CutsceneScene', {
        video: 'cutscene_cave_exit',
        nextSceneId: sceneId,
      });
    } else {
      phaserScene.scene.restart({ sceneId });
    }
  }

  /** Reset run state when returning home from a cave. */
  returnHome(phaserScene: Phaser.Scene): void {
    if (this.state.isInCave) {
      this.state.currentSceneId = 'core:home';
      this.state.isInCave = false;
      phaserScene.scene.start('CutsceneScene', {
        video: 'cutscene_cave_exit',
        nextSceneId: 'core:home',
      });
    } else {
      this.transitionTo('core:home', phaserScene);
    }
  }
}
