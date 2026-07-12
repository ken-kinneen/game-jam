/** Cache name — bump to drop stale offline copies after a breaking asset change. */
const CACHE_NAME = 'trashed-mod-assets-v1';

/**
 * Persists mod binaries (GLB, PNG, audio) in the Cache API so reloads skip
 * re-downloading. First visit is network; later visits are cache-first with
 * background revalidation when the server sends a different ETag.
 */
export class AssetCache {
  private readonly blobUrls = new Map<string, string>();
  private readonly inflight = new Map<string, Promise<string>>();
  private readonly supported =
    typeof caches !== 'undefined' && typeof URL.createObjectURL === 'function';

  /**
   * Resolve a public asset path to a same-session blob: URL backed by Cache API.
   * Concurrent callers for the same path share one fetch.
   */
  resolveUrl(url: string): Promise<string> {
    const existing = this.blobUrls.get(url);
    if (existing) return Promise.resolve(existing);

    let pending = this.inflight.get(url);
    if (!pending) {
      pending = this.load(url).finally(() => this.inflight.delete(url));
      this.inflight.set(url, pending);
    }
    return pending;
  }

  /** Drop in-memory blob URLs (Cache API entries remain for the next session). */
  disposeSession(): void {
    for (const blobUrl of this.blobUrls.values()) {
      URL.revokeObjectURL(blobUrl);
    }
    this.blobUrls.clear();
  }

  private async load(url: string): Promise<string> {
    if (!this.supported) return url;

    try {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(url);

      if (cached) {
        void this.revalidate(cache, url, cached);
        return this.toBlobUrl(url, cached);
      }

      const fresh = await fetch(url);
      if (!fresh.ok) {
        console.warn(`[AssetCache] fetch failed ${fresh.status} ${url}`);
        return url;
      }
      await cache.put(url, fresh.clone());
      return this.toBlobUrl(url, fresh);
    } catch (err) {
      console.warn('[AssetCache] falling back to network URL', url, err);
      return url;
    }
  }

  private async revalidate(cache: Cache, url: string, cached: Response): Promise<void> {
    try {
      const etag = cached.headers.get('ETag');
      const headers: HeadersInit = {};
      if (etag) headers['If-None-Match'] = etag;

      const res = await fetch(url, { headers });
      if (res.status === 304) return;
      if (!res.ok) return;

      await cache.put(url, res.clone());
      // Next session (or next resolve after dispose) picks up the new bytes.
      // Avoid swapping live GPU textures mid-frame.
    } catch {
      // Offline / transient — keep serving the cached copy.
    }
  }

  private async toBlobUrl(url: string, response: Response): Promise<string> {
    const memo = this.blobUrls.get(url);
    if (memo) return memo;

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    this.blobUrls.set(url, blobUrl);
    return blobUrl;
  }
}

/** Shared cache used by boot loading. */
export const assetCache = new AssetCache();
