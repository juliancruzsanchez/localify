import { useEffect, useRef } from "react";
import type React from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import type { VisualizerColors } from "@/hooks/useVisualizerColors";
import { DEFAULT_COLORS } from "@/hooks/useVisualizerColors";

const BAR_COUNT = 32;

export type Mode = "bars" | "alchemy" | "plasma" | "vortex" | "radial" | "synthgrid" | "tunnel" | "ocean" | "artwork" | "warp" | "hypno" | "dna" | "melt" | "nova" | "spiral" | "aurora";
export const MODES: Mode[] = ["bars", "alchemy", "plasma", "vortex", "radial", "synthgrid", "tunnel", "ocean", "artwork", "warp", "hypno", "dna", "melt", "nova", "spiral", "aurora"];
export const MODE_LABELS: Record<Mode, string> = {
  bars:      "SPECTRUM",
  alchemy:   "ALCHEMY",
  plasma:    "PLASMA STORM",
  vortex:    "VORTEX",
  radial:    "RADIAL BLOOM",
  synthgrid: "SYNTHWAVE",
  tunnel:    "TUNNEL",
  ocean:     "SOUND OCEAN",
  artwork:   "ALBUM AURA",
  warp:      "WARP DRIVE",
  hypno:     "HYPNOTIZE",
  dna:       "DNA HELIX",
  melt:      "MIND MELT",
  nova:      "NOVA BURST",
  spiral:    "SPIRAL STORM",
  aurora:    "AURORA",
};

// ─── color helpers ─────────────────────────────────────────────────────────────

function hexToHue(hex: string): number {
  if (!hex || hex.length < 7) return 0;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d === 0) return 0;
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return ((h * 60) + 360) % 360;
}

function hexToRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r
    ? ((g - b) / d + (g < b ? 6 : 0)) / 6
    : max === g ? ((b - r) / d + 2) / 6
    : ((r - g) / d + 4) / 6;
  return [h * 360, s, l];
}

function extractColors(img: HTMLImageElement): [number, number, number][] {
  const FALLBACK: [number, number, number][] = [[0, 100, 200], [140, 0, 220], [220, 80, 0]];
  try {
    const SZ  = 24;
    const c   = document.createElement("canvas");
    c.width = c.height = SZ;
    const ctx = c.getContext("2d");
    if (!ctx) return FALLBACK;
    ctx.drawImage(img, 0, 0, SZ, SZ);
    const { data } = ctx.getImageData(0, 0, SZ, SZ);

    const buckets: [number, number, number][][] = Array.from({ length: 12 }, () => []);
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      if (a < 200) continue;
      const [h, s, l] = rgbToHsl(r, g, b);
      if (l < 0.10 || l > 0.90 || s < 0.12) continue;
      buckets[Math.floor(h / 30) % 12].push([r, g, b]);
    }

    const sorted = buckets
      .map((px, i) => ({ i, count: px.length, px }))
      .filter(bk => bk.count > 0)
      .sort((a, b) => b.count - a.count);

    const result: [number, number, number][] = sorted.slice(0, 3).map(({ px }) => [
      Math.round(px.reduce((s, p) => s + p[0], 0) / px.length),
      Math.round(px.reduce((s, p) => s + p[1], 0) / px.length),
      Math.round(px.reduce((s, p) => s + p[2], 0) / px.length),
    ]);

    while (result.length < 3) result.push([80, 80, 180]);
    return result;
  } catch {
    return FALLBACK;
  }
}

interface LightningBolt { points: [number, number][]; hue: number; width: number; alpha: number; }
interface WarpStar      { x: number; y: number; z: number; speed: number; }
interface WarpRing      { radius: number; maxRadius: number; alpha: number; speed: number; }

interface Props {
  className?: string;
  style?: React.CSSProperties;
  colors?: VisualizerColors;
  artworkHash?: string | null;
  mode?: Mode;
}

