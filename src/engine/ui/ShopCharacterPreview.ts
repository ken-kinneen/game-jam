import {
  ArcRotateCamera,
  Color4,
  Engine,
  HemisphericLight,
  LoadAssetContainerAsync,
  Vector3,
  Scene,
  type AbstractMesh,
  type TransformNode,
} from '@babylonjs/core';
import { assetStore } from '../rendering/AssetStore';
import { ensureBabylonLoaders } from '../entities/ModelAnimator';

/** Tiny Babylon viewport that shows the player GLB spinning in the shop sidebar. */
export class ShopCharacterPreview {
  private engine: Engine | null = null;
  private scene: Scene | null = null;
  private disposed = false;
  private onResize: (() => void) | null = null;

  /** Mount preview into a host element (async GLB load into this viewport's scene). */
  async mount(host: HTMLElement): Promise<void> {
    const url = assetStore.getModelUrl('models/player_walk');
    if (!url) {
      this.mountFallback(host);
      return;
    }

    const canvas = document.createElement('canvas');
    host.appendChild(canvas);

    ensureBabylonLoaders();
    this.engine = new Engine(canvas, true, { adaptToDeviceRatio: true });
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.05, 0.04, 0.035, 1);

    const camera = new ArcRotateCamera(
      'shopCam',
      -Math.PI / 2.4,
      1.15,
      4.2,
      new Vector3(0, 1.0, 0),
      this.scene,
    );
    camera.lowerRadiusLimit = camera.upperRadiusLimit = camera.radius;
    camera.attachControl(canvas, false);
    camera.inputs.clear();

    const light = new HemisphericLight('shopHemi', new Vector3(0.3, 1, 0.2), this.scene);
    light.intensity = 1.6;

    try {
      const options = url.startsWith('blob:') ? { pluginExtension: '.glb' } : undefined;
      const container = await LoadAssetContainerAsync(url, this.scene, options);
      if (this.disposed) {
        container.dispose();
        return;
      }
      const entries = container.instantiateModelsToScene((n) => `shop_${n}`, false, {
        doNotInstantiate: true,
      });
      const root = entries.rootNodes[0] as AbstractMesh | TransformNode | undefined;
      if (!root) throw new Error('no root');
      root.rotationQuaternion = null;
      root.computeWorldMatrix(true);
      const bi = root.getHierarchyBoundingVectors(true);
      const sizeY = Math.max(0.001, bi.max.y - bi.min.y);
      root.scaling.setAll(2.0 / sizeY);
      root.computeWorldMatrix(true);
      const bi2 = root.getHierarchyBoundingVectors(true);
      root.position.set(0, -bi2.min.y, 0);
      for (const g of entries.animationGroups) {
        g.stop();
        g.reset();
      }
    } catch (err) {
      console.warn('[ShopCharacterPreview] load failed', err);
      this.dispose();
      host.replaceChildren();
      this.mountFallback(host);
      return;
    }

    this.engine.runRenderLoop(() => {
      if (!this.scene || !this.engine) return;
      camera.alpha += 0.006;
      this.scene.render();
    });

    this.onResize = () => this.engine?.resize();
    window.addEventListener('resize', this.onResize);
    this.engine.resize();
  }

  /** Tear down the preview engine. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.onResize) window.removeEventListener('resize', this.onResize);
    this.engine?.stopRenderLoop();
    this.scene?.dispose();
    this.engine?.dispose();
    this.scene = null;
    this.engine = null;
  }

  private mountFallback(host: HTMLElement): void {
    const img = document.createElement('img');
    img.className = 'shop-char-fallback';
    img.src = '/mods/core/assets/sprites/player/walk.png';
    img.alt = 'Player';
    host.appendChild(img);
  }
}
