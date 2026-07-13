/**
 * Generates a normal map from a diffuse texture using a Sobel filter.
 * The result can be used with Phaser's Light2D pipeline to give flat
 * surfaces per-pixel depth and material response to point lights.
 */

/**
 * Generate a normal map canvas from an image source.
 * Uses Sobel edge detection to derive surface normals from brightness.
 *
 * @param source  The diffuse image (HTMLImageElement, HTMLCanvasElement, etc.)
 * @param strength  How pronounced the bumps are (default 2.0)
 * @returns  A canvas containing the RGB normal map
 */
export function generateNormalMap(source: CanvasImageSource, strength = 2.0): HTMLCanvasElement {
  const srcCanvas = document.createElement('canvas');
  const w = (source as HTMLImageElement).naturalWidth ?? (source as HTMLCanvasElement).width;
  const h = (source as HTMLImageElement).naturalHeight ?? (source as HTMLCanvasElement).height;

  srcCanvas.width = w;
  srcCanvas.height = h;
  const srcCtx = srcCanvas.getContext('2d')!;
  srcCtx.drawImage(source, 0, 0);
  const srcData = srcCtx.getImageData(0, 0, w, h).data;

  const outCanvas = document.createElement('canvas');
  outCanvas.width = w;
  outCanvas.height = h;
  const outCtx = outCanvas.getContext('2d')!;
  const outImage = outCtx.createImageData(w, h);
  const out = outImage.data;

  // Convert to grayscale heightmap
  const height = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = srcData[i * 4];
    const g = srcData[i * 4 + 1];
    const b = srcData[i * 4 + 2];
    height[i] = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
  }

  // Sample with wrapping (seamless tile support)
  const sample = (x: number, y: number) => height[(((y % h) + h) % h) * w + (((x % w) + w) % w)];

  // Sobel filter to compute gradients
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tl = sample(x - 1, y - 1);
      const t = sample(x, y - 1);
      const tr = sample(x + 1, y - 1);
      const l = sample(x - 1, y);
      const r = sample(x + 1, y);
      const bl = sample(x - 1, y + 1);
      const bx = sample(x, y + 1);
      const br = sample(x + 1, y + 1);

      const dx = tr + 2 * r + br - (tl + 2 * l + bl);
      const dy = bl + 2 * bx + br - (tl + 2 * t + tr);

      // Normal vector: (-dx * strength, -dy * strength, 1), normalized
      const nx = -dx * strength;
      const ny = -dy * strength;
      const nz = 1.0;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);

      const idx = (y * w + x) * 4;
      out[idx] = ((nx / len) * 0.5 + 0.5) * 255; // R = X
      out[idx + 1] = ((ny / len) * 0.5 + 0.5) * 255; // G = Y
      out[idx + 2] = ((nz / len) * 0.5 + 0.5) * 255; // B = Z
      out[idx + 3] = 255;
    }
  }

  outCtx.putImageData(outImage, 0, 0);
  return outCanvas;
}
