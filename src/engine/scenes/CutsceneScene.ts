/**
 * Plays a full-screen video cutscene via a DOM <video> overlay,
 * then transitions to the next scene. Skippable with SPACE/ESC/click.
 */
export class CutsceneScene extends Phaser.Scene {
  private videoEl: HTMLVideoElement | null = null;
  private nextSceneId = 'core:home';
  private finished = false;

  constructor() {
    super({ key: 'CutsceneScene' });
  }

  init(data: { nextSceneId?: string }) {
    this.nextSceneId = data?.nextSceneId ?? 'core:home';
    this.finished = false;
  }

  create() {
    console.log('[CutsceneScene] create, next:', this.nextSceneId);

    this.cameras.main.setBackgroundColor('#000000');

    const canvas = this.game.canvas;
    const rect = canvas.getBoundingClientRect();

    const video = document.createElement('video');
    video.src = 'mods/core/assets/video/cave_exit.mp4';
    video.playsInline = true;
    video.muted = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.style.cssText = `
      position: fixed;
      top: ${rect.top}px; left: ${rect.left}px;
      width: ${rect.width}px; height: ${rect.height}px;
      object-fit: cover; z-index: 9999;
      background: #000;
      pointer-events: auto;
    `;
    document.body.appendChild(video);
    this.videoEl = video;

    video.addEventListener('ended', () => this.finishCutscene());
    video.addEventListener('error', (e) => {
      console.error('[CutsceneScene] video error:', e);
      this.finishCutscene();
    });

    video.addEventListener('click', () => this.finishCutscene());

    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Escape') {
        e.preventDefault();
        document.removeEventListener('keydown', onKey);
        this.finishCutscene();
      }
    };
    document.addEventListener('keydown', onKey);

    const playPromise = video.play();
    if (playPromise) {
      playPromise.catch((err) => {
        console.warn('[CutsceneScene] autoplay blocked:', err);
        this.finishCutscene();
      });
    }
  }

  shutdown() {
    this.cleanup();
  }

  private finishCutscene(): void {
    if (this.finished) return;
    this.finished = true;
    console.log('[CutsceneScene] finishing, going to:', this.nextSceneId);

    this.cleanup();
    this.scene.start('GameScene', { sceneId: this.nextSceneId });
  }

  private cleanup(): void {
    if (this.videoEl) {
      this.videoEl.pause();
      this.videoEl.remove();
      this.videoEl = null;
    }
  }
}
