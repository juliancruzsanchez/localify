import type { Mode } from "@/components/player/Visualizer";

export function renderPreview(mode: Mode, ctx: CanvasRenderingContext2D, w: number, h: number) {
  const cx = w / 2, cy = h / 2, dim = Math.min(w, h);
  const mock = (i: number) => 0.5 + Math.sin(i * 0.7) * 0.25;

  switch (mode) {
    case "bars":
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);
      const bw = (w - 2 * 31) / 32;
      for (let i = 0; i < 32; i++) {
        const bh = mock(i) * h * 0.55;
        const x = i * (bw + 2), y = h * 0.22 - bh;
        const g = ctx.createLinearGradient(0, y, 0, h * 0.22);
        g.addColorStop(0, "#4af");
        g.addColorStop(1, "#26a");
        ctx.fillStyle = g;
        ctx.fillRect(x, y, bw, bh);
      }
      break;

    case "alchemy":
      ctx.fillStyle = "#04000c";
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 7; i++) {
        const bx = cx + Math.sin(i * 1.2) * w * 0.2;
        const by = cy + Math.cos(i * 0.9) * h * 0.18;
        const br = dim * 0.5 * (0.88 + mock(i * 4) * 0.3);
        const g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
        g.addColorStop(0, `hsla(${(i * 50 + 278) % 360},100%,50%,0.5)`);
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
      break;

    case "plasma":
      ctx.fillStyle = "#000414";
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 4; i++) {
        const bx = cx + Math.sin(i * 1.5) * w * 0.15;
        const by = cy + Math.cos(i * 1.1) * h * 0.15;
        const br = dim * 0.4 * (0.5 + mock(i * 3) * 0.2);
        const g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
        g.addColorStop(0, `hsla(${(i * 60 + 260) % 360},70%,55%,0.2)`);
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
      ctx.beginPath();
      ctx.arc(cx, cy, dim * 0.15, 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(200,100%,70%,0.4)`;
      ctx.lineWidth = 3;
      ctx.stroke();
      break;

    case "vortex":
      for (let r = 0; r < 20; r++) {
        const t = r / 20;
        const angle = t * Math.PI * 6;
        const len = dim * (0.12 + t * 0.35);
        const hue = (t * 60 + 200) % 360;
        ctx.strokeStyle = `hsla(${hue},100%,55%,${0.4 + t * 0.3})`;
        ctx.lineWidth = 1.5 + t * 8;
        ctx.shadowColor = `hsl(${hue},100%,48%)`;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      break;

    case "radial":
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 32; i++) {
        const angle = (i / 32) * Math.PI * 2 - Math.PI / 2;
        const len = mock(i) * dim * 0.35;
        const hue = (i * 11.25 + 200) % 360;
        ctx.strokeStyle = `hsl(${hue},100%,62%)`;
        ctx.lineWidth = dim * 0.75 / 32 * 0.5;
        ctx.shadowColor = `hsl(${hue},100%,62%)`;
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * dim * 0.09, cy + Math.sin(angle) * dim * 0.09);
        ctx.lineTo(cx + Math.cos(angle) * (dim * 0.09 + len), cy + Math.sin(angle) * (dim * 0.09 + len));
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      break;

    case "synthgrid":
      const horizonY = h * 0.44;
      ctx.fillStyle = "#00000f";
      ctx.fillRect(0, 0, w, horizonY);
      ctx.fillStyle = "#060010";
      ctx.fillRect(0, horizonY, w, h - horizonY);
      const sunG = ctx.createRadialGradient(cx, horizonY * 0.8, 0, cx, horizonY * 0.8, dim * 0.2);
      sunG.addColorStop(0, "#ff5a28");
      sunG.addColorStop(1, "transparent");
      ctx.fillStyle = sunG;
      ctx.fillRect(0, 0, w, horizonY);
      for (let i = 0; i < 10; i++) {
        const y = horizonY + (h - horizonY) * Math.pow((i + 0.5) / 10, 2.3);
        ctx.strokeStyle = `hsla(260,100%,60%,${0.1 + (i / 10) * 0.5})`;
        ctx.lineWidth = 0.5 + (i / 10) * 2;
        ctx.beginPath();
        ctx.moveTo(0, y); ctx.lineTo(w, y);
        ctx.stroke();
      }
      for (let j = -8; j <= 8; j++) {
        if (j === 0) continue;
        const bx = cx + (j / 8) * w * 0.5;
        ctx.strokeStyle = `hsla(320,80%,55%,0.3)`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(cx, horizonY);
        ctx.lineTo(bx, h);
        ctx.stroke();
      }
      break;

    case "tunnel":
      for (let i = 23; i >= 0; i--) {
        const t = i / 24;
        const r = t * dim * 0.65;
        const hue = (t * 180 + 200) % 360;
        ctx.strokeStyle = `hsla(${hue},100%,55%,${0.25 + t * 0.5})`;
        ctx.lineWidth = 0.8 + t * 3;
        ctx.shadowColor = `hsl(${hue},100%,60%)`;
        ctx.shadowBlur = 8 + t * 15;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      break;

    case "ocean":
      ctx.fillStyle = "#00081c";
      ctx.fillRect(0, 0, w, h);
      const oh = h * 0.38;
      for (let i = 0; i < 20; i++) {
        const depth = (i + 0.5) / 20;
        const y = oh + (h - oh) * Math.pow(depth, 1.6);
        const hue = (220 + depth * 40) % 360;
        ctx.strokeStyle = `hsla(${hue},80%,50%,${0.15 + depth * 0.5})`;
        ctx.lineWidth = 0.4 + depth * 2;
        ctx.beginPath();
        ctx.moveTo(0, y + Math.sin(i * 0.6) * 10);
        for (let x = 0; x <= w; x += 5) {
          ctx.lineTo(x, y + Math.sin(x * 0.03 + i * 0.6) * (8 + depth * 12));
        }
        ctx.stroke();
      }
      break;

    case "artwork":
      ctx.fillStyle = "#010106";
      ctx.fillRect(0, 0, w, h);
      const as = dim * 0.22;
      const ag = ctx.createRadialGradient(cx, cy, as / 2, cx, cy, as / 2 + 20);
      ag.addColorStop(0, "rgba(0,100,200,0.3)");
      ag.addColorStop(1, "transparent");
      ctx.fillStyle = ag;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "rgba(30,30,60,0.5)";
      ctx.beginPath();
      ctx.roundRect(cx - as / 2, cy - as / 2, as, as, as * 0.07);
      ctx.fill();
      break;

    case "warp":
      // Starfield
      for (let i = 0; i < 100; i++) {
        const t = i / 100;
        const sx = cx + Math.sin(i * 7.3) * w * 0.3;
        const sy = cy + Math.cos(i * 5.1) * h * 0.3;
        const px = cx + Math.sin(i * 7.3) * w * 0.05;
        const py = cy + Math.cos(i * 5.1) * h * 0.05;
        const hue = (i * 3.6 + 200) % 360;
        ctx.strokeStyle = `hsla(${hue},100%,60%,${t * 0.7})`;
        ctx.lineWidth = t * 1.5;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(sx, sy);
        ctx.stroke();
      }
      // Nebula clouds
      const nbTime = Date.now() * 0.00015;
      for (let ni = 0; ni < 3; ni++) {
        const a = nbTime + (ni / 3) * Math.PI * 2;
        const d = 30 + 60;
        const nx = cx + Math.cos(a) * d;
        const ny = cy + Math.sin(a) * d;
        const sz = 60 + 80;
        const hue = ni % 2 === 0 ? 200 : 300;
        const g = ctx.createRadialGradient(nx, ny, 0, nx, ny, sz);
        g.addColorStop(0, `hsla(${hue + ni * 30},90%,55%,0.06)`);
        g.addColorStop(1, "transparent");
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }
      // Pulse rings
      for (let ri = 0; ri < 3; ri++) {
        const r = 40 + ri * 45;
        const hue = (300 + ri * 60) % 360;
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.strokeStyle = `hsla(${hue},100%,65%,${0.25 - ri * 0.07})`;
        ctx.lineWidth = 2 + ri * 0.5;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      // Light rays
      for (let ri = 0; ri < 16; ri++) {
        const a = (ri / 16) * Math.PI * 2;
        const len = 30 + Math.sin(ri * 2.3) * 60;
        const hue = (200 + ri * 30) % 360;
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.strokeStyle = `hsla(${hue},100%,60%,${0.08 + Math.sin(ri * 1.7) * 0.06})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
        ctx.stroke();
        ctx.restore();
      }
      break;

    case "hypno":
      for (let i = 0; i < 15; i++) {
        const t = (14 - i) / 14;
        const r = dim * (0.02 + t * 0.48) * 0.9;
        const hue = i % 2 === 0 ? (200 + i * 18) % 360 : (320 + i * 18) % 360;
        ctx.strokeStyle = `hsla(${hue},100%,55%,${0.35 + t * 0.4})`;
        ctx.lineWidth = 0.8 + t * 2;
        ctx.shadowColor = `hsl(${hue},100%,65%)`;
        ctx.shadowBlur = 4 + t * 12;
        ctx.beginPath();
        for (let s = 0; s <= 6; s++) {
          const angle = (s / 6) * Math.PI * 2 + i * 0.3;
          const px = cx + Math.cos(angle) * r;
          const py = cy + Math.sin(angle) * r;
          s === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      break;

    case "dna":
      const hh = Math.min(h * 0.8, 200);
      const hr = Math.min(w * 0.2, 50);
      for (let i = 0; i < 24; i++) {
        const t = i / 23;
        const y = cy - hh / 2 + t * hh;
        const angle = t * Math.PI * 4;
        const r = hr * 0.85;
        const hue = (200 + t * 240) % 360;
        ctx.strokeStyle = `hsla(${hue},80%,55%,0.5)`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * r, y);
        ctx.lineTo(cx + Math.cos(angle + Math.PI) * r, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx + Math.cos(angle) * r, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue},100%,80%,0.7)`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + Math.cos(angle + Math.PI) * r, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      break;

    case "melt":
      for (let i = 0; i < 10; i++) {
        const bx = cx + Math.sin(i * 1.7) * w * 0.35;
        const by = cy + Math.cos(i * 2.3) * h * 0.35;
        const br = dim * 0.2;
        const hue = (200 + i * 30) % 360;
        const g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
        g.addColorStop(0, `hsla(${hue},100%,50%,0.15)`);
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
      break;

    case "nova":
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);
      // Radial rays
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      for (let i = 0; i < 64; i++) {
        const angle = (i / 64) * Math.PI * 2;
        const amp   = 0.5 + Math.sin(i * 0.7) * 0.25;
        const len   = dim * 0.1 + amp * dim * 0.32;
        const hue   = (200 + (i / 64) * 180) % 360;
        ctx.strokeStyle = `hsla(${hue},100%,65%,${0.25 + amp * 0.40})`;
        ctx.lineWidth   = 0.8 + amp * 2;
        ctx.lineCap     = "round";
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * dim * 0.08, cy + Math.sin(angle) * dim * 0.08);
        ctx.lineTo(cx + Math.cos(angle) * len,        cy + Math.sin(angle) * len);
        ctx.stroke();
      }
      // Shockwave rings
      for (let ri = 0; ri < 4; ri++) {
        const r   = dim * (0.12 + ri * 0.09);
        const hue = (200 + ri * 50) % 360;
        ctx.strokeStyle = `hsla(${hue},100%,60%,${0.35 - ri * 0.06})`;
        ctx.lineWidth   = 1.5 - ri * 0.3;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
      // Core glow
      const novaCG = ctx.createRadialGradient(cx, cy, 0, cx, cy, dim * 0.08);
      novaCG.addColorStop(0, "rgba(255,255,255,0.9)");
      novaCG.addColorStop(0.4, "hsla(30,100%,65%,0.5)");
      novaCG.addColorStop(1, "transparent");
      ctx.fillStyle = novaCG;
      ctx.beginPath();
      ctx.arc(cx, cy, dim * 0.08, 0, Math.PI * 2);
      ctx.fill();
      break;

    case "spiral":
      ctx.fillStyle = "#000006";
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.lineCap = "round";
      for (let arm = 0; arm < 3; arm++) {
        const armOff = (arm / 3) * Math.PI * 2;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let si = 0; si <= 160; si++) {
          const t     = si / 160;
          const angle = t * 3.5 * Math.PI * 2 + armOff;
          const r     = t * dim * 0.42 * (1 + mock(si) * 0.25);
          const hue   = (200 + arm * 120 + t * 100) % 360;
          const alpha = 0.20 + t * 0.60;
          ctx.strokeStyle = `hsla(${hue},100%,70%,${alpha})`;
          const px = cx + Math.cos(angle) * r;
          const py = cy + Math.sin(angle) * r;
          if (si === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      // dots along spiral
      for (let i = 0; i < 32; i++) {
        const t     = i / 32;
        const arm   = i % 3;
        const angle = t * 3.5 * Math.PI * 2 + (arm / 3) * Math.PI * 2;
        const r     = t * dim * 0.42;
        const hue   = (300 + i * 11) % 360;
        const g     = ctx.createRadialGradient(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, 0, cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, 3 + mock(i) * 5);
        g.addColorStop(0, `hsla(${hue},100%,90%,0.8)`);
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, 3 + mock(i) * 5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      break;

    case "aurora":
      ctx.fillStyle = "#00020c";
      ctx.fillRect(0, 0, w, h);
      // stars
      for (let si = 0; si < 50; si++) {
        ctx.globalAlpha = 0.4 + 0.3 * Math.sin(si * 1.3);
        ctx.fillStyle = "#ccddff";
        ctx.beginPath();
        ctx.arc((si * 137.5 + 7) % w, (si * 61.8 + 3) % (h * 0.7), 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      for (let bi = 0; bi < 7; bi++) {
        const t     = bi / 7;
        const baseY = h * (0.10 + t * 0.55);
        const amp   = 0.5 + Math.sin(bi * 0.9) * 0.3;
        const bandH = h * (0.04 + amp * 0.10);
        const hue   = (120 + t * 180) % 360;
        const bg    = ctx.createLinearGradient(0, baseY - bandH, 0, baseY + bandH);
        bg.addColorStop(0,   "transparent");
        bg.addColorStop(0.5, `hsla(${hue},100%,55%,${0.12 + amp * 0.18})`);
        bg.addColorStop(1,   "transparent");
        ctx.fillStyle = bg;
        ctx.fillRect(0, baseY - bandH, w, bandH * 2);
        ctx.strokeStyle = `hsla(${hue},100%,70%,${0.18 + amp * 0.30})`;
        ctx.lineWidth   = 0.8 + amp * 2;
        ctx.beginPath();
        for (let xi = 0; xi <= 80; xi++) {
          const xt  = xi / 80;
          const sx  = xt * w;
          const sy  = baseY + Math.sin(xt * Math.PI * 5 + bi * 1.1) * bandH * 0.6;
          if (xi === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
      }
      ctx.restore();
      break;
  }
}
