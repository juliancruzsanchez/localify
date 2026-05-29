import { useEffect, useState } from "react";
import { useArtworkUrl } from "./useArtworkUrl";

/** Extracts the dominant (saturated) color from an album art data URL via Canvas,
 *  darkens it, and returns an rgb() string suitable for use as a background. */
async function extractColor(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const SIZE = 64;
        canvas.width = canvas.height = SIZE;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve("#1a1a1a"); return; }
        ctx.drawImage(img, 0, 0, SIZE, SIZE);
        const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

        let rAcc = 0, gAcc = 0, bAcc = 0, wAcc = 0;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2];
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const sat = max === 0 ? 0 : (max - min) / max;
          const w = 1 + sat * 4;
          rAcc += r * w; gAcc += g * w; bAcc += b * w; wAcc += w;
        }

        const r = Math.round((rAcc / wAcc) * 0.55);
        const g = Math.round((gAcc / wAcc) * 0.55);
        const b = Math.round((bAcc / wAcc) * 0.55);
        resolve(`rgb(${r},${g},${b})`);
      } catch {
        resolve("#1a1a1a");
      }
    };
    img.onerror = () => resolve("#1a1a1a");
    img.src = dataUrl;
  });
}

export function useArtworkColor(artworkHash: string | null | undefined): string {
  const artworkUrl = useArtworkUrl(artworkHash);
  const [color, setColor] = useState("#1a1a1a");

  useEffect(() => {
    if (!artworkUrl) { setColor("#1a1a1a"); return; }
    extractColor(artworkUrl).then(setColor);
  }, [artworkUrl]);

  return color;
}
