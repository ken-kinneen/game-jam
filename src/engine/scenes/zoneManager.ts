import { eventBus } from '../core/EventBus';
import type { Entity } from '../entities/Entity';
import type { SceneDef } from '../schemas/scene.schema';
import type { SceneDirector } from './SceneDirector';
import type { DepthSortSystem } from '../systems/DepthSortSystem';
import type { DepthOfFieldSystem } from '../systems/DepthOfFieldSystem';
import { TransformerQuestSystem } from '../systems/TransformerQuestSystem';
import { spawnSceneProps, type PropShadow, type Prop3DInstance } from './propSpawner';

type InteractionHighlight = 'glow' | 'tint' | 'none';

export interface ExitZone {
  sprite: Phaser.Physics.Arcade.Sprite;
  label: Phaser.GameObjects.Text;
  tooltip: Phaser.GameObjects.Text;
  to: string;
  displayLabel: string;
  interactionHighlight: InteractionHighlight;
  propVisual?: Phaser.GameObjects.Image;
}

export interface InteractZone {
  sprite: Phaser.Physics.Arcade.Sprite;
  label: Phaser.GameObjects.Text;
  tooltip: Phaser.GameObjects.Text;
  displayLabel: string;
  action: string;
  interactionRadius?: number;
  interactionHighlight: InteractionHighlight;
  objectiveId?: string;
  propVisual?: Phaser.GameObjects.Image;
}

export type { PropShadow } from './propSpawner';

