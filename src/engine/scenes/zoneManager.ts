import { eventBus } from '../core/EventBus';
import type { Entity } from '../entities/Entity';
import type { SceneDef } from '../schemas/scene.schema';
import type { SceneDirector } from './SceneDirector';
import type { DepthSortSystem } from '../systems/DepthSortSystem';
import type { DepthOfFieldSystem } from '../systems/DepthOfFieldSystem';
import { spawnSceneProps, type PropShadow, type Prop3DInstance } from './propSpawner';

export interface ExitZone {
  sprite: Phaser.Physics.Arcade.Sprite;
  label: Phaser.GameObjects.Text;
  tooltip: Phaser.GameObjects.Text;
  to: string;
  displayLabel: string;
  propVisual?: Phaser.GameObjects.Image;
}

export interface InteractZone {
  sprite: Phaser.Physics.Arcade.Sprite;
  label: Phaser.GameObjects.Text;
  tooltip: Phaser.GameObjects.Text;
  displayLabel: string;
  action: string;
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
    this.exitZones = [];
    this.interactZones = [];
    this.activeExit = null;
    this.activeInteract = null;
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
      if (dist < threshold && dist < nearestDist) {
        nearest = zone;
        nearestDist = dist;
      }
    }

    if (nearest && nearest !== this.activeInteract && !this.activeExit) {
      if (this.activeInteract) {
        this.hideTooltip(this.activeInteract.tooltip);
        this.setPropGlow(this.activeInteract.propVisual, false);
      }
      this.activeInteract = nearest;
      this.showTooltip(nearest.tooltip);
      this.setPropGlow(nearest.propVisual, true);
      this.promptText.setText(`E ${nearest.displayLabel}`);
      this.promptText.setVisible(true);
    } else if (!nearest && this.activeInteract) {
      this.hideTooltip(this.activeInteract.tooltip);
      this.setPropGlow(this.activeInteract.propVisual, false);
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
        this.setPropGlow(this.activeExit.propVisual, false);
      }
      this.activeExit = nearest;
      this.showTooltip(nearest.tooltip);
      this.setPropGlow(nearest.propVisual, true);
      this.promptText.setText(`E ${nearest.displayLabel}`);
      this.promptText.setVisible(true);
      eventBus.emit('exit:nearby', { exitTo: nearest.to, label: nearest.displayLabel });
    } else if (!nearest && this.activeExit) {
      this.hideTooltip(this.activeExit.tooltip);
      this.setPropGlow(this.activeExit.propVisual, false);
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

      this.exitZones.push({ sprite: zoneSprite, label, tooltip, to: exit.to, displayLabel });
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

      this.interactZones.push({ sprite: zoneSprite, label, tooltip, displayLabel, action: 'shop' });
    }
  }

  /** Registers a prop as an interaction or exit zone. */
  private registerPropInteraction(
    prop: {
      position: { x: number; y: number };
      action?: string;
      actionTarget?: string;
      actionLabel?: string;
    },
    visual?: Phaser.GameObjects.Image,
  ): void {
    const pos = prop.position;
    const displayLabel = prop.actionLabel ?? prop.action ?? '';
    const tooltip = this.createZoneTooltip(pos.x, pos.y + 40, displayLabel);

    if (visual?.preFX) {
      visual.preFX.setPadding(6);
      visual.preFX.addGlow(0xffdd66, 0, 0, false);
    }

    if (prop.action === 'exit' && prop.actionTarget) {
      const zoneSprite = this.scene.physics.add.sprite(pos.x, pos.y, '__placeholder');
      zoneSprite.setDisplaySize(48, 48);
      zoneSprite.setAlpha(0);
      zoneSprite.setDepth(5);
      const body = zoneSprite.body as Phaser.Physics.Arcade.Body;
      body.setImmovable(true);
      body.setAllowGravity(false);

      const label = this.scene.add.text(pos.x, pos.y - 36, '', { fontSize: '1px' });
      label.setVisible(false);

      this.exitZones.push({
        sprite: zoneSprite,
        label,
        tooltip,
        to: prop.actionTarget,
        displayLabel,
        propVisual: visual,
      });
    } else if (prop.action === 'transformer') {
      const zoneSprite = this.scene.physics.add.sprite(pos.x, pos.y, '__placeholder');
      zoneSprite.setDisplaySize(48, 48);
      zoneSprite.setAlpha(0);
      zoneSprite.setDepth(5);
      const body = zoneSprite.body as Phaser.Physics.Arcade.Body;
      body.setImmovable(true);
      body.setAllowGravity(false);

      const label = this.scene.add.text(pos.x, pos.y - 36, '', { fontSize: '1px' });
      label.setVisible(false);

      this.interactZones.push({
        sprite: zoneSprite,
        label,
        tooltip,
        displayLabel,
        action: 'transformer',
        propVisual: visual,
      });
    } else if (prop.action === 'shop' || prop.action === 'upgrade') {
      const zoneSprite = this.scene.physics.add.sprite(pos.x, pos.y, '__placeholder');
      zoneSprite.setDisplaySize(48, 48);
      zoneSprite.setAlpha(0);
      zoneSprite.setDepth(5);
      const body = zoneSprite.body as Phaser.Physics.Arcade.Body;
      body.setImmovable(true);
      body.setAllowGravity(false);

      const label = this.scene.add.text(pos.x, pos.y - 36, '', { fontSize: '1px' });
      label.setVisible(false);

      this.interactZones.push({
        sprite: zoneSprite,
        label,
        tooltip,
        displayLabel,
        action: prop.action,
        propVisual: visual,
      });
    }
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
    if (propVisual && 'body' in propVisual && propVisual.body) {
      const body = propVisual.body as Phaser.Physics.Arcade.StaticBody;
      const bx = body.x;
      const by = body.y;
      const bw = body.width;
      const bh = body.height;

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

  /** Activates or deactivates the glow effect on an interactive prop. */
  private setPropGlow(visual: Phaser.GameObjects.Image | undefined, active: boolean): void {
    if (!visual?.preFX) return;
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
      this.handleTransformerActivation();
    }
  }

  private handleTransformerActivation(): void {
    eventBus.emit('transformer:activated', {});

    this.scene.cameras.main.flash(600, 255, 220, 120);

    const statusText = this.scene.add.text(
      this.scene.cameras.main.width / 2,
      this.scene.cameras.main.height / 2,
      'GRID SECTION RESTORED',
      {
        fontFamily: '"Courier New", monospace',
        fontSize: '28px',
        color: '#ffdd44',
        stroke: '#000000',
        strokeThickness: 5,
        align: 'center',
      },
    );
    statusText.setOrigin(0.5, 0.5);
    statusText.setScrollFactor(0);
    statusText.setDepth(1000);
    statusText.setAlpha(0);

    this.scene.tweens.add({
      targets: statusText,
      alpha: 1,
      duration: 400,
      yoyo: true,
      hold: 1500,
      onComplete: () => statusText.destroy(),
    });

    this.scene.time.delayedCall(2500, () => {
      this.scene.cameras.main.fade(1000, 0, 0, 0, false, (_cam: unknown, progress: number) => {
        if (progress >= 1) {
          this.director.transitionTo('core:home', this.scene);
        }
      });
    });
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
    this.scene.cameras.main.fade(500, 0, 0, 0, false, (_cam: unknown, progress: number) => {
      if (progress >= 1) {
        this.director.transitionTo(exit.to, this.scene);
      }
    });
  }
}
