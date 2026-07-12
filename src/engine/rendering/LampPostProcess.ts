import { PostProcess, Effect, Vector3, type Scene, type Camera } from '@babylonjs/core';

const SHADER_NAME = 'lampDarkness';

const FRAGMENT_SOURCE = `precision highp float;
in vec2 vUV;
uniform sampler2D textureSampler;
uniform vec3 lampScreenPos;
uniform float radiusInner;
uniform float radiusFade;
uniform float aspectRatio;
uniform vec3 lampTint;
layout(location = 0) out vec4 fragColor;

void main(void) {
  vec4 color = texture(textureSampler, vUV);
  vec2 delta = vUV - lampScreenPos.xy;
  delta.x *= aspectRatio;
  float dist = length(delta);
  float darkness = smoothstep(radiusInner, radiusInner + radiusFade, dist);
  vec3 warm = color.rgb * (1.0 + lampTint * 0.25 * (1.0 - darkness));
  vec3 result = mix(warm, vec3(0.005, 0.005, 0.01), darkness * 0.97);
  fragColor = vec4(result, color.a);
}
`;

/**
 * Full-screen post-process that blacks out everything outside a circular
 * lamp radius centred on the player. Inside the circle the scene renders
 * normally with a subtle warm tint; outside fades to near-black.
 */
export class LampPostProcess {
  private pp: PostProcess;
  private lampWorld = Vector3.Zero();
  private inner = 0.2;
  private fade = 0.12;
  private tint = new Vector3(1.0, 0.85, 0.55);

  constructor(
    private scene: Scene,
    camera: Camera,
  ) {
    // Babylon looks up `<name>FragmentShader` in ShadersStore
    Effect.ShadersStore[`${SHADER_NAME}FragmentShader`] = FRAGMENT_SOURCE;

    this.pp = new PostProcess(
      'lampDarkness',
      SHADER_NAME,
      ['lampScreenPos', 'radiusInner', 'radiusFade', 'aspectRatio', 'lampTint'],
      null,
      1.0,
      camera,
    );

    this.pp.onApply = (effect) => {
      const engine = this.scene.getEngine();
      const w = engine.getRenderWidth();
      const h = engine.getRenderHeight();
      const projected = Vector3.Project(
        this.lampWorld,
        this.scene.getTransformMatrix(),
        this.scene.getProjectionMatrix(),
        camera.viewport.toGlobal(w, h),
      );
      const sx = projected.x / w;
      const sy = 1.0 - projected.y / h;
      effect.setVector3('lampScreenPos', new Vector3(sx, sy, 0));
      effect.setFloat('radiusInner', this.inner);
      effect.setFloat('radiusFade', this.fade);
      effect.setFloat('aspectRatio', w / h);
      effect.setVector3('lampTint', this.tint);
    };
  }

  /** Update each frame with the player world pos and lamp radius in screen UV units. */
  update(worldX: number, worldY: number, worldZ: number, radiusUV: number): void {
    this.lampWorld.set(worldX, worldY, worldZ);
    this.inner = Math.max(0.02, radiusUV);
    this.fade = radiusUV * 0.45;
  }

  /** Set the warm tint colour (matches lamp colour upgrades). */
  setTint(r: number, g: number, b: number): void {
    this.tint.set(r, g, b);
  }

  dispose(): void {
    this.pp.dispose();
  }
}
