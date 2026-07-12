import type { EventBus } from '../core/EventBus';
import type { ContentRegistry } from '../core/ContentRegistry';

export interface RunState {
  currentSceneId: string;
  isInCave: boolean;
}

type TransitionHandler = (opts: { sceneId: string; viaCutscene: boolean }) => void;

/** Manages scene transitions and run state (home = persistent, cave = ephemeral). */
export class SceneDirector {
  private state: RunState = {
    currentSceneId: 'core:home',
    isInCave: false,
  };

  private onTransition: TransitionHandler | null = null;

  constructor(
    private registry: ContentRegistry,
    private eventBus: EventBus,
  ) {}

  /** Register the SceneManager callback that performs the actual load. */
  setTransitionHandler(handler: TransitionHandler): void {
    this.onTransition = handler;
  }

  /** Sync state with the actual scene that was loaded. */
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
  transitionTo(sceneId: string): void {
    const sceneDef = this.registry.get('scene', sceneId);
    if (!sceneDef) {
      console.error(`Scene def not found: ${sceneId}`);
      return;
    }

    const leavingCave = this.state.isInCave && sceneDef.kind !== 'cave';

    this.eventBus.emit('scene:exit', { sceneId: this.state.currentSceneId });

    this.state.currentSceneId = sceneId;
    this.state.isInCave = sceneDef.kind === 'cave';

    this.onTransition?.({ sceneId, viaCutscene: leavingCave });
  }

  /** Reset run state when returning home from a cave. */
  returnHome(): void {
    if (this.state.isInCave) {
      this.state.currentSceneId = 'core:home';
      this.state.isInCave = false;
      this.onTransition?.({ sceneId: 'core:home', viaCutscene: true });
    } else {
      this.transitionTo('core:home');
    }
  }
}
