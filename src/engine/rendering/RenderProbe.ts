import {
  Color3,
  MeshBuilder,
  StandardMaterial,
  Vector3,
  type Scene,
  type ArcRotateCamera,
  type Engine,
} from '@babylonjs/core';

/** On-screen Babylon render diagnostics for black-screen debugging. */
export class RenderProbe {
  private el: HTMLPreElement;
  private marker: ReturnType<typeof MeshBuilder.CreateBox> | null = null;
  private frames = 0;
  private visible = false;

  constructor(
    private scene: Scene,
    private engine: Engine,
    private camera: ArcRotateCamera,
  ) {
    this.el = document.createElement('pre');
    this.el.id = 'render-probe';
    this.el.style.cssText =
      'position:fixed;left:8px;bottom:8px;z-index:99990;max-width:min(520px,96vw);max-height:40vh;overflow:auto;' +
      'background:rgba(0,0,0,0.75);color:#9f9;font:11px/1.35 monospace;padding:8px 10px;pointer-events:none;display:none;';
    document.body.appendChild(this.el);

    // Bright emissive cube so we know *something* can draw
    this.marker = MeshBuilder.CreateBox('debugMarker', { size: 2 }, scene);
    this.marker.position = new Vector3(5, 1, 5);
    this.marker.setEnabled(false);
    const mat = new StandardMaterial('debugMarkerMat', scene);
    mat.emissiveColor = new Color3(1, 0.2, 1);
    mat.diffuseColor = new Color3(1, 0.2, 1);
    mat.disableLighting = true;
    this.marker.material = mat;
  }

  /** Show or hide the HUD and debug marker. */
  setVisible(visible: boolean): void {
    this.visible = visible;
    this.el.style.display = visible ? 'block' : 'none';
    this.marker?.setEnabled(visible);
  }

  /** Move the debug marker to a world position (e.g. player). */
  markAt(x: number, y: number, z: number): void {
    if (this.marker) this.marker.position.set(x, y, z);
  }

  /** Refresh HUD text each frame (throttled). */
  update(extra: string[] = []): void {
    if (!this.visible) return;
    this.frames++;
    if (this.frames % 15 !== 0) return;

    const canvas = this.engine.getRenderingCanvas();
    const target = this.camera.getTarget();
    const clear = this.scene.clearColor;
    const meshes = this.scene.meshes;
    const visible = meshes.filter((m) => m.isEnabled() && m.isVisible).length;

    const lines = [
      '=== RENDER PROBE ===',
      `frame: ${this.frames}`,
      `canvas css: ${canvas?.clientWidth}x${canvas?.clientHeight}  buffer: ${this.engine.getRenderWidth()}x${this.engine.getRenderHeight()}`,
      `meshes: ${meshes.length} (visible ${visible})`,
      `activeCamera: ${this.scene.activeCamera?.name ?? 'NONE'}`,
      `cam alpha/beta/radius: ${this.camera.alpha.toFixed(2)} / ${this.camera.beta.toFixed(2)} / ${this.camera.radius.toFixed(1)}`,
      `cam target: (${target.x.toFixed(1)}, ${target.y.toFixed(1)}, ${target.z.toFixed(1)})`,
      `cam pos: (${this.camera.position.x.toFixed(1)}, ${this.camera.position.y.toFixed(1)}, ${this.camera.position.z.toFixed(1)})`,
      `clearColor: (${clear.r.toFixed(2)}, ${clear.g.toFixed(2)}, ${clear.b.toFixed(2)}, ${clear.a.toFixed(2)})`,
      `fog: mode=${this.scene.fogMode} dens=${this.scene.fogDensity.toFixed(3)}`,
      `lights: ${this.scene.lights.length}`,
      ...extra,
      'meshes sample:',
      ...meshes.slice(0, 8).map((m) => {
        const p = m.getAbsolutePosition();
        return `  ${m.name} vis=${m.isVisible} (${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)})`;
      }),
    ];
    this.el.textContent = lines.join('\n');
  }

  /** Remove HUD + marker. */
  dispose(): void {
    this.marker?.dispose();
    this.marker = null;
    this.el.remove();
  }
}