export function Visualizer({ className, style, colors, artworkHash, mode }: Props) {
  const canvasRef         = useRef<HTMLCanvasElement>(null);
  const bandDataRef       = useRef<number[]>(new Array(BAR_COUNT).fill(0));
  const displayedRef      = useRef<number[]>(new Array(BAR_COUNT).fill(0));
  const peaksRef          = useRef<number[]>(new Array(BAR_COUNT).fill(0));
  const rafRef            = useRef<number>(0);
  const modeIndexRef      = useRef<number>(0);
  const alchemyTRef       = useRef<number>(0);
  const vortexAngleRef    = useRef<number>(0);
  const lightningRef      = useRef<LightningBolt[]>([]);
  const lightningTRef     = useRef<number>(0);
  const synthgridPhaseRef = useRef<number>(0);
  const tunnelPhaseRef    = useRef<number>(0);
  const tunnelAngleRef    = useRef<number>(0);
  const oceanPhaseRef     = useRef<number>(0);
  const beatRef           = useRef<{ bass: number; time: number }>({ bass: 0, time: 0 });
  const colorsRef         = useRef<VisualizerColors>(colors ?? DEFAULT_COLORS);
  // artwork mode refs
  const artworkImgRef     = useRef<HTMLImageElement | null>(null);
  const artworkBlurredRef = useRef<HTMLCanvasElement | null>(null);
  const artworkColorsRef  = useRef<[number, number, number][]>([[0, 100, 200], [140, 0, 220], [220, 80, 0]]);
  // warp / dna mode refs
  const warpStarsRef      = useRef<WarpStar[]>([]);
  const warpRingsRef      = useRef<WarpRing[]>([]);
  const dnaPhaseRef       = useRef<number>(0);
  // nova / spiral / aurora mode refs
  const novaAngleRef      = useRef<number>(0);
  const spiralAngleRef    = useRef<number>(0);
  const auroraPhaseRef    = useRef<number>(0);

  useEffect(() => { colorsRef.current = colors ?? DEFAULT_COLORS; }, [colors]);
  useEffect(() => {
    if (mode === undefined) return;
    const idx = MODES.indexOf(mode);
    if (idx !== -1) modeIndexRef.current = idx;
  }, [mode]);

  // Load artwork from embedded file data via Tauri (returns a base64 data URL).
  // Data URLs are same-origin, so canvas getImageData works without taint errors.
  useEffect(() => {
    if (!artworkHash) return;
    let cancelled = false;

    const load = async () => {
      try {
        const dataUrl = await invoke<string>("get_artwork_data_url", { hash: artworkHash });
        if (cancelled) return;

        const img = new Image();
        img.onload = () => {
          if (cancelled) return;

          artworkColorsRef.current = extractColors(img);

          // Pre-render blurred background once (not per-frame)
          const blur = document.createElement("canvas");
          blur.width = blur.height = 400;
          const bctx = blur.getContext("2d");
          if (bctx) {
            bctx.filter = "blur(28px) brightness(0.28)";
            bctx.drawImage(img, -40, -40, 480, 480);
            bctx.filter = "none";
            const vg = bctx.createRadialGradient(200, 200, 60, 200, 200, 260);
            vg.addColorStop(0, "transparent");
            vg.addColorStop(1, "rgba(0,0,0,0.65)");
            bctx.fillStyle = vg;
            bctx.fillRect(0, 0, 400, 400);
          }
          artworkBlurredRef.current = blur;
          artworkImgRef.current     = img;
        };
        img.src = dataUrl;
      } catch {
        // invoke fails in browser-preview mode (no Tauri runtime)
      }
    };

    load();

    return () => {
      cancelled = true;
      artworkImgRef.current     = null;
      artworkBlurredRef.current = null;
    };
  }, [artworkHash]);

  useEffect(() => {
    const unlistenPromise = listen<number[]>("visualizer-update", (event) => {
      const p = event.payload;
      if (Array.isArray(p) && p.length === BAR_COUNT) bandDataRef.current = p;
    });

    const canvas = canvasRef.current;
    if (!canvas) return;

    function ensureSize(ctx: CanvasRenderingContext2D): [number, number] {
      const dpr = window.devicePixelRatio || 1;
      const w   = canvas!.clientWidth;
      const h   = canvas!.clientHeight;
      const pw  = Math.round(w * dpr);
      const ph  = Math.round(h * dpr);
      if (canvas!.width !== pw || canvas!.height !== ph) {
        canvas!.width  = pw;
        canvas!.height = ph;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      return [w, h];
    }

    function beatDetect(bass: number): boolean {
      const b      = beatRef.current;
      const isBeat = bass > b.bass * 1.3 && bass > 0.35 && Date.now() - b.time > 200;
      if (bass > b.bass) { b.bass = bass; b.time = isBeat ? Date.now() : b.time; }
      else b.bass *= 0.96;
      return isBeat;
    }

    // ─── BARS ─────────────────────────────────────────────────────────────────

    function drawBars(ctx: CanvasRenderingContext2D, w: number, h: number, b: number[], c: VisualizerColors["bars"]) {
      const bass     = b[0];
      const beat     = beatDetect(bass);
      const primHue  = hexToHue(c.primary);
      const secHue   = hexToHue(c.secondary);
      const [pr, pg, pb] = hexToRgb(c.primary);

      ctx.fillStyle = beat ? "rgba(0,20,30,1)" : "#000";
      ctx.fillRect(0, 0, w, h);
      if (beat) {
        const fl = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h));
        fl.addColorStop(0, `rgba(${pr},${pg},${pb},0.22)`);
        fl.addColorStop(1, "transparent");
        ctx.fillStyle = fl;
        ctx.fillRect(0, 0, w, h);
      }

      ctx.save();
      ctx.strokeStyle = `hsla(${primHue},60%,30%,0.10)`;
      ctx.lineWidth   = 0.5;
      const gridStep  = 40;
      for (let x = 0; x < w; x += gridStep) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y < h; y += gridStep) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      ctx.restore();

      const peaks = peaksRef.current;
      const GAP   = 2;
      const bw    = (w - GAP * (BAR_COUNT - 1)) / BAR_COUNT;
      const mirH  = h * 0.22;
      const areaH = h - mirH;

      for (let i = 0; i < BAR_COUNT; i++) {
        if (b[i] > peaks[i]) peaks[i] = b[i];
        else peaks[i] = Math.max(0, peaks[i] - 0.007);

        const x    = i * (bw + GAP);
        const barH = b[i] * areaH;
        const y    = areaH - barH;

        if (barH > 1) {
          const hue = primHue + (i / BAR_COUNT) * 40;
          const g   = ctx.createLinearGradient(0, y, 0, areaH);
          g.addColorStop(0,   `hsl(${hue},100%,72%)`);
          g.addColorStop(0.3, `hsl(${hue - 10},90%,55%)`);
          g.addColorStop(1,   `hsl(${secHue + (i / BAR_COUNT) * 20},80%,30%)`);
          ctx.fillStyle  = g;
          ctx.shadowColor = `hsl(${hue},100%,60%)`;
          ctx.shadowBlur  = 10 + b[i] * 18;
          ctx.fillRect(x, y, bw, barH);
          ctx.shadowBlur  = 0;
        }

        if (peaks[i] > 0.02) {
          const peakY = areaH - peaks[i] * areaH - 2;
          ctx.shadowColor = c.peak;
          ctx.shadowBlur  = 8;
          ctx.fillStyle   = peaks[i] > 0.8 ? "#fff" : c.peak;
          ctx.fillRect(x, peakY, bw, 2);
          ctx.shadowBlur  = 0;
        }
      }

      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.translate(0, areaH * 2);
      ctx.scale(1, -1);
      for (let i = 0; i < BAR_COUNT; i++) {
        const x    = i * (bw + GAP);
        const barH = Math.min(b[i] * areaH, mirH);
        const y    = areaH - barH;
        const hue  = primHue + (i / BAR_COUNT) * 40;
        const g    = ctx.createLinearGradient(0, y, 0, areaH);
        g.addColorStop(0, `hsl(${hue},100%,72%)`);
        g.addColorStop(1, `hsl(${secHue},80%,30%)`);
        ctx.fillStyle = g;
        ctx.fillRect(x, y, bw, barH);
      }
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = 0.04;
      ctx.fillStyle   = "#000";
      for (let y = 0; y < h; y += 3) { ctx.fillRect(0, y, w, 1); }
      ctx.restore();
    }

    // ─── ALCHEMY ──────────────────────────────────────────────────────────────

    function drawAlchemy(ctx: CanvasRenderingContext2D, w: number, h: number, b: number[], c: VisualizerColors["alchemy"]) {
      ctx.fillStyle = "rgba(4, 0, 12, 0.15)";
      ctx.fillRect(0, 0, w, h);

      alchemyTRef.current += 0.008;
      const t        = alchemyTRef.current;
      const cx       = w / 2;
      const cy       = h / 2;
      const dim      = Math.min(w, h);
      const bass     = b[0];
      const high     = b[22];
      const beat     = beatDetect(bass);
      const primHue  = hexToHue(c.primary);
      const secHue   = hexToHue(c.secondary);
      const off      = (secHue - 276 + 360) % 360;

      const blobs = [
        { bx: 0.25 + Math.sin(t * 0.71) * 0.22, by: 0.38 + Math.cos(t * 0.53) * 0.20, br: 0.60, hue: (278 + off) % 360, bi: 0 },
        { bx: 0.75 + Math.sin(t * 0.43) * 0.18, by: 0.62 + Math.cos(t * 0.61) * 0.22, br: 0.54, hue: (4   + off) % 360, bi: 6 },
        { bx: 0.50 + Math.sin(t * 0.89) * 0.14, by: 0.22 + Math.cos(t * 0.73) * 0.16, br: 0.48, hue: (105 + off) % 360, bi: 12 },
        { bx: 0.15 + Math.sin(t * 0.62) * 0.11, by: 0.78 + Math.cos(t * 0.82) * 0.14, br: 0.42, hue: (32  + off) % 360, bi: 18 },
        { bx: 0.84 + Math.sin(t * 0.55) * 0.10, by: 0.32 + Math.cos(t * 0.44) * 0.19, br: 0.38, hue: (195 + off) % 360, bi: 24 },
        { bx: 0.35 + Math.sin(t * 0.33) * 0.15, by: 0.70 + Math.cos(t * 0.58) * 0.12, br: 0.34, hue: (330 + off) % 360, bi: 4 },
        { bx: 0.68 + Math.sin(t * 0.77) * 0.12, by: 0.18 + Math.cos(t * 0.39) * 0.14, br: 0.30, hue: (60  + off) % 360, bi: 20 },
      ] as const;

      ctx.save();
      ctx.globalCompositeOperation = "screen";
      for (let i = 0; i < blobs.length; i++) {
        const bl  = blobs[i];
        const bxp = bl.bx * w;
        const byp = bl.by * h;
        const brp = bl.br * dim * (0.88 + b[bl.bi] * 0.52);
        const g   = ctx.createRadialGradient(bxp, byp, 0, bxp, byp, brp);
        const lum = 24 + b[bl.bi] * 22;
        g.addColorStop(0,    `hsla(${bl.hue}, 100%, ${lum}%, 0.75)`);
        g.addColorStop(0.45, `hsla(${bl.hue}, 80%, ${lum * 0.5}%, 0.20)`);
        g.addColorStop(1,    "transparent");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
      ctx.restore();

      const ORBS = 8;
      const orbR = dim * 0.38 * (1 + bass * 0.2);
      for (let i = 0; i < ORBS; i++) {
        const angle   = (i / ORBS) * Math.PI * 2 + t * 0.6;
        const ox      = cx + Math.cos(angle) * orbR;
        const oy      = cy + Math.sin(angle) * orbR;
        const bandI   = Math.floor((i / ORBS) * BAR_COUNT);
        const orbSize = 4 + b[bandI] * 10;
        const orbHue  = (t * 60 + i * 45 + off) % 360;
        const og      = ctx.createRadialGradient(ox, oy, 0, ox, oy, orbSize);
        og.addColorStop(0, `hsla(${orbHue},100%,85%,0.9)`);
        og.addColorStop(1, "transparent");
        ctx.fillStyle = og;
        ctx.beginPath();
        ctx.arc(ox, oy, orbSize, 0, Math.PI * 2);
        ctx.fill();
      }

      const POINTS = 7;
      const outerR = dim * 0.30 * (1 + bass * 0.55);
      const innerR = outerR * 0.34;
      const rot    = t * 0.52;

      for (let layer = 0; layer < 6; layer++) {
        const scale    = 1 - layer * 0.12;
        const layerRot = rot + layer * (Math.PI / (POINTS * 2));
        const lum      = Math.floor(190 + high * 65);
        ctx.save();
        ctx.shadowBlur  = 32 - layer * 4;
        ctx.shadowColor = `hsl(${primHue},100%,55%)`;
        ctx.strokeStyle = `hsla(${primHue},90%,${lum * 0.35}%,${0.96 - layer * 0.14})`;
        ctx.lineWidth   = Math.max(0.4, 3 - layer * 0.46);
        ctx.beginPath();
        for (let i = 0; i <= POINTS * 2; i++) {
          const angle = (i / (POINTS * 2)) * Math.PI * 2 + layerRot;
          const bIdx  = Math.floor((i / (POINTS * 2)) * BAR_COUNT);
          const r     = i % 2 === 0
            ? outerR * scale * (1 + b[bIdx % BAR_COUNT] * 0.34)
            : innerR * scale;
          const px = cx + r * Math.cos(angle);
          const py = cy + r * Math.sin(angle);
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }

      if (beat) {
        for (let i = 0; i < POINTS; i++) {
          const angle = (i / POINTS) * Math.PI * 2 + rot;
          const tx    = cx + Math.cos(angle) * outerR;
          const ty    = cy + Math.sin(angle) * outerR;
          for (let s = 0; s < 6; s++) {
            const sa = angle + (s - 3) * 0.4;
            ctx.save();
            ctx.strokeStyle = `hsla(${primHue},100%,70%,0.7)`;
            ctx.lineWidth   = 1.5;
            ctx.shadowColor = `hsl(${primHue},100%,60%)`;
            ctx.shadowBlur  = 8;
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.lineTo(tx + Math.cos(sa) * 22, ty + Math.sin(sa) * 22);
            ctx.stroke();
            ctx.restore();
          }
        }
      }

      const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, dim * 0.09 * (1 + bass * 1.4));
      cg.addColorStop(0,   `hsla(${primHue},80%,90%,${0.5 + bass * 0.5})`);
      cg.addColorStop(0.5, `hsla(${primHue},60%,50%,${0.25 + bass * 0.35})`);
      cg.addColorStop(1,   "transparent");
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(cx, cy, dim * 0.09 * (1 + bass * 1.4), 0, Math.PI * 2);
      ctx.fill();
    }

    // ─── PLASMA ───────────────────────────────────────────────────────────────

    function buildLightning(x1: number, y1: number, x2: number, y2: number, rough: number, depth: number, pts: [number, number][]) {
      if (depth === 0) { pts.push([x2, y2]); return; }
      const mx = (x1 + x2) / 2 + (Math.random() - 0.5) * rough;
      const my = (y1 + y2) / 2 + (Math.random() - 0.5) * rough;
      buildLightning(x1, y1, mx, my, rough * 0.58, depth - 1, pts);
      buildLightning(mx, my, x2, y2, rough * 0.58, depth - 1, pts);
    }

    function regenerateLightning(w: number, h: number, b: number[], primHue: number) {
      const cx   = w / 2;
      const cy   = h / 2;
      const dim  = Math.min(w, h);
      const bass = b[0];
      const bolts = 4 + Math.floor(bass * 6);
      lightningRef.current = [];
      for (let i = 0; i < bolts; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist  = dim * (0.26 + Math.random() * 0.46);
        const ex    = cx + Math.cos(angle) * dist;
        const ey    = cy + Math.sin(angle) * dist;
        const rough = 28 + bass * 80 + dim * 0.09;
        const pts: [number, number][] = [[cx, cy]];
        buildLightning(cx, cy, ex, ey, rough, 5, pts);
        lightningRef.current.push({
          points: pts,
          hue:    (primHue + Math.random() * 40 - 20 + 360) % 360,
          width:  1 + b[i % BAR_COUNT] * 3.5,
          alpha:  0.7 + Math.random() * 0.3,
        });

        if (Math.random() > 0.4) {
          const midIdx = Math.floor(pts.length / 2);
          const bAngle = angle + (Math.random() - 0.5) * 1.2;
          const bDist  = dist * (0.3 + Math.random() * 0.4);
          const bex    = pts[midIdx][0] + Math.cos(bAngle) * bDist;
          const bey    = pts[midIdx][1] + Math.sin(bAngle) * bDist;
          const bpts: [number, number][] = [pts[midIdx]];
          buildLightning(pts[midIdx][0], pts[midIdx][1], bex, bey, rough * 0.5, 4, bpts);
          lightningRef.current.push({
            points: bpts,
            hue:    (primHue + 20 + Math.random() * 30) % 360,
            width:  b[i % BAR_COUNT] * 2,
            alpha:  0.45 + Math.random() * 0.3,
          });
        }
      }
    }

    function drawPlasma(ctx: CanvasRenderingContext2D, w: number, h: number, b: number[], c: VisualizerColors["plasma"]) {
      ctx.fillStyle = "rgba(0, 4, 20, 0.13)";
      ctx.fillRect(0, 0, w, h);

      const cx      = w / 2;
      const cy      = h / 2;
      const dim     = Math.min(w, h);
      const bass    = b[0];
      const now     = Date.now() * 0.00028;
      const primHue = hexToHue(c.primary);
      const secHue  = hexToHue(c.secondary);

      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const clouds = [
        { x: 0.28 + Math.sin(now * 0.72) * 0.13, y: 0.50 + Math.cos(now * 0.51) * 0.17, band: b[4]  },
        { x: 0.72 + Math.sin(now * 0.43) * 0.12, y: 0.42 + Math.cos(now * 0.63) * 0.17, band: b[12] },
        { x: 0.50 + Math.sin(now * 0.91) * 0.14, y: 0.64 + Math.cos(now * 0.78) * 0.14, band: b[20] },
        { x: 0.18 + Math.sin(now * 0.64) * 0.10, y: 0.30 + Math.cos(now * 0.55) * 0.12, band: b[8]  },
      ];
      for (const cl of clouds) {
        const bx = cl.x * w; const by = cl.y * h;
        const br = dim * (0.30 + bass * 0.20 + cl.band * 0.16);
        const g  = ctx.createRadialGradient(bx, by, 0, bx, by, br);
        g.addColorStop(0,   `hsla(${secHue},70%,55%,0.20)`);
        g.addColorStop(0.4, `hsla(${secHue},60%,35%,0.08)`);
        g.addColorStop(1,   "transparent");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
      ctx.restore();

      const ringR = 40 + bass * 80;
      ctx.save();
      ctx.strokeStyle = `hsla(${primHue},100%,70%,${0.15 + bass * 0.45})`;
      ctx.lineWidth   = 1.5 + bass * 3;
      ctx.shadowColor = `hsl(${primHue},100%,65%)`;
      ctx.shadowBlur  = 15 + bass * 25;
      ctx.beginPath();
      ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      const interval = 280 + (1 - bass) * 400;
      if (Date.now() - lightningTRef.current > interval) {
        regenerateLightning(w, h, b, primHue);
        lightningTRef.current = Date.now();
      }

      for (const bolt of lightningRef.current) {
        if (bolt.points.length < 2) continue;
        ctx.save();
        ctx.shadowColor = `hsl(${bolt.hue},100%,70%)`;
        ctx.shadowBlur  = 28;
        ctx.strokeStyle = `hsla(${bolt.hue},100%,68%,${bolt.alpha * 0.35})`;
        ctx.lineWidth   = (bolt.width + 5) * 1.8;
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(bolt.points[0][0], bolt.points[0][1]);
        for (let i = 1; i < bolt.points.length; i++) ctx.lineTo(bolt.points[i][0], bolt.points[i][1]);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = `rgba(220,248,255,${bolt.alpha})`;
        ctx.lineWidth   = bolt.width;
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(bolt.points[0][0], bolt.points[0][1]);
        for (let i = 1; i < bolt.points.length; i++) ctx.lineTo(bolt.points[i][0], bolt.points[i][1]);
        ctx.stroke();
        ctx.restore();
      }

      const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 30 + bass * 70);
      cg.addColorStop(0,   `rgba(255,255,255,${0.32 + bass * 0.68})`);
      cg.addColorStop(0.3, `hsla(${primHue},100%,70%,${0.20 + bass * 0.45})`);
      cg.addColorStop(1,   "transparent");
      ctx.fillStyle = cg;
      ctx.fillRect(0, 0, w, h);
    }

    // ─── VORTEX ───────────────────────────────────────────────────────────────

    function drawVortex(ctx: CanvasRenderingContext2D, w: number, h: number, b: number[], c: VisualizerColors["vortex"]) {
      ctx.fillStyle = "rgba(0,0,0,0.04)";
      ctx.fillRect(0, 0, w, h);

      const cx      = w / 2;
      const cy      = h / 2;
      const dim     = Math.min(w, h);
      const bass    = b[0];
      const mid     = b[10];
      const beat    = beatDetect(bass);
      const primHue = hexToHue(c.primary);
      const secHue  = hexToHue(c.secondary);

      vortexAngleRef.current += 0.010 + bass * 0.055;
      const base   = vortexAngleRef.current;
      const colorT = (Date.now() / 8000) % 1;
      const now    = Date.now() * 0.0003;

      // ─── Psychedelic aura clouds ───────────────────────────────────────────
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const auroras = [
        { x: 0.30 + Math.sin(now * 0.61 + 0.0) * 0.20, y: 0.45 + Math.cos(now * 0.47 + 0.0) * 0.22, hueOff: 0,   bi: 2  },
        { x: 0.70 + Math.sin(now * 0.53 + 1.2) * 0.18, y: 0.55 + Math.cos(now * 0.71 + 0.8) * 0.20, hueOff: 120, bi: 8  },
        { x: 0.50 + Math.sin(now * 0.82 + 2.4) * 0.16, y: 0.25 + Math.cos(now * 0.63 + 1.6) * 0.18, hueOff: 240, bi: 14 },
        { x: 0.20 + Math.sin(now * 0.44 + 3.1) * 0.14, y: 0.75 + Math.cos(now * 0.55 + 2.4) * 0.16, hueOff: 60,  bi: 20 },
        { x: 0.78 + Math.sin(now * 0.67 + 4.5) * 0.15, y: 0.30 + Math.cos(now * 0.39 + 3.2) * 0.17, hueOff: 180, bi: 26 },
      ];
      for (const a of auroras) {
        const amp = b[a.bi];
        const bx  = a.x * w;
        const by  = a.y * h;
        const br  = dim * (0.35 + amp * 0.30 + bass * 0.12);
        const hue = (primHue + a.hueOff + colorT * 60) % 360;
        const g   = ctx.createRadialGradient(bx, by, 0, bx, by, br);
        g.addColorStop(0,    `hsla(${hue},100%,55%,${0.15 + amp * 0.20})`);
        g.addColorStop(0.4,  `hsla(${hue},90%,35%,${0.06 + amp * 0.08})`);
        g.addColorStop(1,    "transparent");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
      ctx.restore();

      const RIBBONS = 20;

      for (let r = 0; r < RIBBONS; r++) {
        const bIdx      = Math.floor((r / RIBBONS) * BAR_COUNT);
        const intensity = b[bIdx] * 0.55 + mid * 0.45;
        const len       = dim * (0.12 + intensity * 0.52);
        const spread    = dim * 0.08 * (1 + intensity);

        for (let side = 0; side < 2; side++) {
          const flip  = side === 0 ? 1 : -1;
          const theta = (r / RIBBONS) * Math.PI * 2 + base + side * Math.PI;
          const ex    = cx + Math.cos(theta) * len;
          const ey    = cy + Math.sin(theta) * len;
          const cp1x  = cx + Math.cos(theta - 0.80 * flip) * len * 0.45;
          const cp1y  = cy + Math.sin(theta - 0.80 * flip) * len * 0.45;
          const cp2x  = cx + Math.cos(theta + 0.40 * flip) * len * 0.80 - Math.sin(theta) * spread;
          const cp2y  = cy + Math.sin(theta + 0.40 * flip) * len * 0.80 + Math.cos(theta) * spread;

          const hue = (primHue + intensity * 30 + colorT * 40) % 360;
          const lum = 20 + intensity * 38;

          ctx.save();
          ctx.strokeStyle = `hsl(${hue},100%,${lum}%)`;
          ctx.lineWidth   = 1.5 + intensity * 32;
          ctx.lineCap     = "round";
          ctx.shadowColor = `hsl(${hue},100%,48%)`;
          ctx.shadowBlur  = 8 + intensity * 18;
          ctx.globalAlpha = 0.55 + intensity * 0.45;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, ex, ey);
          ctx.stroke();
          ctx.restore();
        }
      }

      if (beat) {
        for (let i = 0; i < 20; i++) {
          const angle  = Math.random() * Math.PI * 2;
          const startR = 10;
          const endR   = 20 + Math.random() * dim * 0.40;
          const burstHue = (primHue + Math.random() * 120 + colorT * 180) % 360;
          ctx.save();
          ctx.globalCompositeOperation = "screen";
          ctx.strokeStyle = `hsla(${burstHue},100%,65%,${0.4 + Math.random() * 0.4})`;
          ctx.lineWidth   = 0.5 + Math.random() * 2;
          ctx.shadowColor = `hsl(${burstHue},100%,60%)`;
          ctx.shadowBlur  = 8 + Math.random() * 12;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(angle) * startR, cy + Math.sin(angle) * startR);
          ctx.lineTo(cx + Math.cos(angle) * endR,   cy + Math.sin(angle) * endR);
          ctx.stroke();
          ctx.restore();
        }
      }

      const ng = ctx.createRadialGradient(cx, cy, 0, cx, cy, 40 + bass * 80);
      ng.addColorStop(0,   `hsla(${secHue},100%,92%,${0.6 + bass * 0.4})`);
      ng.addColorStop(0.25, `hsla(${primHue},100%,65%,${0.45 + bass * 0.35})`);
      ng.addColorStop(0.55, `hsla(${secHue},90%,40%,${0.20 + bass * 0.25})`);
      ng.addColorStop(1,   "transparent");
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = ng;
      ctx.beginPath();
      ctx.arc(cx, cy, 40 + bass * 80, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ─── RADIAL ───────────────────────────────────────────────────────────────

    function drawRadial(ctx: CanvasRenderingContext2D, w: number, h: number, b: number[], c: VisualizerColors["radial"]) {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);

      const cx      = w / 2;
      const cy      = h / 2;
      const dim     = Math.min(w, h);
      const bass    = b[0];
      const primHue = hexToHue(c.primary);
      const secHue  = hexToHue(c.secondary);
      const baseHue = (Date.now() / 44 + primHue) % 360;
      const beat    = beatDetect(bass);

      const innerR   = dim * 0.09;
      const maxOuter = dim * 0.42;
      for (let i = 0; i < BAR_COUNT; i++) {
        const angle = (i / BAR_COUNT) * Math.PI * 2 - Math.PI / 2;
        const len   = b[i] * maxOuter;
        const hue   = (baseHue + i * (360 / BAR_COUNT)) % 360;
        const col   = `hsl(${hue},100%,62%)`;
        ctx.save();
        ctx.strokeStyle = col;
        ctx.lineWidth   = Math.max(1.5, (dim * 0.75 / BAR_COUNT) * 0.50);
        ctx.lineCap     = "round";
        ctx.shadowColor = col;
        ctx.shadowBlur  = 16 + b[i] * 22;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * innerR,         cy + Math.sin(angle) * innerR);
        ctx.lineTo(cx + Math.cos(angle) * (innerR + len), cy + Math.sin(angle) * (innerR + len));
        ctx.stroke();
        ctx.restore();
      }

      const maxInner = dim * 0.14;
      for (let i = 0; i < BAR_COUNT; i++) {
        const angle = (i / BAR_COUNT) * Math.PI * 2 - Math.PI / 2 + Math.PI / BAR_COUNT;
        const len   = b[BAR_COUNT - 1 - i] * maxInner;
        const hue   = (baseHue + 180 + i * (360 / BAR_COUNT)) % 360;
        const col   = `hsl(${hue},100%,75%)`;
        ctx.save();
        ctx.strokeStyle = col;
        ctx.lineWidth   = Math.max(1, (dim * 0.50 / BAR_COUNT) * 0.40);
        ctx.lineCap     = "round";
        ctx.shadowColor = col;
        ctx.shadowBlur  = 8;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * innerR * 0.4,          cy + Math.sin(angle) * innerR * 0.4);
        ctx.lineTo(cx + Math.cos(angle) * (innerR * 0.4 + len),  cy + Math.sin(angle) * (innerR * 0.4 + len));
        ctx.stroke();
        ctx.restore();
      }

      const ringAngle = (Date.now() * 0.0008) % (Math.PI * 2);
      const ringRad   = innerR * 1.5;
      ctx.save();
      ctx.strokeStyle = `hsla(${secHue},100%,60%,0.35)`;
      ctx.lineWidth   = 1;
      ctx.setLineDash([4, 8]);
      ctx.beginPath();
      ctx.arc(cx, cy, ringRad, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      for (let i = 0; i < 8; i++) {
        const a  = ringAngle + (i / 8) * Math.PI * 2;
        const dx = cx + Math.cos(a) * ringRad;
        const dy = cy + Math.sin(a) * ringRad;
        const dg = ctx.createRadialGradient(dx, dy, 0, dx, dy, 5);
        dg.addColorStop(0, `hsla(${(secHue + i * 45) % 360},100%,80%,0.9)`);
        dg.addColorStop(1, "transparent");
        ctx.fillStyle = dg;
        ctx.beginPath();
        ctx.arc(dx, dy, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      if (beat) {
        for (let i = 0; i < 20; i++) {
          const angle = Math.random() * Math.PI * 2;
          const len2  = innerR * 0.5 + Math.random() * dim * 0.30;
          const hue2  = (baseHue + Math.random() * 60) % 360;
          ctx.save();
          ctx.strokeStyle = `hsla(${hue2},100%,75%,0.7)`;
          ctx.lineWidth   = 1;
          ctx.shadowColor = `hsl(${hue2},100%,70%)`;
          ctx.shadowBlur  = 10;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(angle) * len2, cy + Math.sin(angle) * len2);
          ctx.stroke();
          ctx.restore();
        }
      }

      const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, innerR * (1 + bass * 1.8));
      gr.addColorStop(0,   `hsla(${baseHue},100%,92%,${0.85 + bass * 0.15})`);
      gr.addColorStop(0.5, `hsla(${baseHue + 60},100%,70%,0.3)`);
      gr.addColorStop(1,   "transparent");
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(cx, cy, innerR * (1 + bass * 1.8), 0, Math.PI * 2);
      ctx.fill();
    }

    // ─── SYNTHGRID ────────────────────────────────────────────────────────────

    function drawSynthgrid(ctx: CanvasRenderingContext2D, w: number, h: number, b: number[], c: VisualizerColors["synthgrid"]) {
      const bass     = b[0];
      const primHue  = hexToHue(c.primary);
      const secHue   = hexToHue(c.secondary);
      beatDetect(bass);

      const horizonY = h * 0.44;
      const cx = w / 2;

      const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
      skyGrad.addColorStop(0, "#00000f");
      skyGrad.addColorStop(1, "#110022");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, horizonY);

      const [sr, sg, sb] = hexToRgb(c.stars);
      for (let s = 0; s < 70; s++) {
        const sx      = (s * 137.5 + 23) % w;
        const sy      = (s * 83.1  + 11) % horizonY;
        const twinkle = 0.4 + 0.3 * Math.sin(Date.now() * 0.001 * (0.5 + (s % 5) * 0.2) + s);
        ctx.globalAlpha = twinkle;
        ctx.fillStyle   = `rgb(${sr},${sg},${sb})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 0.6 + (s % 3) * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      const sunCx = cx;
      const sunCy = horizonY * 0.8;
      const sunR  = Math.min(w, h) * 0.20 * (1 + bass * 0.10);
      const halo  = ctx.createRadialGradient(sunCx, sunCy, 0, sunCx, sunCy, sunR * 3.5);
      halo.addColorStop(0,   `rgba(255,90,40,${0.14 + bass * 0.18})`);
      halo.addColorStop(0.5, `rgba(200,0,140,${0.06 + bass * 0.08})`);
      halo.addColorStop(1,   "transparent");
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, w, horizonY);

      ctx.save();
      ctx.beginPath();
      ctx.arc(sunCx, sunCy, sunR, 0, Math.PI * 2);
      ctx.clip();
      const [sR, sG, sB] = hexToRgb(c.sun);
      const sunHue = hexToHue(c.sun);
      const [, sunS, sunL] = rgbToHsl(sR, sG, sB);
      const sunGrad = ctx.createLinearGradient(0, sunCy - sunR, 0, sunCy + sunR);
      sunGrad.addColorStop(0,    c.sun);
      sunGrad.addColorStop(0.25, `hsl(${sunHue},${(sunS * 100).toFixed(0)}%,${Math.max(8, sunL * 100 * 0.65).toFixed(0)}%)`);
      sunGrad.addColorStop(0.55, `hsl(${sunHue},${(sunS * 100 * 0.85).toFixed(0)}%,${Math.max(5, sunL * 100 * 0.35).toFixed(0)}%)`);
      sunGrad.addColorStop(1,    `hsl(${sunHue},${(sunS * 100 * 0.7).toFixed(0)}%,${Math.max(2, sunL * 100 * 0.18).toFixed(0)}%)`);
      ctx.fillStyle = sunGrad;
      ctx.fillRect(sunCx - sunR, sunCy - sunR, sunR * 2, sunR * 2);
      for (let i = 0; i < 14; i++) {
        const t  = i / 14;
        const sy = sunCy - sunR + t * sunR * 2;
        const sh = sunR * (0.038 + t * 0.042);
        ctx.fillStyle = `rgba(0,0,0,${0.45 + t * 0.35})`;
        ctx.fillRect(sunCx - sunR, sy, sunR * 2, sh);
      }
      ctx.restore();

      ctx.save();
      ctx.shadowColor = `hsl(${primHue},100%,60%)`;
      ctx.shadowBlur  = 18;
      ctx.fillStyle   = `hsla(${primHue},100%,60%,${0.35 + bass * 0.45})`;
      ctx.fillRect(0, horizonY - 1, w, 2);
      ctx.restore();

      const groundGrad = ctx.createLinearGradient(0, horizonY, 0, h);
      groundGrad.addColorStop(0, "#060010");
      groundGrad.addColorStop(1, "#020008");
      ctx.fillStyle = groundGrad;
      ctx.fillRect(0, horizonY, w, h - horizonY);

      ctx.save();
      const terrainPts = 100;
      ctx.beginPath();
      ctx.moveTo(0, horizonY);
      for (let i = 0; i <= terrainPts; i++) {
        const tx = (i / terrainPts) * w;
        const fi = Math.floor((i / terrainPts) * (BAR_COUNT - 1));
        const ty = horizonY - b[fi] * 88 - b[Math.max(0, fi - 1)] * 32;
        ctx.lineTo(tx, ty);
      }
      ctx.lineTo(w, horizonY);
      ctx.closePath();
      const tGrad = ctx.createLinearGradient(0, horizonY - 100, 0, horizonY);
      tGrad.addColorStop(0, `hsla(${primHue},100%,60%,0.55)`);
      tGrad.addColorStop(1, `hsla(${primHue},70%,30%,0.15)`);
      ctx.fillStyle   = tGrad;
      ctx.fill();
      ctx.strokeStyle = `hsla(${primHue},100%,70%,${0.5 + bass * 0.5})`;
      ctx.lineWidth   = 1.5;
      ctx.shadowColor = `hsl(${primHue},100%,65%)`;
      ctx.shadowBlur  = 10;
      ctx.stroke();
      ctx.restore();

      synthgridPhaseRef.current = (synthgridPhaseRef.current + 0.005 + bass * 0.010) % 1;
      const phase = synthgridPhaseRef.current;

      for (let i = 0; i < 22; i++) {
        const t = ((i + phase) / 22);
        const p = Math.pow(t, 2.3);
        const y = horizonY + (h - horizonY) * p;
        if (y > h || y < horizonY) continue;
        ctx.save();
        ctx.strokeStyle = `hsla(${primHue},100%,60%,${0.10 + p * 0.65})`;
        ctx.lineWidth   = 0.5 + p * 2.8;
        ctx.shadowColor = `hsl(${primHue},100%,55%)`;
        ctx.shadowBlur  = p * 10;
        ctx.beginPath();
        ctx.moveTo(0, y); ctx.lineTo(w, y);
        ctx.stroke();
        ctx.restore();
      }

      for (let j = -18; j <= 18; j++) {
        if (j === 0) continue;
        const t     = Math.abs(j) / 18;
        const alpha = (1 - t * 0.65) * 0.60 + bass * 0.14;
        const bx    = cx + (j / 18) * (w * 0.52);
        ctx.save();
        ctx.strokeStyle = `hsla(${secHue},80%,55%,${alpha})`;
        ctx.lineWidth   = 0.5 + (1 - t) * 0.9;
        ctx.shadowColor = `hsl(${secHue},100%,50%)`;
        ctx.shadowBlur  = (1 - t) * 6;
        ctx.beginPath();
        ctx.moveTo(cx, horizonY);
        ctx.lineTo(bx, h);
        ctx.stroke();
        ctx.restore();
      }
    }

    // ─── TUNNEL ───────────────────────────────────────────────────────────────

    function drawTunnel(ctx: CanvasRenderingContext2D, w: number, h: number, b: number[], c: VisualizerColors["tunnel"]) {
      ctx.fillStyle = "rgba(0, 0, 8, 0.14)";
      ctx.fillRect(0, 0, w, h);

      const cx      = w / 2;
      const cy      = h / 2;
      const dim     = Math.min(w, h);
      const bass    = b[0];
      const primHue = hexToHue(c.primary);
      const secHue  = hexToHue(c.secondary);
      const now     = Date.now();

      tunnelPhaseRef.current = (tunnelPhaseRef.current + 0.010 + bass * 0.012) % 1;
      tunnelAngleRef.current += 0.004 + bass * 0.018;
      const phase   = tunnelPhaseRef.current;
      const baseRot = tunnelAngleRef.current;

      const RINGS = 24;
      const SIDES = 6;

      for (let i = RINGS - 1; i >= 0; i--) {
        const t      = ((i / RINGS) + phase) % 1;
        const radius = t * dim * 0.70;
        if (radius < 1) continue;

        const freqIdx = Math.floor((1 - t) * (BAR_COUNT - 1));
        const amp     = b[freqIdx];
        const pulse   = 1 + amp * 0.28;
        const r       = radius * pulse;

        const hue   = (secHue + 360 * t * 1.8 + baseRot * 57 + now * 0.018) % 360;
        const lit   = 35 + amp * 40;
        const alpha = Math.min(1, 0.25 + t * 0.65 + amp * 0.18);
        const lw    = 0.8 + t * 4 + amp * 2.5;

        ctx.strokeStyle = `hsla(${hue},100%,${lit}%,${alpha})`;
        ctx.lineWidth   = lw;
        ctx.shadowColor = `hsl(${hue},100%,60%)`;
        ctx.shadowBlur  = 8 + t * 20 + amp * 28;

        const ringRot = baseRot + i * 0.06;
        ctx.beginPath();
        for (let s = 0; s <= SIDES; s++) {
          const angle   = (s / SIDES) * Math.PI * 2 + ringRot;
          const vFreq   = b[Math.floor((s / SIDES) * (BAR_COUNT - 1))];
          const distort = 1 + vFreq * 0.18;
          const vx = cx + Math.cos(angle) * r * distort;
          const vy = cy + Math.sin(angle) * r * distort;
          if (s === 0) ctx.moveTo(vx, vy); else ctx.lineTo(vx, vy);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.shadowBlur = 0;

        if (i % 4 === 0 && t > 0.05 && i < RINGS - 1) {
          const nextT = (((i + 4) / RINGS) + phase) % 1;
          const nextR = nextT * dim * 0.70;
          if (nextR < 1) continue;
          ctx.strokeStyle = `hsla(${hue},80%,50%,${alpha * 0.3})`;
          ctx.lineWidth   = 0.5;
          for (let s = 0; s < SIDES; s++) {
            const a  = (s / SIDES) * Math.PI * 2 + ringRot;
            const na = (s / SIDES) * Math.PI * 2 + (baseRot + (i + 4) * 0.06);
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(a) * r,      cy + Math.sin(a) * r);
            ctx.lineTo(cx + Math.cos(na) * nextR, cy + Math.sin(na) * nextR);
            ctx.stroke();
          }
        }
      }

      ctx.shadowBlur = 0;
      const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 25 + bass * 70);
      cg.addColorStop(0,   `rgba(255,255,255,${0.6 + bass * 0.4})`);
      cg.addColorStop(0.3, `hsla(${primHue},100%,60%,${0.35 + bass * 0.40})`);
      cg.addColorStop(0.7, `hsla(${(primHue + 120) % 360},100%,50%,${0.15 + bass * 0.20})`);
      cg.addColorStop(1,   "transparent");
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(cx, cy, 25 + bass * 70, 0, Math.PI * 2);
      ctx.fill();
    }

    // ─── OCEAN ────────────────────────────────────────────────────────────────

    function drawOcean(ctx: CanvasRenderingContext2D, w: number, h: number, b: number[], c: VisualizerColors["ocean"]) {
      ctx.fillStyle = "rgba(0, 8, 28, 0.22)";
      ctx.fillRect(0, 0, w, h);

      const cx       = w / 2;
      const bass     = b[0];
      const mid      = b[10];
      const horizonY = h * 0.38;
      const nearHue  = hexToHue(c.primary);
      const deepHue  = hexToHue(c.secondary);

      const sky = ctx.createLinearGradient(0, 0, 0, horizonY);
      sky.addColorStop(0, "rgba(0,5,25,0)");
      sky.addColorStop(1, "rgba(0,20,60,0)");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, horizonY);

      const atmGlow = ctx.createLinearGradient(0, horizonY - 30, 0, horizonY + 30);
      atmGlow.addColorStop(0,   "transparent");
      atmGlow.addColorStop(0.5, `hsla(${nearHue},100%,55%,${0.06 + bass * 0.12})`);
      atmGlow.addColorStop(1,   "transparent");
      ctx.fillStyle = atmGlow;
      ctx.fillRect(0, horizonY - 30, w, 60);

      oceanPhaseRef.current = (oceanPhaseRef.current + 0.005 + bass * 0.006) % 1;
      const phase = oceanPhaseRef.current;

      for (let wi = 0; wi < 30; wi++) {
        const t     = ((wi + phase) / 30);
        const depth = Math.pow(t, 1.6);
        const screenY = horizonY + (h * 1.08 - horizonY) * depth;
        if (screenY < horizonY || screenY > h * 1.06) continue;

        const halfW   = w * 0.3 + w * 0.72 * depth;
        const freqIdx = Math.floor((1 - depth) * (BAR_COUNT - 1));
        const amp     = b[freqIdx] * (20 + depth * 140);

        const hue   = (deepHue + (nearHue - deepHue) * depth + 720) % 360;
        const sat   = 70 + depth * 30;
        const lit   = 12 + depth * 55;
        const alpha = Math.min(1, 0.12 + depth * 0.78);
        const lw    = 0.4 + depth * 3.5;

        ctx.save();
        ctx.strokeStyle = `hsla(${hue},${sat}%,${lit}%,${alpha})`;
        ctx.lineWidth   = lw;
        ctx.shadowColor = `hsl(${hue},100%,${lit + 20}%)`;
        ctx.shadowBlur  = depth * 22 + bass * 12;

        const tBase = phase * Math.PI * 10;
        ctx.beginPath();
        for (let xi = 0; xi <= 140; xi++) {
          const xt       = xi / 140;
          const sx       = cx - halfW + xt * halfW * 2;
          const envelope = Math.sin(xt * Math.PI);
          const wave =
            Math.sin(xt * Math.PI * 5 + tBase + wi * 0.6)       * amp * 0.50 +
            Math.sin(xt * Math.PI * 3 - tBase * 0.7 + wi * 0.4) * amp * 0.30 +
            Math.sin(xt * Math.PI * 9 + tBase * 1.3)             * amp * 0.20;
          const sy = screenY - wave * envelope;
          if (xi === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
        }
        ctx.stroke();

        if (depth > 0.55) {
          ctx.globalAlpha = depth * 0.12;
          ctx.beginPath();
          for (let xi = 0; xi <= 140; xi++) {
            const xt       = xi / 140;
            const sx       = cx - halfW + xt * halfW * 2;
            const envelope = Math.sin(xt * Math.PI);
            const wave =
              Math.sin(xt * Math.PI * 5 + tBase + wi * 0.6)       * amp * 0.50 +
              Math.sin(xt * Math.PI * 3 - tBase * 0.7 + wi * 0.4) * amp * 0.30;
            ctx.lineTo(sx, screenY - wave * envelope);
          }
          ctx.lineTo(cx + halfW, screenY + 30);
          ctx.lineTo(cx - halfW, screenY + 30);
          ctx.closePath();
          const wfg = ctx.createLinearGradient(0, screenY - amp, 0, screenY + 30);
          wfg.addColorStop(0, `hsla(${hue},80%,40%,0.7)`);
          wfg.addColorStop(1, "transparent");
          ctx.fillStyle = wfg;
          ctx.fill();
        }
        ctx.restore();
      }

      const shCount = Math.floor(bass * 12 + mid * 8);
      for (let s = 0; s < shCount; s++) {
        const sx = (Math.random() - 0.5) * w * 1.5 + cx;
        const sy = h * 0.55 + Math.random() * h * 0.35;
        const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 4 + Math.random() * 6);
        sg.addColorStop(0, "rgba(200,240,255,0.6)");
        sg.addColorStop(1, "transparent");
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.arc(sx, sy, 4 + Math.random() * 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ─── ALBUM AURA ───────────────────────────────────────────────────────────

    function drawArtwork(ctx: CanvasRenderingContext2D, w: number, h: number, b: number[]) {
      const bass = b[0];
      const mid  = b[10];
      const high = b[22];
      const beat = beatDetect(bass);
      const cols = artworkColorsRef.current;
      const [c0, c1, c2] = cols;
      const cx   = w / 2;
      const cy   = h / 2;
      const dim  = Math.min(w, h);
      const now  = Date.now();

      ctx.fillStyle = "#010106";
      ctx.fillRect(0, 0, w, h);

      // ── Background: aurora flows + concentric rings ──────────────────────────
      ctx.globalCompositeOperation = "screen";

      // 8 horizontal bezier curves flowing across the canvas
      const AURORA = 8;
      for (let ai = 0; ai < AURORA; ai++) {
        const t     = ai / AURORA;
        const drift = now * 0.000042 * (ai % 2 === 0 ? 1 : -1.1) + ai * 1.4;
        const baseY = h * (0.08 + t * 0.84);
        const bIdx  = Math.floor(t * BAR_COUNT);
        const amp   = b[bIdx] * 0.6 + bass * 0.4;
        const waveH = h * (0.04 + amp * 0.15);
        const col   = cols[ai % 3];
        const sy    = baseY + Math.sin(drift)       * waveH * 0.5;
        const ey    = baseY + Math.sin(drift + 1.2) * waveH * 0.5;
        const cp1y  = baseY + Math.sin(drift + 0.6) * waveH;
        const cp2y  = baseY + Math.sin(drift + 2.0) * waveH;

        ctx.lineCap     = "butt";
        ctx.lineWidth   = 10 + amp * 20;
        ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${0.022 + amp * 0.048})`;
        ctx.beginPath();
        ctx.moveTo(0, sy);
        ctx.bezierCurveTo(w * 0.25, cp1y, w * 0.75, cp2y, w, ey);
        ctx.stroke();

        ctx.lineWidth   = 0.65;
        ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${0.07 + amp * 0.13})`;
        ctx.beginPath();
        ctx.moveTo(0, sy);
        ctx.bezierCurveTo(w * 0.25, cp1y, w * 0.75, cp2y, w, ey);
        ctx.stroke();
      }

      // 4 concentric rings pulsing with frequency bands
      const BG_RINGS = 4;
      for (let ri = 0; ri < BG_RINGS; ri++) {
        const bIdx     = Math.floor(((ri + 1) / (BG_RINGS + 1)) * BAR_COUNT);
        const freqBand = b[bIdx];
        const rBase    = dim * (0.24 + ri * 0.10);
        const rPulse   = rBase * (1 + freqBand * 0.14 + bass * 0.06);
        const col      = cols[ri % 3];
        const alpha    = 0.05 + freqBand * 0.13;

        ctx.lineWidth   = 12 + freqBand * 18;
        ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${alpha * 0.35})`;
        ctx.beginPath();
        ctx.arc(cx, cy, rPulse, 0, Math.PI * 2);
        ctx.stroke();

        ctx.lineWidth   = 0.65;
        ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${alpha})`;
        ctx.beginPath();
        ctx.arc(cx, cy, rPulse, 0, Math.PI * 2);
        ctx.stroke();
      }

      // ── Laser light show (double-stroke glow — no shadowBlur) ──────────────
      // Precompute angles and origins once, reuse in both passes.
      const LASERS   = 9;
      const laserOy  = h * 0.91;
      const laserLen = Math.max(w, h) * 2.2;
      const lSin     = new Float32Array(LASERS);
      const lCos     = new Float32Array(LASERS);
      const lOx      = new Float32Array(LASERS);
      for (let i = 0; i < LASERS; i++) {
        const t      = i / LASERS;
        const sweep  = Math.sin(now * 0.00022 * (1 + t * 0.5) + i * 2.17) * 0.95;
        const angle  = (t - 0.5) * Math.PI * 1.5 + sweep;
        lSin[i]      = Math.sin(angle);
        lCos[i]      = Math.cos(angle);
        lOx[i]       = cx + Math.sin(now * 0.00009 + i * 1.3) * w * 0.06;
      }

      ctx.globalCompositeOperation = "screen";
      ctx.lineCap = "round";
      const beatBoost = beat ? 0.08 : 0;

      // Outer halo pass
      ctx.lineWidth = 9 + bass * 14 + (beat ? 5 : 0);
      for (let i = 0; i < LASERS; i++) {
        const col = cols[i % 3];
        ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${0.055 + bass * 0.10 + beatBoost})`;
        ctx.beginPath();
        ctx.moveTo(lOx[i], laserOy);
        ctx.lineTo(lOx[i] + lSin[i] * laserLen, laserOy - lCos[i] * laserLen);
        ctx.stroke();
      }
      // Core pass
      ctx.lineWidth = 0.8 + bass * 1.4;
      for (let i = 0; i < LASERS; i++) {
        const col = cols[i % 3];
        ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${Math.min(1, 0.22 + bass * 0.38 + beatBoost * 2)})`;
        ctx.beginPath();
        ctx.moveTo(lOx[i], laserOy);
        ctx.lineTo(lOx[i] + lSin[i] * laserLen, laserOy - lCos[i] * laserLen);
        ctx.stroke();
      }

      // Haze at origin (single gradient fill)
      const hcol = cols[Math.floor(now * 0.0003) % 3];
      const hg   = ctx.createRadialGradient(cx, laserOy, 0, cx, laserOy, 50 + bass * 60);
      hg.addColorStop(0, `rgba(${hcol[0]},${hcol[1]},${hcol[2]},${0.20 + bass * 0.26})`);
      hg.addColorStop(1, `rgba(${hcol[0]},${hcol[1]},${hcol[2]},0)`);
      ctx.fillStyle = hg;
      ctx.fillRect(0, 0, w, h);

      // ── Color blobs ─────────────────────────────────────────────────────────
      const blobData: Array<{ x: number; y: number; pulse: number; col: [number,number,number] }> = [
        { x: cx + Math.sin(now * 0.00043) * w * 0.18,       y: cy + Math.cos(now * 0.00031) * h * 0.15,       pulse: bass, col: c0 },
        { x: cx + Math.sin(now * 0.00057 + 2.0) * w * 0.20, y: cy + Math.cos(now * 0.00039 + 1.0) * h * 0.18, pulse: mid,  col: c1 },
        { x: cx + Math.sin(now * 0.00037 + 4.2) * w * 0.15, y: cy + Math.cos(now * 0.00047 + 3.1) * h * 0.20, pulse: high, col: c2 },
      ];
      for (const bd of blobData) {
        const br = dim * (0.42 + bd.pulse * 0.28);
        const g  = ctx.createRadialGradient(bd.x, bd.y, 0, bd.x, bd.y, br);
        g.addColorStop(0,   `rgba(${bd.col[0]},${bd.col[1]},${bd.col[2]},${0.22 + bd.pulse * 0.30})`);
        g.addColorStop(0.5, `rgba(${bd.col[0]},${bd.col[1]},${bd.col[2]},0.04)`);
        g.addColorStop(1,   "transparent");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
      ctx.globalCompositeOperation = "source-over";

      // ── Radial bars (double-stroke glow, no per-bar shadowBlur) ────────────
      const artSize = dim * (0.22 + bass * 0.028);
      const innerR  = artSize / 2 + 12;
      const maxBar  = dim * 0.22;

      // Precompute bar geometry once
      const bAngle = new Float32Array(BAR_COUNT);
      const bLen   = new Float32Array(BAR_COUNT);
      const bCosA  = new Float32Array(BAR_COUNT);
      const bSinA  = new Float32Array(BAR_COUNT);
      for (let i = 0; i < BAR_COUNT; i++) {
        bLen[i]   = b[i] * maxBar;
        bAngle[i] = (i / BAR_COUNT) * Math.PI * 2 - Math.PI / 2;
        bCosA[i]  = Math.cos(bAngle[i]);
        bSinA[i]  = Math.sin(bAngle[i]);
      }

      ctx.lineCap = "round";
      // Outer halo pass
      for (let i = 0; i < BAR_COUNT; i++) {
        if (bLen[i] < 2) continue;
        const t   = i / BAR_COUNT;
        const col = t < 0.33 ? c0 : t < 0.66 ? c1 : c2;
        ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${0.10 + b[i] * 0.16})`;
        ctx.lineWidth   = 9 + b[i] * 16;
        ctx.beginPath();
        ctx.moveTo(cx + bCosA[i] * innerR,            cy + bSinA[i] * innerR);
        ctx.lineTo(cx + bCosA[i] * (innerR + bLen[i]), cy + bSinA[i] * (innerR + bLen[i]));
        ctx.stroke();
      }
      // Core pass
      for (let i = 0; i < BAR_COUNT; i++) {
        if (bLen[i] < 1) continue;
        const t   = i / BAR_COUNT;
        const col = t < 0.33 ? c0 : t < 0.66 ? c1 : c2;
        ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${0.55 + b[i] * 0.45})`;
        ctx.lineWidth   = 1.5 + b[i] * 2.5;
        ctx.beginPath();
        ctx.moveTo(cx + bCosA[i] * innerR,            cy + bSinA[i] * innerR);
        ctx.lineTo(cx + bCosA[i] * (innerR + bLen[i]), cy + bSinA[i] * (innerR + bLen[i]));
        ctx.stroke();
      }

      // Beat burst (infrequent — no shadowBlur needed for brief flash)
      if (beat) {
        ctx.lineWidth = 1;
        for (let i = 0; i < 24; i++) {
          const angle  = (i / 24) * Math.PI * 2;
          const col    = i % 3 === 0 ? c0 : i % 3 === 1 ? c1 : c2;
          const burstR = innerR + b[i % BAR_COUNT] * maxBar;
          const endR   = burstR + 16 + Math.random() * 44;
          ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},0.75)`;
          ctx.lineWidth   = 0.8 + Math.random();
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(angle) * burstR,       cy + Math.sin(angle) * burstR);
          ctx.lineTo(cx + Math.cos(angle + 0.08) * endR,  cy + Math.sin(angle + 0.08) * endR);
          ctx.stroke();
        }
      }

      // ── Album art ───────────────────────────────────────────────────────────
      const img    = artworkImgRef.current;
      const artX   = cx - artSize / 2;
      const artY   = cy - artSize / 2;
      const radius = artSize * 0.07;

      if (img) {
        const haloR = artSize / 2 + 12 + bass * 40;
        const halo  = ctx.createRadialGradient(cx, cy, artSize / 2 - 10, cx, cy, haloR);
        halo.addColorStop(0,   `rgba(${c0[0]},${c0[1]},${c0[2]},${0.50 + bass * 0.40})`);
        halo.addColorStop(0.4, `rgba(${c0[0]},${c0[1]},${c0[2]},${0.10 + bass * 0.12})`);
        halo.addColorStop(1,   "transparent");
        ctx.fillStyle = halo;
        ctx.fillRect(0, 0, w, h);

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(artX, artY, artSize, artSize, radius);
        ctx.clip();
        ctx.drawImage(img, artX, artY, artSize, artSize);
        ctx.restore();

        // One shadowBlur per frame is acceptable for the art border
        ctx.save();
        ctx.strokeStyle = `rgba(${c0[0]},${c0[1]},${c0[2]},${0.30 + bass * 0.40})`;
        ctx.lineWidth   = 1.5;
        ctx.shadowColor = `rgba(${c0[0]},${c0[1]},${c0[2]},0.9)`;
        ctx.shadowBlur  = 14 + bass * 22;
        ctx.beginPath();
        ctx.roundRect(artX, artY, artSize, artSize, radius);
        ctx.stroke();
        ctx.restore();
      } else {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, artSize / 2);
        g.addColorStop(0, `rgba(${c0[0]},${c0[1]},${c0[2]},${0.20 + bass * 0.28})`);
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, artSize / 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Edge vignette
      const vg = ctx.createRadialGradient(cx, cy, dim * 0.24, cx, cy, Math.max(w, h) * 0.72);
      vg.addColorStop(0, "transparent");
      vg.addColorStop(1, "rgba(0,0,0,0.62)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);
    }

    // ─── WARP ─────────────────────────────────────────────────────────────────

    function drawWarp(ctx: CanvasRenderingContext2D, w: number, h: number, b: number[], c: VisualizerColors["warp"]) {
      ctx.fillStyle = "rgba(0,0,12,0.22)";
      ctx.fillRect(0, 0, w, h);

      const cx      = w / 2;
      const cy      = h / 2;
      const bass    = b[0];
      const high    = b[22];
      const primHue = hexToHue(c.primary);
      const secHue  = hexToHue(c.secondary);
      const stars   = warpStarsRef.current;

      if (stars.length === 0) {
        for (let i = 0; i < 300; i++) {
          stars.push({ x: (Math.random() - 0.5) * 2400, y: (Math.random() - 0.5) * 2400, z: Math.random() * 900 + 1, speed: 2.5 + Math.random() * 4.5 });
        }
      }

      const warpSpeed = 1 + bass * 20 + high * 5;
      const FOCAL     = Math.min(w, h) * 0.65;
      const colorT    = Date.now() * 0.04;

      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.lineCap = "round";

      for (let si = 0; si < stars.length; si++) {
        const star  = stars[si];
        const prevZ = star.z;
        star.z -= star.speed * warpSpeed * 0.08;

        if (star.z <= 1) {
          star.x = (Math.random() - 0.5) * 2400;
          star.y = (Math.random() - 0.5) * 2400;
          star.z = 900;
          continue;
        }

        const sx  = cx + (star.x / star.z)   * FOCAL;
        const sy  = cy + (star.y / star.z)   * FOCAL;
        const px  = cx + (star.x / prevZ)    * FOCAL;
        const py  = cy + (star.y / prevZ)    * FOCAL;
        const t   = 1 - star.z / 900;
        const hue = (si % 3 === 0 ? secHue : primHue) + (si / stars.length) * 80 + colorT;

        ctx.strokeStyle = `hsla(${hue % 360},100%,${50 + t * 40}%,${t * 0.85 + 0.12})`;
        ctx.lineWidth   = Math.max(0.3, t * 2.5 + bass * 1.5);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(sx, sy);
        ctx.stroke();
      }
      ctx.restore();

      // ─── Nebula clouds ──────────────────────────────────────────────────────
      const nebulaTime = Date.now() * 0.00015;
      for (let ni = 0; ni < 3; ni++) {
        const angle  = nebulaTime + (ni / 3) * Math.PI * 2;
        const dist   = 30 + bass * 120;
        const nx     = cx + Math.cos(angle) * dist;
        const ny     = cy + Math.sin(angle) * dist;
        const size   = 40 + bass * 180;
        const hue    = (ni % 2 === 0 ? primHue : secHue) + nebulaTime * 30 + ni * 40;
        const grad   = ctx.createRadialGradient(nx, ny, 0, nx, ny, size);
        grad.addColorStop(0, `hsla(${hue % 360}, 90%, 55%, ${0.03 + bass * 0.06})`);
        grad.addColorStop(1, "transparent");
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }

      // ─── Pulse rings ────────────────────────────────────────────────────────
      const isBeat = beatDetect(bass);
      if (isBeat) {
        warpRingsRef.current.push({
          radius:    5,
          maxRadius: Math.min(w, h) * 0.55,
          alpha:     0.5,
          speed:     2 + high * 12,
        });
      }
      const rings = warpRingsRef.current;
      for (let ri = rings.length - 1; ri >= 0; ri--) {
        const ring = rings[ri];
        ring.radius += ring.speed + bass * 3;
        ring.alpha  *= 0.955;
        if (ring.alpha < 0.01 || ring.radius > ring.maxRadius) {
          rings.splice(ri, 1);
          continue;
        }
        const hue = (secHue + ri * 60 + colorT) % 360;
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.strokeStyle = `hsla(${hue}, 100%, 65%, ${ring.alpha})`;
        ctx.lineWidth   = 1.5 + bass * 5;
        ctx.beginPath();
        ctx.arc(cx, cy, ring.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // ─── Light rays ─────────────────────────────────────────────────────────
      const numRays = 24;
      for (let ri = 0; ri < numRays; ri++) {
        const fi = ri / numRays;
        const angle = fi * Math.PI * 2 + colorT * 0.1;
        const bandIdx = Math.floor(fi * BAR_COUNT);
        const amp = b[bandIdx] ?? 0;
        const len = 20 + amp * 200;
        const hue = (primHue + fi * 120 + colorT * 0.5) % 360;
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.strokeStyle = `hsla(${hue}, 100%, 60%, ${0.04 + amp * 0.35})`;
        ctx.lineWidth   = 0.6 + amp * 3;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
        ctx.stroke();
        ctx.restore();
      }

      // ─── Central glow ───────────────────────────────────────────────────────
      const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 35 + bass * 70);
      cg.addColorStop(0,   `rgba(255,255,255,${0.08 + bass * 0.25})`);
      cg.addColorStop(0.4, `hsla(${primHue},100%,60%,${0.06 + bass * 0.14})`);
      cg.addColorStop(1,   "transparent");
      ctx.fillStyle = cg;
      ctx.fillRect(0, 0, w, h);
    }

    // ─── HYPNO ────────────────────────────────────────────────────────────────

    function drawHypno(ctx: CanvasRenderingContext2D, w: number, h: number, b: number[], c: VisualizerColors["hypno"]) {
      ctx.fillStyle = "rgba(0,0,4,0.05)";
      ctx.fillRect(0, 0, w, h);

      const cx      = w / 2;
      const cy      = h / 2;
      const dim     = Math.min(w, h);
      const bass    = b[0];
      const primHue = hexToHue(c.primary);
      const secHue  = hexToHue(c.secondary);
      const now     = Date.now() * 0.001;

      ctx.save();
      ctx.globalCompositeOperation = "screen";

      const RINGS = 20;
      for (let i = 0; i < RINGS; i++) {
        const fi    = RINGS - 1 - i;
        const tNorm = fi / RINGS;
        const amp   = b[Math.floor(tNorm * BAR_COUNT)];
        const r     = dim * (0.02 + tNorm * 0.49) * (1 + amp * 0.28 + bass * 0.10);
        const dir   = fi % 2 === 0 ? 1 : -1.3;
        const rot   = now * dir * (0.18 + amp * 0.60) + fi * 0.31;
        const SIDES = 3 + (fi % 6);
        const hue   = fi % 2 === 0 ? (primHue + now * 35 + fi * (360 / RINGS)) % 360 : (secHue + now * 20 + fi * (360 / RINGS) + 180) % 360;

        ctx.strokeStyle = `hsla(${hue},100%,55%,${0.35 + amp * 0.60})`;
        ctx.lineWidth   = 0.8 + amp * 3.0 + tNorm * 1.5;
        ctx.shadowColor = `hsl(${hue},100%,65%)`;
        ctx.shadowBlur  = 4 + amp * 18;

        ctx.beginPath();
        for (let s = 0; s <= SIDES; s++) {
          const angle  = (s / SIDES) * Math.PI * 2 + rot;
          const morphR = r * (1 + Math.sin(s * 1.3 + now * 2 + fi) * 0.08 * amp);
          const px = cx + Math.cos(angle) * morphR;
          const py = cy + Math.sin(angle) * morphR;
          if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      ctx.restore();

      const sg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 14 + bass * 35);
      sg.addColorStop(0, `hsla(${primHue},100%,90%,${0.6 + bass * 0.4})`);
      sg.addColorStop(1, "transparent");
      ctx.fillStyle = sg;
      ctx.fillRect(0, 0, w, h);
    }

    // ─── DNA ──────────────────────────────────────────────────────────────────

    function drawDna(ctx: CanvasRenderingContext2D, w: number, h: number, b: number[], c: VisualizerColors["dna"]) {
      ctx.fillStyle = "rgba(0,2,8,0.20)";
      ctx.fillRect(0, 0, w, h);

      const cx      = w / 2;
      const cy      = h / 2;
      const dim     = Math.min(w, h);
      const bass    = b[0];
      const primHue = hexToHue(c.primary);
      const secHue  = hexToHue(c.secondary);
      dnaPhaseRef.current += 0.014 + bass * 0.022;
      const phase  = dnaPhaseRef.current;
      const now    = Date.now() * 0.00035;

      // ─── Psychedelic nebula background ─────────────────────────────────────
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const nebula = [
        { x: 0.35 + Math.sin(now * 0.52 + 0.0) * 0.22, y: 0.40 + Math.cos(now * 0.44 + 0.0) * 0.25, hueOff: 0,   bi: 3  },
        { x: 0.65 + Math.sin(now * 0.68 + 1.8) * 0.20, y: 0.60 + Math.cos(now * 0.55 + 1.2) * 0.22, hueOff: 180, bi: 10 },
        { x: 0.50 + Math.sin(now * 0.41 + 3.5) * 0.18, y: 0.25 + Math.cos(now * 0.72 + 2.8) * 0.20, hueOff: 90,  bi: 18 },
        { x: 0.25 + Math.sin(now * 0.56 + 5.0) * 0.16, y: 0.70 + Math.cos(now * 0.63 + 4.0) * 0.18, hueOff: 270, bi: 6  },
        { x: 0.75 + Math.sin(now * 0.73 + 6.2) * 0.17, y: 0.35 + Math.cos(now * 0.48 + 5.5) * 0.19, hueOff: 45,  bi: 22 },
        { x: 0.50 + Math.sin(now * 0.37 + 7.8) * 0.30, y: 0.75 + Math.cos(now * 0.59 + 6.8) * 0.28, hueOff: 135, bi: 14 },
      ];
      for (const n of nebula) {
        const amp = b[n.bi];
        const nx  = n.x * w;
        const ny  = n.y * h;
        const nr  = dim * (0.28 + amp * 0.35 + bass * 0.15);
        const hue = (secHue + n.hueOff + now * 40) % 360;
        const g   = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr);
        g.addColorStop(0,    `hsla(${hue},100%,50%,${0.12 + amp * 0.22})`);
        g.addColorStop(0.5,  `hsla(${hue},80%,30%,${0.05 + amp * 0.08})`);
        g.addColorStop(1,    "transparent");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
      ctx.restore();
      const RUNGS  = 36;
      const HELIX_H = Math.min(h * 0.88, 640);
      const HELIX_R = Math.min(w * 0.26, 160);

      type Rung = { x1: number; y1: number; z1: number; x2: number; y2: number; z2: number; amp: number; t: number; };
      const rungs: Rung[] = [];

      for (let i = 0; i < RUNGS; i++) {
        const t     = i / (RUNGS - 1);
        const y     = cy - HELIX_H / 2 + t * HELIX_H;
        const angle = t * Math.PI * 4 + phase;
        const amp   = b[Math.floor(t * (BAR_COUNT - 1))];
        const r     = HELIX_R * (1 + amp * 0.18);
        rungs.push({
          x1: cx + Math.cos(angle) * r,         y1: y, z1: Math.sin(angle),
          x2: cx + Math.cos(angle + Math.PI) * r, y2: y, z2: Math.sin(angle + Math.PI),
          amp, t,
        });
      }

      ctx.lineCap = "round";
      // backbone lines
      for (let i = 0; i < rungs.length - 1; i++) {
        const a = rungs[i];
        const n = rungs[i + 1];
        const h1 = (primHue + a.t * 240) % 360;
        const h2 = (secHue  + a.t * 240) % 360;
        ctx.shadowBlur  = 3 + a.amp * 10;
        ctx.lineWidth   = 1.5 + a.amp * 2;
        ctx.shadowColor = `hsl(${h1},100%,60%)`;
        ctx.strokeStyle = `hsla(${h1},100%,50%,${Math.max(0.05, 0.25 + (a.z1 + n.z1) * 0.15)})`;
        ctx.beginPath(); ctx.moveTo(a.x1, a.y1); ctx.lineTo(n.x1, n.y1); ctx.stroke();
        ctx.shadowColor = `hsl(${h2},100%,60%)`;
        ctx.strokeStyle = `hsla(${h2},100%,50%,${Math.max(0.05, 0.25 + (a.z2 + n.z2) * 0.15)})`;
        ctx.beginPath(); ctx.moveTo(a.x2, a.y2); ctx.lineTo(n.x2, n.y2); ctx.stroke();
      }
      ctx.shadowBlur = 0;

      const sorted = rungs.slice().sort((a, r2) => (a.z1 + a.z2) - (r2.z1 + r2.z2));
      for (const rung of sorted) {
        const h1      = (primHue + rung.t * 240) % 360;
        const h2      = (secHue  + rung.t * 240) % 360;
        const midHue  = (h1 + h2) / 2;
        const zAlpha  = (Math.abs(rung.z1) + Math.abs(rung.z2)) * 0.3 + rung.amp * 0.55;
        ctx.strokeStyle = `hsla(${midHue},75%,65%,${Math.max(0.08, zAlpha * 0.65)})`;
        ctx.lineWidth   = 1 + rung.amp * 2.5;
        ctx.shadowColor = `hsl(${midHue},100%,70%)`;
        ctx.shadowBlur  = 5 + rung.amp * 14;
        ctx.beginPath(); ctx.moveTo(rung.x1, rung.y1); ctx.lineTo(rung.x2, rung.y2); ctx.stroke();
        ctx.shadowBlur = 0;

        for (const [px, py, hz, zv] of [[rung.x1, rung.y1, h1, rung.z1], [rung.x2, rung.y2, h2, rung.z2]] as [number,number,number,number][]) {
          const rr = Math.max(0.1, 3 + rung.amp * 6 + zv * 1.5);
          const aa = Math.max(0.05, 0.4 + zv * 0.5 + rung.amp * 0.3);
          const g  = ctx.createRadialGradient(px, py, 0, px, py, rr);
          g.addColorStop(0, `hsla(${hz},100%,85%,${aa})`);
          g.addColorStop(1, "transparent");
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(px, py, rr, 0, Math.PI * 2); ctx.fill();
        }
      }
    }

    // ─── MELT ─────────────────────────────────────────────────────────────────

    function drawMelt(ctx: CanvasRenderingContext2D, w: number, h: number, b: number[], c: VisualizerColors["melt"]) {
      ctx.fillStyle = "rgba(2,0,8,0.10)";
      ctx.fillRect(0, 0, w, h);

      const cx      = w / 2;
      const cy      = h / 2;
      const dim     = Math.min(w, h);
      const bass    = b[0];
      const high    = b[22];
      const primHue = hexToHue(c.primary);
      const secHue  = hexToHue(c.secondary);
      const now     = Date.now();

      ctx.save();
      ctx.globalCompositeOperation = "screen";

      for (let i = 0; i < 12; i++) {
        const sp  = 0.00014 * (1 + i * 0.28);
        const bx  = cx + Math.sin(now * sp        + i * 1.74) * w * 0.45;
        const by  = cy + Math.cos(now * sp * 0.70 + i * 2.31) * h * 0.45;
        const amp = b[Math.floor((i / 12) * BAR_COUNT)];
        const br  = dim * (0.17 + amp * 0.28 + bass * 0.12);
        const hue = (primHue + now * 0.008 + i * 30) % 360;
        const g   = ctx.createRadialGradient(bx, by, 0, bx, by, br);
        g.addColorStop(0,   `hsla(${hue},100%,50%,${0.09 + amp * 0.19})`);
        g.addColorStop(0.5, `hsla(${hue},80%,35%,0.04)`);
        g.addColorStop(1,   "transparent");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }

      for (let i = 0; i < 8; i++) {
        const sp  = 0.00038 * (1 + i * 0.55);
        const bx  = cx + Math.sin(now * sp        + i * 2.13 + Math.PI) * w * 0.36;
        const by  = cy + Math.cos(now * sp * 0.83 + i * 1.91)            * h * 0.36;
        const amp = b[Math.floor((20 + i * 1.5) % BAR_COUNT)];
        const br  = dim * (0.055 + amp * 0.13 + high * 0.09);
        const hue = (secHue + now * 0.018 + i * 45 + 180) % 360;
        const g   = ctx.createRadialGradient(bx, by, 0, bx, by, br);
        g.addColorStop(0,   `hsla(${hue},100%,68%,${0.14 + amp * 0.33})`);
        g.addColorStop(0.4, `hsla(${hue},80%,40%,0.05)`);
        g.addColorStop(1,   "transparent");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }

      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 + now * 0.00025 * (i % 2 === 0 ? 1 : -0.75);
        const amp   = b[Math.floor((i / 6) * BAR_COUNT)];
        const gx1   = cx + Math.cos(angle) * dim * 0.65;
        const gy1   = cy + Math.sin(angle) * dim * 0.65;
        const gx2   = cx - Math.cos(angle) * dim * 0.65;
        const gy2   = cy - Math.sin(angle) * dim * 0.65;
        const hue   = (primHue + i * 60 + now * 0.012) % 360;
        const g     = ctx.createLinearGradient(gx1, gy1, gx2, gy2);
        const a     = 0.03 + amp * 0.14 + bass * 0.06;
        g.addColorStop(0,    "transparent");
        g.addColorStop(0.38, `hsla(${hue},100%,40%,${a})`);
        g.addColorStop(0.62, `hsla(${hue},100%,40%,${a})`);
        g.addColorStop(1,    "transparent");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
      ctx.restore();

      if (beatDetect(bass)) {
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        const fg = ctx.createRadialGradient(cx, cy, 0, cx, cy, dim * 0.62);
        fg.addColorStop(0, `hsla(${primHue},100%,90%,0.14)`);
        fg.addColorStop(1, "transparent");
        ctx.fillStyle = fg;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }

      const vg = ctx.createRadialGradient(cx, cy, dim * 0.18, cx, cy, dim * 0.80);
      vg.addColorStop(0, "transparent");
      vg.addColorStop(1, "rgba(0,0,0,0.55)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.globalAlpha = 0.03;
      ctx.fillStyle   = "#000";
      for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
      ctx.restore();
    }

    // ─── NOVA ─────────────────────────────────────────────────────────────────

    function drawNova(ctx: CanvasRenderingContext2D, w: number, h: number, b: number[], c: VisualizerColors["nova"]) {
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.fillRect(0, 0, w, h);

      const cx       = w / 2;
      const cy       = h / 2;
      const dim      = Math.min(w, h);
      const bass     = b[0];
      const mid      = b[10];
      const high     = b[22];
      const beat     = beatDetect(bass);
      const primHue  = hexToHue(c.primary);
      const secHue   = hexToHue(c.secondary);
      const now      = Date.now();
      const colorT   = (now / 10000) % 1;

      novaAngleRef.current += 0.006 + bass * 0.035;
      const rot = novaAngleRef.current;

      ctx.save();
      ctx.globalCompositeOperation = "screen";
      for (let ni = 0; ni < 4; ni++) {
        const a  = rot * 0.4 + ni * (Math.PI / 2);
        const d  = dim * (0.20 + b[ni * 6] * 0.18);
        const nx = cx + Math.cos(a) * d;
        const ny = cy + Math.sin(a) * d;
        const r  = dim * (0.28 + b[ni * 6] * 0.22 + bass * 0.10);
        const hue = (primHue + ni * 90 + colorT * 60) % 360;
        const g = ctx.createRadialGradient(nx, ny, 0, nx, ny, r);
        g.addColorStop(0,   `hsla(${hue},100%,55%,${0.10 + b[ni * 6] * 0.18})`);
        g.addColorStop(0.5, `hsla(${hue},80%,35%,0.04)`);
        g.addColorStop(1,   "transparent");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
      ctx.restore();

      const RAY_COUNT = BAR_COUNT * 2;
      const innerR = dim * 0.06;
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.lineCap = "round";
      for (let i = 0; i < RAY_COUNT; i++) {
        const fi    = i < BAR_COUNT ? i : BAR_COUNT - 1 - (i - BAR_COUNT);
        const angle = (i / RAY_COUNT) * Math.PI * 2 + rot * 0.3;
        const amp   = b[fi % BAR_COUNT];
        const len   = innerR + amp * dim * 0.38;
        const hue   = (primHue + (i / RAY_COUNT) * 180 + colorT * 120) % 360;
        ctx.strokeStyle = `hsla(${hue},100%,60%,${0.08 + amp * 0.18})`;
        ctx.lineWidth   = 6 + amp * 20;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * innerR, cy + Math.sin(angle) * innerR);
        ctx.lineTo(cx + Math.cos(angle) * len,    cy + Math.sin(angle) * len);
        ctx.stroke();
        ctx.strokeStyle = `hsla(${hue},100%,80%,${0.35 + amp * 0.55})`;
        ctx.lineWidth   = 0.8 + amp * 2.5;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * innerR, cy + Math.sin(angle) * innerR);
        ctx.lineTo(cx + Math.cos(angle) * len,    cy + Math.sin(angle) * len);
        ctx.stroke();
      }
      ctx.restore();

      ctx.save();
      ctx.globalCompositeOperation = "screen";
      for (let ri = 0; ri < 6; ri++) {
        const t    = ((now * 0.00015 + ri / 6) % 1);
        const r    = t * dim * 0.55;
        const amp  = b[Math.floor(ri * 5)];
        const hue  = (secHue + ri * 60 + colorT * 180) % 360;
        const alpha = (1 - t) * (0.25 + amp * 0.40);
        ctx.strokeStyle = `hsla(${hue},100%,65%,${alpha})`;
        ctx.lineWidth   = (1 - t) * (2 + amp * 6);
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(1, r), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      if (beat) {
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        for (let i = 0; i < 32; i++) {
          const angle  = (i / 32) * Math.PI * 2 + rot;
          const endR   = dim * (0.12 + Math.random() * 0.38);
          const hue    = (primHue + i * 11 + colorT * 240) % 360;
          ctx.strokeStyle = `hsla(${hue},100%,70%,${0.5 + Math.random() * 0.4})`;
          ctx.lineWidth   = 0.6 + Math.random() * 2.5;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(angle) * innerR, cy + Math.sin(angle) * innerR);
          ctx.lineTo(cx + Math.cos(angle) * endR,   cy + Math.sin(angle) * endR);
          ctx.stroke();
        }
        ctx.restore();
      }

      const PETALS = 8;
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      for (let pi = 0; pi < PETALS; pi++) {
        const pAngle = (pi / PETALS) * Math.PI * 2 + rot * 1.4;
        const pAmp   = b[Math.floor((pi / PETALS) * BAR_COUNT)];
        const pLen   = dim * (0.08 + pAmp * 0.18 + mid * 0.10);
        const pHue   = (secHue + pi * (360 / PETALS) + colorT * 60) % 360;
        ctx.strokeStyle = `hsla(${pHue},100%,65%,${0.20 + pAmp * 0.45})`;
        ctx.lineWidth   = 2 + pAmp * 8;
        ctx.lineCap     = "round";
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        const cp1x = cx + Math.cos(pAngle - 0.5) * pLen * 0.6;
        const cp1y = cy + Math.sin(pAngle - 0.5) * pLen * 0.6;
        const cp2x = cx + Math.cos(pAngle + 0.5) * pLen * 0.6;
        const cp2y = cy + Math.sin(pAngle + 0.5) * pLen * 0.6;
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, cx + Math.cos(pAngle) * pLen, cy + Math.sin(pAngle) * pLen);
        ctx.stroke();
      }
      ctx.restore();

      const coreR = dim * (0.04 + bass * 0.08 + high * 0.04);
      const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
      cg.addColorStop(0,    `rgba(255,255,255,${0.7 + bass * 0.3})`);
      cg.addColorStop(0.35, `hsla(${primHue},100%,70%,${0.4 + bass * 0.4})`);
      cg.addColorStop(1,    "transparent");
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.fill();
    }

    // ─── SPIRAL ───────────────────────────────────────────────────────────────

    function drawSpiral(ctx: CanvasRenderingContext2D, w: number, h: number, b: number[], c: VisualizerColors["spiral"]) {
      ctx.fillStyle = "rgba(0,0,6,0.14)";
      ctx.fillRect(0, 0, w, h);

      const cx      = w / 2;
      const cy      = h / 2;
      const dim     = Math.min(w, h);
      const bass    = b[0];
      const mid     = b[10];
      const beat    = beatDetect(bass);
      const primHue = hexToHue(c.primary);
      const secHue  = hexToHue(c.secondary);
      const colorT  = (Date.now() / 9000) % 1;

      spiralAngleRef.current += 0.008 + bass * 0.045;
      const rot = spiralAngleRef.current;

      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const t2 = Date.now() * 0.00028;
      for (let ai = 0; ai < 3; ai++) {
        const a   = t2 * (0.5 + ai * 0.3) + ai * 2.1;
        const ax  = cx + Math.cos(a) * dim * 0.25;
        const ay  = cy + Math.sin(a) * dim * 0.22;
        const ar  = dim * (0.32 + b[ai * 8] * 0.28 + bass * 0.10);
        const hue = (primHue + ai * 120 + colorT * 60) % 360;
        const g   = ctx.createRadialGradient(ax, ay, 0, ax, ay, ar);
        g.addColorStop(0,   `hsla(${hue},100%,50%,${0.12 + b[ai * 8] * 0.16})`);
        g.addColorStop(0.5, `hsla(${hue},80%,30%,0.04)`);
        g.addColorStop(1,   "transparent");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
      ctx.restore();

      const ARMS  = 3;
      const TURNS = 3.5;
      const STEPS = 180;
      const maxR  = dim * 0.46;

      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.lineCap = "round";

      for (let arm = 0; arm < ARMS; arm++) {
        const armOffset = (arm / ARMS) * Math.PI * 2;
        ctx.lineWidth = 12 + bass * 28;
        ctx.beginPath();
        for (let si = 0; si <= STEPS; si++) {
          const t     = si / STEPS;
          const angle = t * TURNS * Math.PI * 2 + rot + armOffset;
          const r     = t * maxR * (1 + b[Math.floor(t * (BAR_COUNT - 1))] * 0.30);
          const hue   = (primHue + arm * (360 / ARMS) + t * 120 + colorT * 60) % 360;
          const alpha = 0.04 + t * 0.10 + b[Math.floor(t * (BAR_COUNT - 1))] * 0.08;
          ctx.strokeStyle = `hsla(${hue},100%,55%,${alpha})`;
          const px = cx + Math.cos(angle) * r;
          const py = cy + Math.sin(angle) * r;
          if (si === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let si = 0; si <= STEPS; si++) {
          const t     = si / STEPS;
          const angle = t * TURNS * Math.PI * 2 + rot + armOffset;
          const r     = t * maxR * (1 + b[Math.floor(t * (BAR_COUNT - 1))] * 0.30);
          const hue   = (primHue + arm * (360 / ARMS) + t * 120 + colorT * 60) % 360;
          const alpha = 0.25 + t * 0.55 + b[Math.floor(t * (BAR_COUNT - 1))] * 0.20;
          ctx.strokeStyle = `hsla(${hue},100%,75%,${alpha})`;
          const px = cx + Math.cos(angle) * r;
          const py = cy + Math.sin(angle) * r;
          if (si === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      ctx.restore();

      ctx.save();
      ctx.globalCompositeOperation = "screen";
      for (let i = 0; i < BAR_COUNT; i++) {
        const t     = i / BAR_COUNT;
        const arm   = i % ARMS;
        const angle = t * TURNS * Math.PI * 2 + rot + (arm / ARMS) * Math.PI * 2;
        const r     = t * maxR * (1 + b[i] * 0.30);
        const dotR  = 1.5 + b[i] * 9;
        const hue   = (secHue + i * (360 / BAR_COUNT) + colorT * 80) % 360;
        const px    = cx + Math.cos(angle) * r;
        const py    = cy + Math.sin(angle) * r;
        const g     = ctx.createRadialGradient(px, py, 0, px, py, dotR);
        g.addColorStop(0, `hsla(${hue},100%,88%,${0.45 + b[i] * 0.50})`);
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, dotR, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      if (beat) {
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        for (let i = 0; i < 24; i++) {
          const angle  = (i / 24) * Math.PI * 2 + rot;
          const endR   = 20 + Math.random() * dim * 0.35;
          const hue    = (primHue + i * 15 + colorT * 180) % 360;
          ctx.strokeStyle = `hsla(${hue},100%,65%,${0.45 + Math.random() * 0.45})`;
          ctx.lineWidth   = 0.5 + Math.random() * 2;
          ctx.lineCap     = "round";
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(angle) * endR, cy + Math.sin(angle) * endR);
          ctx.stroke();
        }
        ctx.restore();
      }

      const ringR = dim * 0.06 * (1 + mid * 0.8);
      const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, ringR);
      rg.addColorStop(0,   `hsla(${secHue},100%,90%,${0.55 + bass * 0.45})`);
      rg.addColorStop(0.6, `hsla(${primHue},100%,65%,${0.30 + bass * 0.35})`);
      rg.addColorStop(1,   "transparent");
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
      ctx.fill();
    }

    // ─── AURORA ───────────────────────────────────────────────────────────────

    function drawAurora(ctx: CanvasRenderingContext2D, w: number, h: number, b: number[], c: VisualizerColors["aurora"]) {
      ctx.fillStyle = "rgba(0,2,12,0.18)";
      ctx.fillRect(0, 0, w, h);

      const bass    = b[0];
      const primHue = hexToHue(c.primary);
      const secHue  = hexToHue(c.secondary);
      const beat    = beatDetect(bass);
      const now     = Date.now();

      auroraPhaseRef.current = (auroraPhaseRef.current + 0.003 + bass * 0.006) % (Math.PI * 2);
      const phase = auroraPhaseRef.current;

      ctx.save();
      for (let si = 0; si < 80; si++) {
        const sx      = (si * 137.5 + 7) % w;
        const sy      = (si * 61.8  + 3) % (h * 0.75);
        const twinkle = 0.3 + 0.4 * Math.sin(now * 0.0007 * (0.5 + (si % 7) * 0.15) + si);
        ctx.globalAlpha = twinkle * 0.7;
        ctx.fillStyle   = `hsl(${(primHue + si * 5) % 360},50%,90%)`;
        ctx.beginPath();
        ctx.arc(sx, sy, 0.5 + (si % 3) * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      const BANDS = 9;
      ctx.save();
      ctx.globalCompositeOperation = "screen";

      for (let bi = 0; bi < BANDS; bi++) {
        const t       = bi / BANDS;
        const freqIdx = Math.floor(t * (BAR_COUNT - 1));
        const amp     = b[freqIdx];
        const baseY   = h * (0.08 + t * 0.62);
        const drift   = phase * (0.7 + t * 0.6) + bi * 1.3;
        const hue     = (primHue + t * 180 + (bi % 2 === 0 ? 0 : (secHue - primHue + 360) % 360) + now * 0.003) % 360;
        const bandH   = h * (0.04 + amp * 0.18 + bass * 0.06);
        const alpha   = 0.06 + amp * 0.22 + (beat ? 0.08 : 0);

        const bodyGrad = ctx.createLinearGradient(0, baseY - bandH, 0, baseY + bandH);
        bodyGrad.addColorStop(0,   "transparent");
        bodyGrad.addColorStop(0.3, `hsla(${hue},100%,55%,${alpha * 0.5})`);
        bodyGrad.addColorStop(0.5, `hsla(${hue},100%,60%,${alpha})`);
        bodyGrad.addColorStop(0.7, `hsla(${hue},100%,55%,${alpha * 0.5})`);
        bodyGrad.addColorStop(1,   "transparent");
        ctx.fillStyle = bodyGrad;
        ctx.fillRect(0, baseY - bandH, w, bandH * 2);

        ctx.strokeStyle = `hsla(${hue},100%,70%,${0.12 + amp * 0.35})`;
        ctx.lineWidth   = 0.8 + amp * 3;
        ctx.beginPath();
        for (let xi = 0; xi <= 120; xi++) {
          const xt  = xi / 120;
          const sx  = xt * w;
          const wave =
            Math.sin(xt * Math.PI * 4 + drift)       * bandH * 0.55 +
            Math.sin(xt * Math.PI * 7 - drift * 0.7) * bandH * 0.25 +
            Math.sin(xt * Math.PI * 2 + drift * 0.3) * bandH * 0.20;
          const sy = baseY + wave;
          if (xi === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
        }
        ctx.stroke();

        const RAY_COUNT = 12 + Math.floor(amp * 8);
        for (let ri = 0; ri < RAY_COUNT; ri++) {
          const rx       = ((ri / RAY_COUNT) * w + now * 0.005 * (bi % 2 === 0 ? 1 : -0.7)) % w;
          const rayH     = bandH * (0.5 + amp * 1.5);
          const rayAlpha = 0.03 + amp * 0.14;
          const rayGrad  = ctx.createLinearGradient(0, baseY, 0, baseY - rayH);
          rayGrad.addColorStop(0,   `hsla(${hue},100%,65%,${rayAlpha})`);
          rayGrad.addColorStop(0.6, `hsla(${(hue + 30) % 360},100%,75%,${rayAlpha * 0.4})`);
          rayGrad.addColorStop(1,   "transparent");
          ctx.fillStyle = rayGrad;
          ctx.fillRect(rx - 1, baseY - rayH, 2.5, rayH);
        }
      }
      ctx.restore();

      const horizonY = h * 0.70;
      const hg = ctx.createLinearGradient(0, horizonY - 30, 0, horizonY + 60);
      hg.addColorStop(0,   "transparent");
      hg.addColorStop(0.4, `hsla(${primHue},80%,50%,${0.04 + bass * 0.10})`);
      hg.addColorStop(1,   "transparent");
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = hg;
      ctx.fillRect(0, horizonY - 30, w, 90);
      ctx.restore();

      if (beat) {
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        const fg = ctx.createLinearGradient(0, 0, 0, h * 0.7);
        fg.addColorStop(0,   `hsla(${(primHue + 60) % 360},100%,70%,0.08)`);
        fg.addColorStop(0.5, `hsla(${primHue},100%,60%,0.04)`);
        fg.addColorStop(1,   "transparent");
        ctx.fillStyle = fg;
        ctx.fillRect(0, 0, w, h * 0.7);
        ctx.restore();
      }
    }

    // ─── main loop ────────────────────────────────────────────────────────────

    const draw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) { rafRef.current = requestAnimationFrame(draw); return; }

      const [w, h]    = ensureSize(ctx);
      const target    = bandDataRef.current;
      const displayed = displayedRef.current;
      const c         = colorsRef.current;

      for (let i = 0; i < BAR_COUNT; i++) {
        displayed[i] = target[i] > displayed[i]
          ? displayed[i] * 0.65 + target[i] * 0.35
          : displayed[i] * 0.80 + target[i] * 0.20;
      }

      switch (MODES[modeIndexRef.current]) {
        case "bars":      drawBars(ctx, w, h, displayed, c.bars);           break;
        case "alchemy":   drawAlchemy(ctx, w, h, displayed, c.alchemy);     break;
        case "plasma":    drawPlasma(ctx, w, h, displayed, c.plasma);       break;
        case "vortex":    drawVortex(ctx, w, h, displayed, c.vortex);       break;
        case "radial":    drawRadial(ctx, w, h, displayed, c.radial);       break;
        case "synthgrid": drawSynthgrid(ctx, w, h, displayed, c.synthgrid); break;
        case "tunnel":    drawTunnel(ctx, w, h, displayed, c.tunnel);       break;
        case "ocean":     drawOcean(ctx, w, h, displayed, c.ocean);         break;
        case "artwork":   drawArtwork(ctx, w, h, displayed);                break;
        case "warp":      drawWarp(ctx, w, h, displayed, c.warp);          break;
        case "hypno":     drawHypno(ctx, w, h, displayed, c.hypno);        break;
        case "dna":       drawDna(ctx, w, h, displayed, c.dna);            break;
        case "melt":      drawMelt(ctx, w, h, displayed, c.melt);          break;
        case "nova":      drawNova(ctx, w, h, displayed, c.nova);          break;
        case "spiral":    drawSpiral(ctx, w, h, displayed, c.spiral);      break;
        case "aurora":    drawAurora(ctx, w, h, displayed, c.aurora);      break;
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      unlistenPromise.then((fn) => fn());
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: "block", width: "100%", height: "100%", ...style }}
    />
  );
}
