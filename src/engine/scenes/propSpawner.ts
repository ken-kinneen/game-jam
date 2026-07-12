import type { Entity } from '../entities/Entity';
import type { SceneDef } from '../schemas/scene.schema';
import type { DepthSortSystem } from '../systems/DepthSortSystem';
import { PropRenderer3D } from '../rendering/PropRenderer3D';

export type PropShadow = { shadow: Phaser.GameObjects.Image; source: Phaser.GameObjects.Image };
export type Prop3DInstance = { renderer: PropRenderer3D; x: number; y: number };

export interface SpawnPropsOptions {
  scene: Phaser.Scene;
  sceneDef: SceneDef | undefined;
  player: Entity | undefined;
  depthSort?: DepthSortSystem;
  onPropAction: (
    prop: {
      position: { x: number; y: number };
      action?: string;
      actionTarget?: string;
      actionLabel?: string;
    },
    visual?: Phaser.GameObjects.Image,
  ) => void;
}

export interface SpawnPropsResult {
  propShadows: PropShadow[];
  props3d: Prop3DInstance[];
}

/** Spawns scene props and returns shadow pairs for lamp rendering. */
export function spawnSceneProps(
  scene: Phaser.Scene,
  sceneDef: SceneDef | undefined,
  player: Entity | undefined,
  onPropAction: (
    prop: {
      position: { x: number; y: number };
      action?: string;
      actionTarget?: string;
      actionLabel?: string;
    },
    visual?: Phaser.GameObjects.Image,
  ) => void,
  depthSort?: DepthSortSystem,
): SpawnPropsResult {
  const propShadows: PropShadow[] = [];
  const props3d: Prop3DInstance[] = [];
  const props = sceneDef?.props ?? [];

  for (const prop of props) {
    const pos = prop.position;

    // 3D rendered prop
    if (prop.render3d) {
      const config = typeof prop.render3d === 'object' ? prop.render3d : {};
      const displaySize = prop.height ?? 96;
      const renderer = new PropRenderer3D(scene, `${prop.image}_${pos.x}_${pos.y}`, {
        shape: (config as { shape?: 'table' | 'box' | 'cylinder' }).shape ?? 'table',
        color: (config as { color?: number }).color,
        modelUrl: (config as { modelUrl?: string }).modelUrl,
        size: Math.min(Math.max(displaySize, 96), 256),
      });

      const texKey = renderer.getTextureKey();
      const img = scene.add.image(pos.x, pos.y, texKey);
      img.setDisplaySize(displaySize, displaySize);
      img.setDepth(prop.depth);

      if (prop.collides && player) {
        const sprite = scene.physics.add.staticImage(pos.x, pos.y, texKey);
        sprite.setDisplaySize(displaySize, displaySize);
        sprite.setDepth(prop.depth);
        sprite.refreshBody();
        const body = sprite.body as Phaser.Physics.Arcade.StaticBody;
        const shrink = 0.6;
        body.setSize(body.width * shrink, body.height * shrink);
        body.setOffset(
          (sprite.displayWidth - body.width) / 2,
          (sprite.displayHeight - body.height) / 2,
        );
        scene.physics.add.collider(player.sprite, sprite);
        img.destroy();
        renderer.linkSprite(sprite);
        if (depthSort) depthSort.register(sprite);
      } else {
        renderer.linkSprite(img);
        if (depthSort) depthSort.register(img);
      }

      props3d.push({ renderer, x: pos.x, y: pos.y });

      if (prop.action) {
        onPropAction(prop);
      }
      continue;
    }

    if (!scene.textures.exists(prop.image)) {
      console.warn(`Prop image "${prop.image}" not found, skipping`);
      continue;
    }

    const tex = scene.textures.get(prop.image);
    const srcHeight = tex.getSourceImage().height;
    const scale = prop.height ? prop.height / srcHeight : prop.scale;

    let visual: Phaser.GameObjects.Image | undefined;

    if (prop.collides) {
      // Dynamic lamp-cast shadow (moves with lamp position)
      const shadow = scene.add.image(pos.x, pos.y, prop.image);
      shadow.setScale(scale);
      shadow.setAngle(prop.angle);
      shadow.setTint(0x000000);
      shadow.setAlpha(0.4);
      shadow.setDepth(prop.depth - 0.1);
      shadow.setOrigin(0.5, 0.5);

      const sprite = scene.physics.add.staticImage(pos.x, pos.y, prop.image);
      sprite.setScale(scale);
      sprite.setDepth(prop.depth);
      sprite.refreshBody();
      const body = sprite.body as Phaser.Physics.Arcade.StaticBody;
      const shrink = 0.7;
      body.setSize(body.width * shrink, body.height * shrink);
      body.setOffset(
        (sprite.displayWidth - body.width) / 2,
        (sprite.displayHeight - body.height) / 2,
      );
      sprite.setAngle(prop.angle);
      if (player) {
        scene.physics.add.collider(player.sprite, sprite);
      }
      visual = sprite;

      propShadows.push({ shadow, source: sprite });
    } else {
      const img = scene.add.image(pos.x, pos.y, prop.image);
      img.setScale(scale);
      img.setAngle(prop.angle);
      img.setDepth(prop.depth);
      visual = img;
    }

    // Contact shadow: soft dark ellipse at the base of the object
    if (visual) {
      addContactShadow(scene, visual, scale);
    }

    // Enable Light2D pipeline so props react to the lamp point light
    if (visual) {
      try {
        visual.setPipeline('Light2D');
      } catch {
        // Fallback: add rim-like shadow if Light2D not available
        if (visual.preFX) {
          visual.preFX.setPadding(4);
          visual.preFX.addShadow(0, 1, 0.06, 0.6, 0x000000, 4, 0.8);
        }
      }
    }

    if (prop.fx && prop.fx.length > 0 && visual?.preFX) {
      applyPropFx(visual, prop.fx);
    }

    // Register for y-sort depth ordering
    if (visual && depthSort) {
      depthSort.register(visual);
    }

    if (prop.action) {
      onPropAction(prop, visual);
    }
  }

  return { propShadows, props3d };
}

