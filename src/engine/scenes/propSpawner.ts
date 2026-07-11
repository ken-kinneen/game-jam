import type { Entity } from '../entities/Entity';
import type { SceneDef } from '../schemas/scene.schema';

export type PropShadow = { shadow: Phaser.GameObjects.Image; source: Phaser.GameObjects.Image };

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
): PropShadow[] {
  const propShadows: PropShadow[] = [];
  const props = sceneDef?.props ?? [];

  for (const prop of props) {
    const pos = prop.position;

    if (!scene.textures.exists(prop.image)) {
      console.warn(`Prop image "${prop.image}" not found, skipping`);
      continue;
    }

    const tex = scene.textures.get(prop.image);
    const srcHeight = tex.getSourceImage().height;
    const scale = prop.height ? prop.height / srcHeight : prop.scale;

    let visual: Phaser.GameObjects.Image | undefined;

    if (prop.collides) {
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

    if (prop.fx && prop.fx.length > 0 && visual?.preFX) {
      applyPropFx(visual, prop.fx);
    }

    if (prop.action) {
      onPropAction(prop, visual);
    }
  }

  return propShadows;
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
