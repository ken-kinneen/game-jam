import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';

export interface Prop3DConfig {
  /** Model URL, or omit to use a procedural shape */
  modelUrl?: string;
  /** Procedural shape fallback (if no modelUrl) */
  shape?: 'table' | 'box' | 'cylinder';
  /** Render resolution */
  size?: number;
  /** Base color for procedural shapes */
  color?: number;
}

/**
 * Renders a single 3D prop to a canvas texture with dynamic lighting
 * that follows the player's lamp position. This gives props real-time
 * shadow rotation and depth cues that flat sprites cannot achieve.
 */
export class PropRenderer3D {
  private threeScene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private renderer: THREE.WebGLRenderer;
  private canvas: HTMLCanvasElement;
  private outputCanvas: HTMLCanvasElement;
  private outputCtx: CanvasRenderingContext2D;
  private lampLight: THREE.DirectionalLight;
  private model: THREE.Object3D | null = null;
  private phaserTextureKey: string;
  private phaserScene: Phaser.Scene;
  private size: number;
  private needsRender = true;
  private linkedSprites: Phaser.GameObjects.Image[] = [];

  constructor(
    phaserScene: Phaser.Scene,
    private propId: string,
    config: Prop3DConfig = {},
  ) {
    this.phaserScene = phaserScene;
    this.size = config.size ?? 96;
    this.phaserTextureKey = `__prop3d_${propId}_${Date.now()}`;

    this.canvas = document.createElement('canvas');
    this.canvas.width = this.size;
    this.canvas.height = this.size;

    this.outputCanvas = document.createElement('canvas');
    this.outputCanvas.width = this.size;
    this.outputCanvas.height = this.size;
    this.outputCtx = this.outputCanvas.getContext('2d')!;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setSize(this.size, this.size);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.threeScene = new THREE.Scene();

    // Top-down orthographic camera
    const frustum = 1.5;
    this.camera = new THREE.OrthographicCamera(-frustum, frustum, frustum, -frustum, 0.1, 50);
    this.camera.position.set(0, 8, 0);
    this.camera.lookAt(0, 0, 0);
    this.camera.up.set(0, 0, -1);

    // Ambient light (dim, simulating dark underground)
    const ambient = new THREE.AmbientLight(0xffc864, 0.2);
    this.threeScene.add(ambient);

    // Dynamic lamp light — position updated each frame based on player lamp
    this.lampLight = new THREE.DirectionalLight(0xffd090, 1.5);
    this.lampLight.position.set(2, 4, -2);
    this.lampLight.castShadow = true;
    this.lampLight.shadow.mapSize.set(256, 256);
    this.lampLight.shadow.camera.near = 0.1;
    this.lampLight.shadow.camera.far = 20;
    this.lampLight.shadow.camera.left = -3;
    this.lampLight.shadow.camera.right = 3;
    this.lampLight.shadow.camera.top = 3;
    this.lampLight.shadow.camera.bottom = -3;
    this.threeScene.add(this.lampLight);
    this.threeScene.add(this.lampLight.target);

    // Shadow-receiving ground plane
    const groundGeo = new THREE.PlaneGeometry(6, 6);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.4 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    this.threeScene.add(ground);

    // Register texture immediately so Phaser has a valid key
    this.registerTexture();

    // Build the prop
    if (config.modelUrl) {
      this.loadModel(config.modelUrl);
    } else {
      this.buildProceduralProp(config.shape ?? 'table', config.color ?? 0x8b6914);
    }
  }

