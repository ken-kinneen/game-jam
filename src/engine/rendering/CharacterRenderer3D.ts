import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

export interface CharacterAnimations {
  idle?: string;
  walk?: string;
  interact?: string;
  carry?: string;
  death?: string;
}

const DEFAULT_ANIMS: CharacterAnimations = {
  idle: 'idle',
  walk: 'walk',
  interact: 'interact',
  carry: 'carry',
  death: 'death',
};

/**
 * Renders a 3D GLB character model into an off-screen canvas that Phaser
 * can use as a dynamic texture. The 3D model is viewed from a fixed
 * top-down orthographic camera, matching the game's 2D perspective.
 *
 * Usage:
 *   const renderer = new CharacterRenderer3D(phaserScene, 128, 128);
 *   await renderer.load('/assets/character.glb');
 *   // In update loop:
 *   renderer.update(dt, velocityX, velocityY, facingAngle);
 *   // The Phaser sprite texture auto-updates.
 */
export class CharacterRenderer3D {
  private threeScene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private renderer: THREE.WebGLRenderer;
  private canvas: HTMLCanvasElement;
  private mixer: THREE.AnimationMixer | null = null;
  private clips = new Map<string, THREE.AnimationClip>();
  private activeAction: THREE.AnimationAction | null = null;
  private activeClipName = '';
  private model: THREE.Group | null = null;
  private animNames: CharacterAnimations;
  private phaserTextureKey: string;
  private phaserScene: Phaser.Scene;
  private modelRotationY = 0;
  private targetRotationY = 0;
  private outputCanvas: HTMLCanvasElement;
  private outputCtx: CanvasRenderingContext2D;

  constructor(
    phaserScene: Phaser.Scene,
    private width = 128,
    private height = 128,
    animNames?: Partial<CharacterAnimations>,
  ) {
    this.phaserScene = phaserScene;
    this.animNames = { ...DEFAULT_ANIMS, ...animNames };
    this.phaserTextureKey = '__char3d_' + Date.now();

    // WebGL canvas for Three.js rendering
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;

    // Separate 2D canvas for Phaser texture (Phaser needs getContext('2d'))
    this.outputCanvas = document.createElement('canvas');
    this.outputCanvas.width = width;
    this.outputCanvas.height = height;
    this.outputCtx = this.outputCanvas.getContext('2d')!;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.threeScene = new THREE.Scene();

    // Top-down orthographic camera looking straight down
    const frustum = 1.2;
    this.camera = new THREE.OrthographicCamera(-frustum, frustum, frustum, -frustum, 0.1, 100);
    this.camera.position.set(0, 5, 0);
    this.camera.lookAt(0, 0, 0);
    this.camera.up.set(0, 0, -1);

    this.setupLighting();
  }

  private setupLighting(): void {
    // Soft ambient to prevent pure black areas
    const ambient = new THREE.AmbientLight(0xffc864, 0.6);
    this.threeScene.add(ambient);

    // Main lamp light from above-front (simulates the held lamp)
    const lampLight = new THREE.DirectionalLight(0xffd090, 1.2);
    lampLight.position.set(0, 4, -1);
    lampLight.castShadow = false;
    this.threeScene.add(lampLight);

    // Subtle fill from behind to define edges
    const rimLight = new THREE.DirectionalLight(0x8090b0, 0.3);
    rimLight.position.set(0, 3, 2);
    this.threeScene.add(rimLight);
  }

  /**
   * Load one or more model files. Pass a single URL or an array of
   * {url, name} pairs for multi-file Mixamo exports (one animation per file).
   * The first file's mesh is used; subsequent files contribute only animations.
   */
  async load(source: string | { url: string; name: string }[]): Promise<void> {
    const files = typeof source === 'string' ? [{ url: source, name: '' }] : source;

    let modelScene: THREE.Object3D | null = null;
    const allClips: { name: string; clip: THREE.AnimationClip }[] = [];

    for (const file of files) {
      const isFBX = file.url.toLowerCase().endsWith('.fbx');
      const result = isFBX ? await this.loadFBX(file.url) : await this.loadGLB(file.url);

      if (!modelScene) {
        modelScene = result.scene;
      }

      for (const clip of result.animations) {
        // Use the explicit name if provided, otherwise derive from clip/filename
        const clipName =
          file.name ||
          clip.name
            .toLowerCase()
            .replace(/mixamo\.com/i, '')
            .trim() ||
          file.url
            .split('/')
            .pop()
            ?.replace(/\.\w+$/, '')
            .toLowerCase() ||
          'unknown';

        this.stripRootMotion(clip);
        allClips.push({ name: clipName, clip });
      }
    }

    if (!modelScene) throw new Error('No model loaded');
    this.setupModel(modelScene, allClips);
  }

  private loadGLB(
    url: string,
  ): Promise<{ scene: THREE.Object3D; animations: THREE.AnimationClip[] }> {
    const loader = new GLTFLoader();
    return new Promise((resolve, reject) => {
      loader.load(
        url,
        (gltf: GLTF) => resolve({ scene: gltf.scene, animations: gltf.animations }),
        undefined,
        (error) => reject(error),
      );
    });
  }

  private loadFBX(
    url: string,
  ): Promise<{ scene: THREE.Object3D; animations: THREE.AnimationClip[] }> {
    const loader = new FBXLoader();
    return new Promise((resolve, reject) => {
      loader.load(
        url,
        (fbxGroup: THREE.Group) => resolve({ scene: fbxGroup, animations: fbxGroup.animations }),
        undefined,
        (error) => reject(error),
      );
    });
  }

