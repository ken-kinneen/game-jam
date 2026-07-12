# asset-cache

**Added:** 2026-07-12  
**Packages:** none (browser Cache API)  
**Purpose:** Persist mod binaries (GLB / PNG / audio) across reloads so the second boot does not re-download ~30MB+ of assets.

## Why

Boot loads every manifest entry up front. Models alone are ~3MB each; furniture
sprites add tens of MB. Without persistence, every refresh pays full network cost
(especially painful in Vite dev where `/mods/*` had no caching headers).

## Approach

- `AssetCache` stores successful fetches in `caches.open('trashed-mod-assets-v1')`
- Cache-first: hit → blob URL immediately; miss → fetch, put, blob URL
- Background revalidation with `If-None-Match` against Vite `serve-mods` ETags
- Bump `CACHE_NAME` if a breaking wipe is needed

## Alternatives considered

- **Service worker / vite-plugin-pwa** — heavier; fine later for offline installs
- **IndexedDB only** — more code for the same binary persistence
- **HTTP Cache-Control alone** — helps, but Cache API gives explicit control and works when heuristics are aggressive about revalidation
