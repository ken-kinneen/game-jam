/**
 * Plays a full-screen DOM video overlay, resolving when finished or skipped.
 */
export function playCutscene(videoSrc: string): Promise<void> {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.style.cssText =
      'position:fixed;inset:0;z-index:9999;background:#000;display:flex;align-items:center;justify-content:center;';

    const video = document.createElement('video');
    video.src = `/${videoSrc}`;
    video.style.cssText = 'max-width:100%;max-height:100%;';
    video.autoplay = true;
    video.playsInline = true;

    const done = () => {
      window.removeEventListener('keydown', onKey);
      wrap.remove();
      resolve();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Escape') done();
    };

    wrap.addEventListener('click', done);
    window.addEventListener('keydown', onKey);
    video.addEventListener('ended', done);
    video.addEventListener('error', done);

    wrap.appendChild(video);
    document.body.appendChild(wrap);
    void video.play().catch(() => done());
  });
}
