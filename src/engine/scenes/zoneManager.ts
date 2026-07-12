import { eventBus } from '../core/EventBus';
import type { Entity } from '../entities/Entity';
import type { SceneDef } from '../schemas/scene.schema';
import type { SceneDirector } from './SceneDirector';
import { spawnSceneProps, type PropShadow } from './propSpawner';
import {
  GlowLayer,
  type Scene,
  type AbstractMesh,
  type Mesh,
  type TransformNode,
} from '@babylonjs/core';
import type { CollisionWorld } from '../rendering/CollisionWorld';
import { WORLD_SCALE } from '../entities/EntityFactory';

export interface ExitZone {
  x: number;
  y: number;
  to: string;
  displayLabel: string;
  propVisual?: AbstractMesh | TransformNode;
}

export interface InteractZone {
  x: number;
  y: number;
  displayLabel: string;
  action: string;
  actionTarget?: string;
  propVisual?: AbstractMesh | TransformNode;
}

export type { PropShadow } from './propSpawner';

type OverlayCallbacks = {
  openShop: () => void;
  openUpgrade: () => void;
  setPrompt: (text: string | null) => void;
};

/** Manages exit/interact zones, props, and proximity prompts. */
export class ZoneManager {
  readonly propShadows: PropShadow[] = [];
  private exitZones: ExitZone[] = [];
  private interactZones: InteractZone[] = [];
  private activeExit: ExitZone | null = null;
  private activeInteract: InteractZone | null = null;
  private transitioning = false;
  private glowLayer: GlowLayer | null = null;
  private readonly glowingMeshes = new Set<Mesh>();
  private glowEnvelope = 0;
  private glowTarget = 0;
  private propDisposables: { dispose: () => void }[] = [];

  constructor(
    private readonly scene: Scene,
    private readonly sceneDef: SceneDef | undefined,
    private readonly director: SceneDirector,
    private player: Entity | undefined,
    private readonly overlays: OverlayCallbacks,
    private readonly collision: CollisionWorld,
  ) {}

  /** Resets zone state for a fresh scene load. */
  reset(): void {
    this.exitZones = [];
    this.interactZones = [];
    this.activeExit = null;
    this.activeInteract = null;
    this.propShadows.length = 0;
    this.transitioning = false;
    this.glowingMeshes.clear();
    this.glowEnvelope = 0;
    this.glowTarget = 0;
    this.glowLayer?.dispose();
    this.glowLayer = null;
    for (const d of this.propDisposables) d.dispose();
    this.propDisposables = [];
  }

  /** Sets the player reference after spawn. */
  setPlayer(player: Entity): void {
    this.player = player;
  }

  /** Spawns all zones, props, and wires the on-screen prompt. */
  spawnAll(): void {
    this.spawnExitZones();
    this.spawnShopZones();
    const { shadows, walls, disposables } = spawnSceneProps(
      this.scene,
      this.sceneDef,
      this.player,
      (prop, visual) => this.registerPropInteraction(prop, visual),
    );
    this.propDisposables.push(...disposables);
    this.propShadows.push(...shadows);
    if (walls.length > 0) {
      this.collision.setWalls([...this.collision.walls, ...walls]);
    }
  }

  /** Checks proximity to interact zones and updates prompts. */
  checkInteractOverlap(): void {
    if (!this.player) return;

    const px = this.player.x / WORLD_SCALE;
    const py = this.player.y / WORLD_SCALE;
    const threshold = this.getInteractThreshold();

    let nearest: InteractZone | null = null;
    let nearestDist = Infinity;

    for (const zone of this.interactZones) {
      const dist = Math.hypot(zone.x - px, zone.y - py);
      if (dist < threshold && dist < nearestDist) {
        nearest = zone;
        nearestDist = dist;
      }
    }

    if (nearest && nearest !== this.activeInteract && !this.activeExit) {
      this.activeInteract = nearest;
      this.overlays.setPrompt(`[E] ${nearest.displayLabel}`);
      this.highlightProp(nearest.propVisual);
    } else if (!nearest && this.activeInteract) {
      this.activeInteract = null;
      this.clearHighlight();
      if (!this.activeExit) this.overlays.setPrompt(null);
    }
  }

  /** Checks proximity to exit zones and updates prompts. */
  checkExitOverlap(): void {
    if (!this.player) return;

    const px = this.player.x / WORLD_SCALE;
    const py = this.player.y / WORLD_SCALE;
    const threshold = this.getInteractThreshold();

    let nearest: ExitZone | null = null;
    let nearestDist = Infinity;

    for (const zone of this.exitZones) {
      const dist = Math.hypot(zone.x - px, zone.y - py);
      if (dist < threshold && dist < nearestDist) {
        nearest = zone;
        nearestDist = dist;
      }
    }

    if (nearest && nearest !== this.activeExit) {
      if (this.activeExit) eventBus.emit('exit:left', {});
      this.activeExit = nearest;
      this.activeInteract = null;
      this.overlays.setPrompt(`[E] ${nearest.displayLabel}`);
      this.highlightProp(nearest.propVisual);
      eventBus.emit('exit:nearby', { exitTo: nearest.to, label: nearest.displayLabel });
    } else if (!nearest && this.activeExit) {
      eventBus.emit('exit:left', {});
      this.activeExit = null;
      this.clearHighlight();
      this.overlays.setPrompt(null);
    }
  }