/** Manages exit/interact zones, props, tooltips, and proximity prompts. */
export class ZoneManager {
  readonly propShadows: PropShadow[] = [];
  readonly props3d: Prop3DInstance[] = [];
  private exitZones: ExitZone[] = [];
  private interactZones: InteractZone[] = [];
  private activeExit: ExitZone | null = null;
  private activeInteract: InteractZone | null = null;
  private promptText!: Phaser.GameObjects.Text;
  private transformerQuest?: TransformerQuestSystem;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly sceneDef: SceneDef | undefined,
    private readonly director: SceneDirector,
    private player: Entity | undefined,
    private readonly depthSort?: DepthSortSystem,
    private readonly dof?: DepthOfFieldSystem,
    private readonly openShop?: () => void,
  ) {}

  /** Resets zone state for a fresh scene load. */
  reset(): void {
    this.transformerQuest?.destroy();
    this.exitZones = [];
    this.interactZones = [];
    this.activeExit = null;
    this.activeInteract = null;
    this.transformerQuest = undefined;
    this.propShadows.length = 0;
    this.props3d.length = 0;
  }

  /** Sets the player reference after spawn. */
  setPlayer(player: Entity): void {
    this.player = player;
  }

  /** Spawns all zones, props, and the on-screen prompt. */
  spawnAll(): void {
    this.spawnExitZones();
    this.spawnShopZones();
    const result = spawnSceneProps(
      this.scene,
      this.sceneDef,
      this.player,
      (prop, visual) => this.registerPropInteraction(prop, visual),
      this.depthSort,
      this.dof,
    );
    this.propShadows.push(...result.propShadows);
    this.props3d.push(...result.props3d);
    this.createPromptText();
    this.createTransformerQuest();
  }

  /** Register a ground-item sprite as an interact zone with glow + tooltip. */
  registerItemInteraction(
    sprite: Phaser.Physics.Arcade.Sprite,
    label: string,
    action: string,
  ): void {
    const tooltip = this.createZoneTooltip(sprite.x, sprite.y + 20, label);

    if (sprite.preFX) {
      sprite.preFX.setPadding(6);
      sprite.preFX.addGlow(0xffdd66, 0, 0, false);
    }

    this.interactZones.push({
      sprite,
      label: this.scene.add
        .text(sprite.x, sprite.y - 36, '', { fontSize: '1px' })
        .setVisible(false),
      tooltip,
      displayLabel: label,
      action,
      interactionHighlight: 'glow',
      propVisual: sprite as unknown as Phaser.GameObjects.Image,
    });
  }

  /** Checks proximity to interact zones and updates prompts. */
  checkInteractOverlap(): void {
    if (!this.player) return;

    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    const threshold = this.getInteractThreshold();

    let nearest: InteractZone | null = null;
    let nearestDist = Infinity;

    for (const zone of this.interactZones) {
      const dist = this.distToZoneEdge(px, py, zone.propVisual, zone.sprite);
      const interactionThreshold = zone.interactionRadius ?? threshold;
      if (dist < interactionThreshold && dist < nearestDist) {
        nearest = zone;
        nearestDist = dist;
      }
    }

    if (nearest && nearest !== this.activeInteract && !this.activeExit) {
      if (this.activeInteract) {
        this.hideTooltip(this.activeInteract.tooltip);
        this.setPropHighlight(
          this.activeInteract.propVisual,
          false,
          this.activeInteract.interactionHighlight,
        );
      }
      this.activeInteract = nearest;
      this.showTooltip(nearest.tooltip);
      this.setPropHighlight(nearest.propVisual, true, nearest.interactionHighlight);
      this.promptText.setText(`E ${nearest.displayLabel}`);
      this.promptText.setVisible(true);
    } else if (!nearest && this.activeInteract) {
      this.hideTooltip(this.activeInteract.tooltip);
      this.setPropHighlight(
        this.activeInteract.propVisual,
        false,
        this.activeInteract.interactionHighlight,
      );
      this.activeInteract = null;
      if (!this.activeExit) {
        this.promptText.setVisible(false);
      }
    }
  }

  /** Checks proximity to exit zones and updates prompts. */
  checkExitOverlap(): void {
    if (!this.player) return;

    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    const threshold = this.getInteractThreshold();

    let nearest: ExitZone | null = null;
    let nearestDist = Infinity;

    for (const zone of this.exitZones) {
      const dist = this.distToZoneEdge(px, py, zone.propVisual, zone.sprite);
      if (dist < threshold && dist < nearestDist) {
        nearest = zone;
        nearestDist = dist;
      }
    }

    if (nearest && nearest !== this.activeExit) {
      if (this.activeExit) {
        this.hideTooltip(this.activeExit.tooltip);
        this.setPropHighlight(
          this.activeExit.propVisual,
          false,
          this.activeExit.interactionHighlight,
        );
      }
      this.activeExit = nearest;
      this.showTooltip(nearest.tooltip);
      this.setPropHighlight(nearest.propVisual, true, nearest.interactionHighlight);
      this.promptText.setText(`E ${nearest.displayLabel}`);
      this.promptText.setVisible(true);
      eventBus.emit('exit:nearby', { exitTo: nearest.to, label: nearest.displayLabel });
    } else if (!nearest && this.activeExit) {
      this.hideTooltip(this.activeExit.tooltip);
      this.setPropHighlight(
        this.activeExit.propVisual,
        false,
        this.activeExit.interactionHighlight,
      );
      this.activeExit = null;
      this.promptText.setVisible(false);
      eventBus.emit('exit:left', {});
    }
  }

  /** Handles the interact key press for the active zone. */
  handleInteractPress(): boolean {
    if (this.activeExit) {
      this.enterExit(this.activeExit);
      return true;
    }
    if (this.activeInteract) {
      this.handleInteraction(this.activeInteract);
      return true;
    }
    return false;
  }

  /** Interaction reach scales with room size — tighter in small rooms. */
  private getInteractThreshold(): number {
    const bounds = this.scene.physics.world.bounds;
    const roomMin = Math.min(bounds.width, bounds.height);
    return Phaser.Math.Clamp(Math.round(roomMin * 0.22), 32, 64);
  }

  private spawnExitZones(): void {
    const exits = this.sceneDef?.exits ?? [];
    for (const exit of exits) {
      const pos = exit.position ?? { x: 320, y: 32 };
      const displayLabel = exit.label ?? exit.to;

      const zoneSprite = this.scene.physics.add.sprite(pos.x, pos.y, '__placeholder');
      zoneSprite.setDisplaySize(48, 48);
      zoneSprite.setAlpha(0.6);
      zoneSprite.setTint(0x44aaff);
      zoneSprite.setDepth(5);
      const body = zoneSprite.body as Phaser.Physics.Arcade.Body;
      body.setImmovable(true);
      body.setAllowGravity(false);

      const label = this.scene.add.text(pos.x, pos.y - 36, displayLabel, {
        fontFamily: '"Courier New", monospace',
        fontSize: '18px',
        color: '#88ccff',
        stroke: '#000000',
        strokeThickness: 3,
        align: 'center',
      });
      label.setOrigin(0.5, 0.5);
      label.setDepth(10);

      const tooltip = this.createZoneTooltip(pos.x, pos.y + 34);

      this.exitZones.push({
        sprite: zoneSprite,
        label,
        tooltip,
        to: exit.to,
        displayLabel,
        interactionHighlight: 'glow',
      });
    }
  }

  private spawnShopZones(): void {
    const shops = this.sceneDef?.shops ?? [];
    for (const shop of shops) {
      const pos = shop.position;
      const displayLabel = shop.label ?? 'Shop';

      const zoneSprite = this.scene.physics.add.sprite(pos.x, pos.y, '__placeholder');
      zoneSprite.setDisplaySize(48, 48);
      zoneSprite.setAlpha(0.6);
      zoneSprite.setTint(0xffaa44);
      zoneSprite.setDepth(5);
      const body = zoneSprite.body as Phaser.Physics.Arcade.Body;
      body.setImmovable(true);
      body.setAllowGravity(false);

      const label = this.scene.add.text(pos.x, pos.y - 36, displayLabel, {
        fontFamily: '"Courier New", monospace',
        fontSize: '18px',
        color: '#ffcc88',
        stroke: '#000000',
        strokeThickness: 3,
        align: 'center',
      });
      label.setOrigin(0.5, 0.5);
      label.setDepth(10);

      const tooltip = this.createZoneTooltip(pos.x, pos.y + 34);

      this.interactZones.push({
        sprite: zoneSprite,
        label,
        tooltip,
        displayLabel,
        action: 'shop',
        interactionHighlight: 'glow',
      });
    }
  }

  /** Registers a prop as an interaction or exit zone. */
  private registerPropInteraction(
    prop: {
      position: { x: number; y: number };
      action?: string;
      actionTarget?: string;
      actionLabel?: string;
      interactionRadius?: number;
      interactionHighlight?: InteractionHighlight;
    },
    visual?: Phaser.GameObjects.Image,
  ): void {
    const pos = prop.position;
    const displayLabel = prop.actionLabel ?? prop.action ?? '';
    const tooltip = this.createZoneTooltip(pos.x, pos.y + 40, displayLabel);
    const interactionHighlight = prop.interactionHighlight ?? 'glow';

    if (visual?.preFX && interactionHighlight === 'glow') {
      visual.preFX.setPadding(6);
      visual.preFX.addGlow(0xffdd66, 0, 0, false);
    }

    const { sprite, label } = this.createHiddenZone(pos.x, pos.y);
    if (prop.action === 'exit' && prop.actionTarget) {
      this.exitZones.push({
        sprite,
        label,
        tooltip,
        to: prop.actionTarget,
        displayLabel,
        interactionHighlight,
        propVisual: visual,
      });
    } else if (
      prop.action === 'transformer' ||
      prop.action === 'shop' ||
      prop.action === 'upgrade'
    ) {
      this.interactZones.push({
        sprite,
        label,
        tooltip,
        displayLabel,
        action: prop.action,
        interactionRadius: prop.interactionRadius,
        interactionHighlight,
        objectiveId: prop.action === 'transformer' ? `transformer:${pos.x}:${pos.y}` : undefined,
        propVisual: visual,
      });
    }
  }

  private createHiddenZone(
    x: number,
    y: number,
  ): { sprite: Phaser.Physics.Arcade.Sprite; label: Phaser.GameObjects.Text } {
    const sprite = this.scene.physics.add.sprite(x, y, '__placeholder');
    sprite.setDisplaySize(48, 48);
    sprite.setAlpha(0);
    sprite.setDepth(5);
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setImmovable(true);
    body.setAllowGravity(false);

    const label = this.scene.add.text(x, y - 36, '', { fontSize: '1px' });
    label.setVisible(false);
    return { sprite, label };
  }

  private createZoneTooltip(x: number, y: number, label?: string): Phaser.GameObjects.Text {
    const text = label ? `E  ${label}` : 'E';
    const tip = this.scene.add.text(x, y, text, {
      fontFamily: '"Courier New", monospace',
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 6, y: 3 },
      stroke: '#000000',
      strokeThickness: 2,
    });
    tip.setOrigin(0.5, 0);
    tip.setDepth(11);
    tip.setVisible(false);
    return tip;
  }

  private showTooltip(tooltip: Phaser.GameObjects.Text): void {
    if (tooltip.visible) return;
    tooltip.setVisible(true);
    tooltip.setAlpha(0);
    this.scene.tweens.add({ targets: tooltip, alpha: 1, duration: 150 });
  }

  private hideTooltip(tooltip: Phaser.GameObjects.Text): void {
    if (!tooltip.visible) return;
    this.scene.tweens.add({
      targets: tooltip,
      alpha: 0,
      duration: 150,
      onComplete: () => tooltip.setVisible(false),
    });
  }

  /** Calculates distance from a point to the nearest edge of a prop body. */
  private distToZoneEdge(
    px: number,
    py: number,
    propVisual: Phaser.GameObjects.Image | undefined,
    fallbackSprite: Phaser.Physics.Arcade.Sprite,
  ): number {
    if (propVisual) {
      const bounds = propVisual.getBounds();
      const bx = bounds.x;
      const by = bounds.y;
      const bw = bounds.width;
      const bh = bounds.height;

      const cx = Math.max(bx, Math.min(px, bx + bw));
      const cy = Math.max(by, Math.min(py, by + bh));
      const dx = px - cx;
      const dy = py - cy;
      return Math.sqrt(dx * dx + dy * dy);
    }
    const dx = px - fallbackSprite.x;
    const dy = py - fallbackSprite.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /** Activates or deactivates the configured proximity highlight. */
  private setPropHighlight(
    visual: Phaser.GameObjects.Image | undefined,
    active: boolean,
    mode: InteractionHighlight,
  ): void {
    if (mode === 'none' || !visual) return;
    if (mode === 'tint') {
      if (active) visual.setTint(0xffdd88);
      else visual.clearTint();
      return;
    }
    if (!visual.preFX) return;
    const fx = visual.preFX.list;
    const glow = fx.find((f) => (f as { type?: number }).type === 4) as Phaser.FX.Glow | undefined;
    if (!glow) return;

    this.scene.tweens.killTweensOf(glow);
    if (active) {
      this.scene.tweens.add({
        targets: glow,
        outerStrength: 4,
        duration: 200,
        ease: 'Sine.easeOut',
      });
    } else {
      this.scene.tweens.add({
        targets: glow,
        outerStrength: 0,
        duration: 300,
        ease: 'Sine.easeIn',
      });
    }
  }

  private handleInteraction(zone: InteractZone): void {
    if (zone.action === 'shop') {
      if (this.sceneDef?.kind === 'shop') {
        this.openShop?.();
      } else {
        this.scene.cameras.main.fade(500, 0, 0, 0, false, (_cam: unknown, progress: number) => {
          if (progress >= 1) {
            this.director.transitionTo('core:shop', this.scene);
          }
        });
      }
    } else if (zone.action === 'upgrade') {
      this.openShop?.();
    } else if (zone.action === 'transformer') {
      this.handleTransformerActivation(zone);
    } else if (zone.action === 'banana') {
      eventBus.emit('item:interact', { itemId: 'banana_peel' });
    }
  }

  private handleTransformerActivation(zone: InteractZone): void {
    if (!this.transformerQuest || !zone.objectiveId) return;

    const progress = this.transformerQuest.activate(zone.objectiveId, {
      x: zone.sprite.x,
      y: zone.sprite.y,
    });
    if (!progress.activated) return;

    this.hideTooltip(zone.tooltip);
    this.setPropHighlight(zone.propVisual, false, zone.interactionHighlight);
    zone.propVisual?.setTint(0x88ff99);
    zone.sprite.disableBody(true, true);
    this.interactZones = this.interactZones.filter((candidate) => candidate !== zone);
    this.activeInteract = null;
    this.promptText.setVisible(false);
  }

  private createTransformerQuest(): void {
    const quest = this.sceneDef?.quest;
    if (quest?.type !== 'activate_all_transformers') return;

    const transformerCount = this.interactZones.filter(
      (zone) => zone.action === 'transformer',
    ).length;
    if (transformerCount === 0) return;

    this.transformerQuest = new TransformerQuestSystem(
      this.scene,
      transformerCount,
      {
        title: quest.title,
        completionText: quest.completionText,
        exitTitle: quest.exitTitle,
      },
      () => this.director.transitionTo(quest.completionScene, this.scene),
    );
  }

  private createPromptText(): void {
    const cam = this.scene.cameras.main;
    this.promptText = this.scene.add.text(cam.width / 2, cam.height - 60, '', {
      fontFamily: '"Courier New", monospace',
      fontSize: '24px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
    });
    this.promptText.setOrigin(0.5, 0.5);
    this.promptText.setScrollFactor(0);
    this.promptText.setDepth(900);
    this.promptText.setVisible(false);
  }

  private enterExit(exit: ExitZone): void {
    if (this.transformerQuest) {
      if (!this.transformerQuest.canExitSuccessfully) {
        this.transformerQuest.showExitBlockedFeedback();
        return;
      }
      this.transformerQuest.completeAtExit();
      return;
    }

    this.scene.cameras.main.fade(500, 0, 0, 0, false, (_cam: unknown, progress: number) => {
      if (progress >= 1) {
        this.director.transitionTo(exit.to, this.scene);
      }
    });
  }
}