/** Adds a soft elliptical contact shadow beneath a prop sprite. */
function addContactShadow(
  scene: Phaser.Scene,
  visual: Phaser.GameObjects.Image,
  _scale: number,
): void {
  const texKey = '__contact_shadow';
  if (!scene.textures.exists(texKey)) {
    const size = 64;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size / 2;
    const ctx = c.getContext('2d')!;
    const grd = ctx.createRadialGradient(size / 2, size / 4, 0, size / 2, size / 4, size / 2);
    grd.addColorStop(0, 'rgba(0,0,0,0.5)');
    grd.addColorStop(0.5, 'rgba(0,0,0,0.25)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, size, size / 2);
    scene.textures.addCanvas(texKey, c);
  }

  const shadowW = visual.displayWidth * 0.8;
  const shadowH = shadowW * 0.3;
  const contactShadow = scene.add.image(visual.x, visual.y + visual.displayHeight * 0.4, texKey);
  contactShadow.setDisplaySize(shadowW, shadowH);
  contactShadow.setDepth(visual.depth - 0.2);
  contactShadow.setAlpha(0.6);
}

/** Applies data-driven preFX effects from the prop's fx array. */
function applyPropFx(visual: Phaser.GameObjects.Image, fxList: string[]): void {
  const fx = visual.preFX;
  if (!fx) return;

  for (const effect of fxList) {
    switch (effect) {
      case 'shine':
        fx.addShine(0.5, 0.5, 3, false);
        break;
      case 'glow':
        fx.setPadding(12);
        fx.addGlow(0x00ff88, 4, 0, false);
        break;
      case 'shadow':
        fx.setPadding(10);
        fx.addShadow(3, 3, 0.1, 1, 0x000000, 6, 1);
        break;
      case 'bloom':
        fx.addBloom(0xffffff, 1, 1, 1, 1.5, 4);
        break;
    }
  }
}
