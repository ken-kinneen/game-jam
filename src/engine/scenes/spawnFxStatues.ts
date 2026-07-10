/** Spawns labeled "statue" sprites with every Phaser 3 built-in FX applied. */
export function spawnFxStatues(scene: Phaser.Scene): void {
  const textureKey = scene.textures.exists('player/idle') ? 'player/idle' : '__WHITE';

  const statues: { name: string; apply: (s: Phaser.GameObjects.Sprite) => void }[] = [
    {
      name: 'Barrel',
      apply: (s) => {
        s.preFX?.setPadding(8);
        s.preFX?.addBarrel(1.5);
      },
    },
    {
      name: 'Bloom',
      apply: (s) => {
        s.preFX?.addBloom(0xffffff, 1, 1, 1, 1.5, 4);
      },
    },
    {
      name: 'Blur',
      apply: (s) => {
        s.preFX?.addBlur(1, 2, 2, 1, 0xffffff, 6);
      },
    },
    {
      name: 'Bokeh',
      apply: (s) => {
        s.preFX?.addBokeh(0.5, 1, 0.2);
      },
    },
    {
      name: 'Circle',
      apply: (s) => {
        s.preFX?.addCircle(8, 0x44aaff, 0x111122, 1, 0.005);
      },
    },
    {
      name: 'Grayscale',
      apply: (s) => {
        s.preFX?.addColorMatrix().grayscale(1, false);
      },
    },
    {
      name: 'Sepia',
      apply: (s) => {
        s.preFX?.addColorMatrix().sepia(false);
      },
    },
    {
      name: 'Negative',
      apply: (s) => {
        s.preFX?.addColorMatrix().negative(false);
      },
    },
    {
      name: 'LSD',
      apply: (s) => {
        s.preFX?.addColorMatrix().lsd(false);
      },
    },
    {
      name: 'Kodachrome',
      apply: (s) => {
        s.preFX?.addColorMatrix().kodachrome(false);
      },
    },
    {
      name: 'Glow',
      apply: (s) => {
        s.preFX?.setPadding(12);
        s.preFX?.addGlow(0x00ff88, 4, 0, false);
      },
    },
    {
      name: 'Gradient',
      apply: (s) => {
        s.preFX?.addGradient(0xff0000, 0x0000ff, 0.4, 0, 0, 0, 1, 0);
      },
    },
    {
      name: 'Pixelate',
      apply: (s) => {
        s.preFX?.addPixelate(8);
      },
    },
    {
      name: 'Shadow',
      apply: (s) => {
        s.preFX?.setPadding(10);
        s.preFX?.addShadow(3, 3, 0.1, 1, 0x000000, 6, 1);
      },
    },
    {
      name: 'Shine',
      apply: (s) => {
        s.preFX?.addShine(0.5, 0.5, 3, false);
      },
    },
    {
      name: 'Vignette',
      apply: (s) => {
        s.preFX?.addVignette(0.5, 0.5, 0.5, 0.5);
      },
    },
    {
      name: 'Wipe',
      apply: (s) => {
        const wipe = s.preFX?.addWipe(0.1, 0, 0);
        if (wipe) {
          scene.tweens.add({
            targets: wipe,
            progress: 1,
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });
        }
      },
    },
    {
      name: 'Reveal',
      apply: (s) => {
        const reveal = s.preFX?.addReveal(0.1, 0, 0);
        if (reveal) {
          scene.tweens.add({
            targets: reveal,
            progress: 1,
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });
        }
      },
    },
  ];

  const cols = 6;
  const rows = Math.ceil(statues.length / cols);
  const startX = 80;
  const endX = 690;
  const startY = 120;
  const endY = 500;
  const colSpacing = (endX - startX) / (cols - 1);
  const rowSpacing = (endY - startY) / Math.max(rows - 1, 1);

  const labelStyle: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: '"Courier New", monospace',
    fontSize: '11px',
    color: '#aaccee',
    stroke: '#000000',
    strokeThickness: 2,
    align: 'center',
  };

  for (let i = 0; i < statues.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = startX + col * colSpacing;
    const y = startY + row * rowSpacing;

    const pedestal = scene.add.graphics();
    pedestal.fillStyle(0x222233, 1);
    pedestal.fillRoundedRect(x - 22, y + 20, 44, 10, 3);
    pedestal.setDepth(4);

    const sprite = scene.add.sprite(x, y, textureKey);
    sprite.setScale(2);
    sprite.setDepth(5);

    statues[i].apply(sprite);

    const label = scene.add.text(x, y + 36, statues[i].name, labelStyle);
    label.setOrigin(0.5, 0);
    label.setDepth(10);
  }

  const title = scene.add.text(384, 72, 'FX GALLERY', {
    fontFamily: '"Courier New", monospace',
    fontSize: '24px',
    color: '#88ccff',
    stroke: '#000000',
    strokeThickness: 3,
    align: 'center',
  });
  title.setOrigin(0.5, 0.5);
  title.setDepth(100);
}