  /** Handle E press on the active zone. */
  handleInteractPress(): void {
    if (this.transitioning) return;

    if (this.activeExit) {
      this.transitioning = true;
      this.overlays.setPrompt(null);
      this.clearHighlight();
      this.director.transitionTo(this.activeExit.to);
      return;
    }

    if (this.activeInteract) {
      const action = this.activeInteract.action;
      if (action === 'shop') {
        if (this.activeInteract.actionTarget) {
          this.director.transitionTo(this.activeInteract.actionTarget);
        } else {
          this.overlays.openShop();
        }
      } else if (action === 'upgrade') {
        this.overlays.openUpgrade();
      } else if (action === 'exit' && this.activeInteract.actionTarget) {
        this.director.transitionTo(this.activeInteract.actionTarget);
      }
    }
  }

  private spawnExitZones(): void {
    for (const exit of this.sceneDef?.exits ?? []) {
      const pos = exit.position ?? this.sceneDef?.playerSpawn ?? { x: 100, y: 100 };
      this.exitZones.push({
        x: pos.x,
        y: pos.y,
        to: exit.to,
        displayLabel: exit.label ?? 'Exit',
      });
    }
  }

  private spawnShopZones(): void {
    for (const shop of this.sceneDef?.shops ?? []) {
      this.interactZones.push({
        x: shop.position.x,
        y: shop.position.y,
        displayLabel: shop.label ?? 'Shop',
        action: 'shop',
      });
    }
  }

  private registerPropInteraction(
    prop: {
      position: { x: number; y: number };
      action?: string;
      actionTarget?: string;
      actionLabel?: string;
    },
    visual?: AbstractMesh | TransformNode,
  ): void {
    if (!prop.action) return;
    if (prop.action === 'exit') {
      this.exitZones.push({
        x: prop.position.x,
        y: prop.position.y,
        to: prop.actionTarget ?? 'core:home',
        displayLabel: prop.actionLabel ?? 'Exit',
        propVisual: visual,
      });
    } else {
      this.interactZones.push({
        x: prop.position.x,
        y: prop.position.y,
        displayLabel: prop.actionLabel ?? prop.action,
        action: prop.action,
        actionTarget: prop.actionTarget,
        propVisual: visual,
      });
    }
  }

  /** Lerp the glow envelope toward its target. Call once per frame. */
  updateGlow(dt: number): void {
    const speed = 4;
    if (this.glowEnvelope < this.glowTarget) {
      this.glowEnvelope = Math.min(this.glowTarget, this.glowEnvelope + speed * dt);
    } else if (this.glowEnvelope > this.glowTarget) {
      this.glowEnvelope = Math.max(this.glowTarget, this.glowEnvelope - speed * dt);
      if (this.glowEnvelope < 0.001) this.glowingMeshes.clear();
    }
  }

  /** Apply a pulsing yellow glow to a prop (respects texture alpha). */
  private highlightProp(visual: AbstractMesh | TransformNode | undefined): void {
    this.clearHighlight();
    if (!visual) return;
    if (!this.glowLayer) {
      this.glowLayer = new GlowLayer('propGlow', this.scene, {
        blurKernelSize: 32,
      });
      this.glowLayer.intensity = 0.6;
      this.glowLayer.customEmissiveColorSelector = (mesh, _subMesh, _material, result) => {
        if (this.glowingMeshes.has(mesh as Mesh) && this.glowEnvelope > 0.001) {
          const pulse = 0.1 + 0.1 * Math.sin(performance.now() * 0.004);
          const v = pulse * this.glowEnvelope;
          result.set(v, v * 0.85, v * 0.2, 1);
        } else {
          result.set(0, 0, 0, 0);
        }
      };
    }
    this.glowTarget = 1;
    const addMesh = (m: AbstractMesh) => {
      if (!m.getTotalVertices || m.getTotalVertices() <= 0) return;
      this.glowingMeshes.add(m as Mesh);
    };
    if ('getTotalVertices' in visual) addMesh(visual as AbstractMesh);
    for (const m of visual.getChildMeshes(false)) addMesh(m);
  }

  /** Fade out and remove glow from highlighted meshes. */
  private clearHighlight(): void {
    this.glowTarget = 0;
    // Meshes stay in the set until envelope reaches zero so the fade-out renders
    if (this.glowEnvelope < 0.001) this.glowingMeshes.clear();
  }

  private getInteractThreshold(): number {
    const gen = this.sceneDef?.generation;
    let roomMin = 400;
    if (gen && 'width' in gen && 'height' in gen) {
      roomMin = Math.min(gen.width as number, gen.height as number);
    }
    return Math.max(32, Math.min(64, roomMin * 0.22));
  }
}