  /**
   * Strip root motion (position tracks on the root bone) so the model
   * stays centered. Mixamo walk animations move the skeleton forward —
   * we want the game's physics to handle actual movement.
   */
  private stripRootMotion(clip: THREE.AnimationClip): void {
    for (const track of clip.tracks) {
      const isHipPos =
        track.name.includes('Hips.position') || track.name.includes('mixamorigHips.position');

      if (isHipPos && track instanceof THREE.VectorKeyframeTrack) {
        const values = track.values;
        for (let i = 0; i < values.length; i += 3) {
          values[i] = 0; // X
          values[i + 2] = 0; // Z
        }
      }
    }
  }

  private setupModel(
    scene: THREE.Object3D,
    allClips: { name: string; clip: THREE.AnimationClip }[],
  ): void {
    this.model = new THREE.Group();
    this.model.add(scene);

    // Auto-scale model to fit camera frustum
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.z);
    if (maxDim > 0) {
      const targetSize = 1.6;
      const scale = targetSize / maxDim;
      scene.scale.multiplyScalar(scale);
    }

    // Center the model
    const centeredBox = new THREE.Box3().setFromObject(scene);
    const center = centeredBox.getCenter(new THREE.Vector3());
    scene.position.sub(center);
    scene.position.y += centeredBox.getSize(new THREE.Vector3()).y / 2;

    this.threeScene.add(this.model);

    // Set up animation mixer on the scene root
    this.mixer = new THREE.AnimationMixer(scene);

    // Register clips
    for (const { name, clip } of allClips) {
      this.clips.set(name.toLowerCase(), clip);
    }

    console.log('3D model clips:', Array.from(this.clips.keys()));

    // Register the 2D output canvas as a Phaser texture
    if (this.phaserScene.textures.exists(this.phaserTextureKey)) {
      this.phaserScene.textures.remove(this.phaserTextureKey);
    }
    this.phaserScene.textures.addCanvas(this.phaserTextureKey, this.outputCanvas);

    // Start with idle
    this.playAnimation('idle');
    this.renderFrame();
  }

  /**
   * Play a named animation state. Crossfades from current animation.
   */
  playAnimation(state: keyof CharacterAnimations): void {
    if (!this.mixer) return;

    const desiredName = this.animNames[state];
    if (!desiredName || desiredName === this.activeClipName) return;

    const clip = this.findClip(desiredName);
    if (!clip) return;

    const newAction = this.mixer.clipAction(clip);
    newAction.setLoop(state === 'death' ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    if (state === 'death') newAction.clampWhenFinished = true;

    if (this.activeAction) {
      newAction.reset();
      newAction.play();
      this.activeAction.crossFadeTo(newAction, 0.2, true);
    } else {
      newAction.play();
    }

    this.activeAction = newAction;
    this.activeClipName = desiredName;
  }

  /**
   * Update each frame. Advances animation, rotates model to face movement
   * direction, and re-renders to the canvas texture.
   */
  update(dt: number, velocityX: number, velocityY: number): void {
    if (!this.model || !this.mixer) return;

    // Determine animation state from velocity
    const speed = Math.hypot(velocityX, velocityY);
    const isMoving = speed > 4;

    if (isMoving) {
      this.playAnimation('walk');
      // Calculate facing angle from velocity (top-down: -Y is "up"/forward)
      this.targetRotationY = Math.atan2(-velocityX, -velocityY);
    } else {
      this.playAnimation('idle');
    }

    // Smoothly rotate model to face direction (+ PI to correct Mixamo facing)
    this.modelRotationY = lerpAngle(this.modelRotationY, this.targetRotationY, 8 * dt);
    this.model.rotation.y = this.modelRotationY + Math.PI;

    // Advance animation
    this.mixer.update(dt);

    this.renderFrame();
  }

  /** Force a specific facing angle (radians). */
  setFacing(angle: number): void {
    this.targetRotationY = angle;
  }

  /** Trigger interact animation, returns to idle/walk when done. */
  triggerInteract(): void {
    this.playAnimation('interact');
  }

  /** Get the Phaser texture key for this renderer's output. */
  getTextureKey(): string {
    return this.phaserTextureKey;
  }

  /** Check if a model is loaded and ready. */
  isReady(): boolean {
    return this.model !== null;
  }

  /** List all discovered animation clip names (for debugging). */
  getAvailableClips(): string[] {
    return Array.from(this.clips.keys());
  }

  /** Clean up Three.js resources. */
  destroy(): void {
    this.mixer?.stopAllAction();
    this.renderer.dispose();
    this.threeScene.clear();
    if (this.phaserScene.textures.exists(this.phaserTextureKey)) {
      this.phaserScene.textures.remove(this.phaserTextureKey);
    }
  }

  private renderFrame(): void {
    this.renderer.render(this.threeScene, this.camera);

    // Copy WebGL canvas to 2D canvas so Phaser can read it
    this.outputCtx.clearRect(0, 0, this.width, this.height);
    this.outputCtx.drawImage(this.canvas, 0, 0);

    // Update the Phaser texture
    const tex = this.phaserScene.textures.get(this.phaserTextureKey) as
      Phaser.Textures.CanvasTexture | undefined;
    if (tex?.refresh) {
      tex.refresh();
    }
  }

  /** Find an animation clip by name, trying exact then fuzzy match. */
  private findClip(name: string): THREE.AnimationClip | null {
    const lower = name.toLowerCase();

    // Exact match
    if (this.clips.has(lower)) return this.clips.get(lower)!;

    // Fuzzy: find clip whose name contains the search term
    for (const [clipName, clip] of this.clips) {
      if (clipName.includes(lower)) return clip;
    }

    // Fallback: first clip
    if (this.clips.size > 0) {
      return this.clips.values().next().value ?? null;
    }

    return null;
  }
}

/** Interpolate between two angles (handles wrap-around). */
function lerpAngle(current: number, target: number, rate: number): number {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * Math.min(rate, 1);
}