  private buildProceduralProp(shape: string, color: number): void {
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.8,
      metalness: 0.1,
    });

    const group = new THREE.Group();

    if (shape === 'table') {
      // Table top
      const topGeo = new THREE.BoxGeometry(1.6, 0.08, 0.9);
      const top = new THREE.Mesh(topGeo, material);
      top.position.y = 0.6;
      top.castShadow = true;
      top.receiveShadow = true;
      group.add(top);

      // Legs
      const legGeo = new THREE.BoxGeometry(0.08, 0.6, 0.08);
      const legMat = new THREE.MeshStandardMaterial({
        color: color * 0.7,
        roughness: 0.9,
        metalness: 0.05,
      });
      const offsets = [
        [-0.7, -0.35],
        [0.7, -0.35],
        [-0.7, 0.35],
        [0.7, 0.35],
      ];
      for (const [x, z] of offsets) {
        const leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(x, 0.3, z);
        leg.castShadow = true;
        group.add(leg);
      }
    } else if (shape === 'cylinder') {
      const geo = new THREE.CylinderGeometry(0.4, 0.4, 0.8, 16);
      const mesh = new THREE.Mesh(geo, material);
      mesh.position.y = 0.4;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    } else {
      // Generic box
      const geo = new THREE.BoxGeometry(1, 0.8, 0.6);
      const mesh = new THREE.Mesh(geo, material);
      mesh.position.y = 0.4;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }

    this.model = group;
    this.threeScene.add(group);
    this.registerTexture();
  }

  async loadModel(url: string): Promise<void> {
    try {
      const isFBX = url.toLowerCase().endsWith('.fbx');
      let scene: THREE.Object3D;

      if (isFBX) {
        const loader = new FBXLoader();
        scene = await new Promise<THREE.Group>((resolve, reject) => {
          loader.load(url, resolve, undefined, reject);
        });
      } else {
        const loader = new GLTFLoader();
        const gltf = await new Promise<GLTF>((resolve, reject) => {
          loader.load(url, resolve, undefined, reject);
        });
        scene = gltf.scene;
      }

      // Debug: log bounding box before scaling
      const box = new THREE.Box3().setFromObject(scene);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      console.log(`[Prop3D] ${url} raw size:`, size, 'center:', center);

      // Auto-scale to fit the camera frustum
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim > 0) {
        scene.scale.multiplyScalar(2.0 / maxDim);
      }

      // Re-compute after scaling
      const scaledBox = new THREE.Box3().setFromObject(scene);
      const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
      const scaledSize = scaledBox.getSize(new THREE.Vector3());

      // Center horizontally, sit on ground plane
      scene.position.x -= scaledCenter.x;
      scene.position.z -= scaledCenter.z;
      scene.position.y -= scaledBox.min.y;

      console.log(`[Prop3D] ${url} scaled size:`, scaledSize);

      // Enable shadows on all meshes
      scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      this.model = scene;
      this.threeScene.add(scene);
      this.registerTexture();
      this.needsRender = true;
    } catch (err) {
      console.warn(`Failed to load 3D prop model ${url}, using fallback:`, err);
      this.buildProceduralProp('box', 0x8b6914);
    }
  }

  private registerTexture(): void {
    this.renderFrame();
    if (this.phaserScene.textures.exists(this.phaserTextureKey)) {
      this.phaserScene.textures.remove(this.phaserTextureKey);
    }
    this.phaserScene.textures.addCanvas(this.phaserTextureKey, this.outputCanvas);
  }

  /**
   * Update lamp direction based on the lamp's world position relative to this prop.
   * Call each frame with the prop's position and the lamp's position.
   */
  updateLampPosition(propX: number, propY: number, lampX: number, lampY: number): void {
    // Convert 2D game coordinates to 3D light direction
    // In our top-down view: game X = 3D X, game Y = 3D Z
    const dx = lampX - propX;
    const dy = lampY - propY;
    const dist = Math.hypot(dx, dy) || 1;

    // Normalize and position light from lamp direction, elevated
    const nx = (dx / dist) * 3;
    const nz = (dy / dist) * 3;

    const newX = nx;
    const newZ = nz;

    // Only re-render if light moved meaningfully
    const prevPos = this.lampLight.position;
    if (Math.abs(prevPos.x - newX) > 0.05 || Math.abs(prevPos.z - newZ) > 0.05) {
      this.lampLight.position.set(newX, 4, newZ);
      this.lampLight.target.position.set(0, 0, 0);

      // Intensity falls off with distance
      const intensity = Math.max(0.3, 1.5 - dist * 0.003);
      this.lampLight.intensity = intensity;

      this.needsRender = true;
    }

    if (this.needsRender) {
      this.renderFrame();
      this.needsRender = false;
    }
  }

  /** Link a Phaser image so its texture is refreshed after async model loads. */
  linkSprite(img: Phaser.GameObjects.Image): void {
    this.linkedSprites.push(img);
  }

  /** Force a re-render (e.g. after model load). */
  renderFrame(): void {
    this.renderer.render(this.threeScene, this.camera);
    this.outputCtx.clearRect(0, 0, this.size, this.size);
    this.outputCtx.drawImage(this.canvas, 0, 0);

    const tex = this.phaserScene.textures.get(this.phaserTextureKey) as
      Phaser.Textures.CanvasTexture | undefined;
    if (tex?.refresh) {
      tex.refresh();
    }

    // Re-apply texture to linked sprites (needed after async model load)
    for (const sprite of this.linkedSprites) {
      sprite.setTexture(this.phaserTextureKey);
    }
  }

  getTextureKey(): string {
    return this.phaserTextureKey;
  }

  getSize(): number {
    return this.size;
  }

  destroy(): void {
    this.renderer.dispose();
    this.threeScene.clear();
    if (this.phaserScene.textures.exists(this.phaserTextureKey)) {
      this.phaserScene.textures.remove(this.phaserTextureKey);
    }
  }
}
