import { Engine, Scene, HemisphericLight, Vector3, Color4, Color3 } from '@babylonjs/core';

/** Owns the Babylon Engine, primary Scene, and render loop. */
export class BabylonEngine {
  readonly engine: Engine;
  readonly scene: Scene;
  readonly canvas: HTMLCanvasElement;

  private running = false;

  constructor(container: HTMLElement) {
    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.tabIndex = 0;
    container.appendChild(canvas);
    this.canvas = canvas;

    this.engine = new Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      adaptToDeviceRatio: true,
    });

    this.scene = new Scene(this.engine);
    // Bright clear so a blank scene is obviously NOT "no WebGL" black
    this.scene.clearColor = new Color4(0.25, 0.45, 0.65, 1);

    const hemi = new HemisphericLight('hemi', new Vector3(0.3, 1, 0.2), this.scene);
    hemi.intensity = 1.4;
    hemi.groundColor = new Color3(0.3, 0.25, 0.2);

    // CSS size ≠ buffer size until resize — black canvas if skipped
    this.engine.resize();
    window.addEventListener('resize', () => this.engine.resize());

    console.log(
      '[BabylonEngine] canvas',
      canvas.clientWidth,
      'x',
      canvas.clientHeight,
      'buffer',
      this.engine.getRenderWidth(),
      'x',
      this.engine.getRenderHeight(),
    );
  }

  /** Start the render loop, calling onUpdate each frame with dt in seconds. */
  start(onUpdate: (dt: number) => void): void {
    if (this.running) return;
    this.running = true;
    let last = performance.now();
    this.engine.runRenderLoop(() => {
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      onUpdate(dt);
      this.scene.render();
    });
  }

  /** Stop the render loop. */
  stop(): void {
    this.running = false;
    this.engine.stopRenderLoop();
  }

  /** Dispose engine and canvas. */
  dispose(): void {
    this.stop();
    this.scene.dispose();
    this.engine.dispose();
    this.canvas.remove();
  }
}
