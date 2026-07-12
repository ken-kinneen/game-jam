import { ArcRotateCamera, Vector3, type Scene, type AbstractMesh } from '@babylonjs/core';
import { configManager } from '../core/ConfigManager';

/**
 * Fixed-angle isometric ArcRotateCamera that optionally follows a target mesh.
 * Zoom maps from the camera config section (larger zoom = closer).
 */
export class IsometricCamera {
  readonly camera: ArcRotateCamera;
  private followTarget: AbstractMesh | null = null;
  private staticMode = false;
  private lerpX = 0.1;
  private lerpY = 0.1;

  constructor(scene: Scene, canvas: HTMLCanvasElement) {
    // Elevation ~55°, azimuth ~-45° for classic isometric feel
    this.camera = new ArcRotateCamera(
      'isoCam',
      -Math.PI / 4,
      Math.PI / 3.2,
      40,
      Vector3.Zero(),
      scene,
    );
    // Allow orbit but clamp elevation so you can't flip under the ground
    this.camera.lowerBetaLimit = 0.3;
    this.camera.upperBetaLimit = Math.PI / 2.1;
    this.camera.lowerRadiusLimit = 5;
    this.camera.upperRadiusLimit = 30;
    this.camera.wheelDeltaPercentage = 0.05;
    this.camera.attachControl(canvas, true);
    this.applyConfig();
  }

  /** Follow a mesh each frame (game XZ plane). Snaps immediately so first frame isn't at origin. */
  follow(mesh: AbstractMesh | null): void {
    this.followTarget = mesh;
    this.staticMode = false;
    if (mesh) {
      this.camera.setTarget(new Vector3(mesh.position.x, 0, mesh.position.z));
    }
  }

  /** Lock camera on a world point (no follow). */
  centerOn(x: number, z: number): void {
    this.staticMode = true;
    this.followTarget = null;
    this.camera.setTarget(new Vector3(x, 0, z));
  }

  /** Adjust camera defaults for caves (closer zoom cap). */
  setCaveMode(enabled: boolean): void {
    if (enabled) {
      this.camera.beta = Math.PI / 4;
      this.camera.upperRadiusLimit = 22;
    } else {
      this.camera.upperRadiusLimit = 30;
    }
    this.camera.lowerBetaLimit = 0.3;
    this.camera.upperBetaLimit = Math.PI / 2.1;
  }

  /** Apply zoom/lerp from ConfigManager camera section. */
  applyConfig(): void {
    const zoom = configManager.get<number>('camera', 'zoom');
    // Phaser zoom 4 ≈ radius ~18–25 in our world units (16px tiles → ~1 unit)
    this.camera.radius = Math.max(8, 90 / zoom);
    this.lerpX = configManager.get<number>('camera', 'lerpX');
    this.lerpY = configManager.get<number>('camera', 'lerpY');
  }

  /** Rotate a WASD input vector so "forward" always points away from the camera. */
  rotateInput(x: number, y: number): { x: number; y: number } {
    if (x === 0 && y === 0) return { x: 0, y: 0 };
    const angle = this.camera.alpha + Math.PI / 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      x: x * cos - y * sin,
      y: x * sin + y * cos,
    };
  }

  /** Lerp camera target toward the follow mesh. */
  update(): void {
    if (this.staticMode || !this.followTarget) return;
    const target = this.camera.getTarget();
    const desired = this.followTarget.position;
    target.x += (desired.x - target.x) * this.lerpX;
    target.z += (desired.z - target.z) * this.lerpY;
    target.y = 0;
    this.camera.setTarget(target);
  }
}
