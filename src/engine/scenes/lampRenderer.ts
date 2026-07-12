import {
  Color3,
  PointLight,
  SpotLight,
  ShadowGenerator,
  Vector3,
  type Scene,
  type AbstractMesh,
} from '@babylonjs/core';
import type { Entity } from '../entities/Entity';
import type { LampSystem } from '../systems/LampSystem';
import type { SceneDirector } from './SceneDirector';
import { configManager } from '../core/ConfigManager';
import type { PropShadow } from './propSpawner';

const LAMP_COLORS: Record<string, Color3> = {
  default: new Color3(1.0, 0.85, 0.55),
  blue: new Color3(0.45, 0.7, 1.0),
  purple: new Color3(0.75, 0.45, 1.0),
  orange: new Color3(1.0, 0.55, 0.25),
};

/**
 * Cave lamp: the ONLY light source in the cave is the player's lantern.
 * A PointLight at the player's hand provides warm illumination whose range
 * shrinks as fuel burns. A downward SpotLight pools light on the floor.
 * Everything outside the range is genuinely dark (no ambient/hemi).
 */
export class LampRenderer {
  private light: PointLight | null = null;
  private floorSpot: SpotLight | null = null;
  private shadowGen: ShadowGenerator | null = null;
  private displayedRadius = 0;
  private darknessAlpha = 0.92;
  private fadingOut = false;

  constructor(
    private scene: Scene,
    private lampSystem: LampSystem,
    private director: SceneDirector,
    private isCave: boolean,
    private player: Entity,
    private wallMeshes: AbstractMesh[] = [],
  ) {}

  /** Create the lantern lights. */
  create(): void {
    this.darknessAlpha = configManager.get<number>('lamp', 'darknessAlpha');
    const colorName = configManager.get<string>('lamp', 'glowColorName') || 'default';
    const color = LAMP_COLORS[colorName] ?? LAMP_COLORS.default;

    // Main warm point light at the player's hand
    this.light = new PointLight('lamp', this.player.mesh.position.clone(), this.scene);
    this.light.diffuse = color;
    this.light.specular = color.scale(0.3);
    this.light.intensity = this.isCave ? 4.0 : 0.6;
    this.light.range = this.isCave ? 14 : 12;

    if (this.isCave) {
      // Downward spot pools warm light on the floor around the player
      this.floorSpot = new SpotLight(
        'lampFloor',
        new Vector3(this.player.x, 6, this.player.y),
        new Vector3(0, -1, 0),
        Math.PI / 2.5,
        1.5,
        this.scene,
      );
      this.floorSpot.diffuse = color;
      this.floorSpot.intensity = 3.0;
      this.floorSpot.range = 18;
    }

    if (this.isCave && this.wallMeshes.length > 0) {
      this.shadowGen = new ShadowGenerator(1024, this.light);
      this.shadowGen.useBlurExponentialShadowMap = true;
      this.shadowGen.blurKernel = 16;
      for (const m of this.wallMeshes) {
        this.shadowGen.addShadowCaster(m);
        m.receiveShadows = true;
      }
    }

    this.displayedRadius = this.computeTargetRadius();
  }

  /** Update light position and radius from lamp fuel. */
  update(_propShadows: PropShadow[]): void {
    if (!this.light || this.fadingOut) return;

    const chestY = this.player.displayHeight * 0.55;
    this.light.position.x = this.player.x;
    this.light.position.y = chestY;
    this.light.position.z = this.player.y;

    const target = this.computeTargetRadius();
    this.displayedRadius += (target - this.displayedRadius) * 0.15;

    // Fuel-driven range: this IS the view distance
    const range = Math.max(1.5, (this.displayedRadius / 16) * (this.isCave ? 1.2 : 0.9));
    this.light.range = range;
    this.light.intensity = this.isCave ? 2.5 + (this.displayedRadius / 200) * 4.0 : 0.55;

    if (this.floorSpot) {
      this.floorSpot.position.x = this.player.x;
      this.floorSpot.position.y = 6;
      this.floorSpot.position.z = this.player.y;
      this.floorSpot.range = range * 1.3;
      this.floorSpot.intensity = 1.5 + (this.displayedRadius / 200) * 2.5;
    }
  }

  /** Apply darkness alpha from config. */
  applyDarknessAlpha(): void {
    this.darknessAlpha = configManager.get<number>('lamp', 'darknessAlpha');
  }

  /** Change lamp tint by named color. */
  setLampColor(name: string): void {
    this.applyColor(name);
  }

  /** Handle lamp extinguished: fade and return home. */
  handleLampOut(): void {
    if (this.fadingOut) return;
    this.fadingOut = true;
    if (this.light) this.light.intensity = 0;
    if (this.floorSpot) this.floorSpot.intensity = 0;
    setTimeout(() => {
      this.lampSystem.reset();
      this.director.returnHome();
      this.fadingOut = false;
    }, 1500);
  }

  /** Dispose light resources. */
  destroy(): void {
    this.shadowGen?.dispose();
    this.light?.dispose();
    this.floorSpot?.dispose();
    this.shadowGen = null;
    this.light = null;
    this.floorSpot = null;
  }

  private computeTargetRadius(): number {
    if (!this.isCave) {
      return configManager.get<number>('lamp', 'glowRadiusMax') * 0.55;
    }
    const ratio = this.lampSystem.ratio;
    const minR = configManager.get<number>('lamp', 'glowRadiusMin');
    const maxR = configManager.get<number>('lamp', 'glowRadiusMax');
    const curved = Math.pow(ratio, 2.5);
    let r = minR + (maxR - minR) * curved;

    const critical = configManager.get<number>('lamp', 'criticalThreshold');
    if (ratio < critical) {
      const t = performance.now() / 1000;
      r *= 0.85 + 0.15 * Math.sin(t * 12) + (Math.random() - 0.5) * 0.08;
    } else {
      const t = performance.now() / 1000;
      r *= 0.97 + 0.03 * Math.sin(t * 3.1);
    }
    return Math.max(0, r);
  }

  private applyColor(name: string): void {
    const c = LAMP_COLORS[name] ?? LAMP_COLORS.default;
    if (this.light) {
      this.light.diffuse = c;
      this.light.specular = c.scale(0.3);
    }
    if (this.floorSpot) {
      this.floorSpot.diffuse = c;
    }
  }
}
