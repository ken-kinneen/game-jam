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

    this.eventBus.emit('scene:exit', { sceneId: this.state.currentSceneId });

    this.state.currentSceneId = sceneId;
    this.state.isInCave = sceneDef.kind === 'cave';

    // GameScene.create() emits scene:enter after restart completes
    phaserScene.scene.restart({ sceneId });
  }

  /** Reset run state when returning home from a cave. */
  returnHome(phaserScene: Phaser.Scene): void {
    this.transitionTo('core:home', phaserScene);
  }
}
