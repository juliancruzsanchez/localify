import { useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";

// ─── Presets ──────────────────────────────────────────────────────────────────

export const EQ_PRESETS: Record<string, number[]> = {
  Flat:        [0, 0, 0, 0, 0, 0],
  "Bass Boost":  [8, 5, 2, 0, 0, 0],
  "Treble Boost":[0, 0, 0, 2, 5, 8],
  Classical:   [0, 0, 0, 0, 4, 6],
  Rock:        [5, 3, -1, -1, 3, 5],
  "Hip Hop":   [6, 4, 0, -2, -2, 2],
  Jazz:        [3, 2, 0, 2, 3, 4],
  Electronic:  [5, 3, 0, 2, 3, 4],
};

// ─── Constants ────────────────────────────────────────────────────────────────

const DB_MIN  = -12;
const DB_MAX  =  12;
const DB_RANGE = DB_MAX - DB_MIN; // 24

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Map a dB value to a 0..1 proportion (0 = top / +12 dB). */
function dbToRatio(db: number) {
  return (DB_MAX - db) / DB_RANGE;
}

/** Map a ratio back to dB. */
function ratioToDb(ratio: number) {
  return DB_MAX - ratio * DB_RANGE;
}

/** Build a smooth SVG path through the given points. */
function buildPath(pts: { x: number; y: number }[], h: number): string {
  if (pts.length === 0) return "";

  // close path for fill by going to bottom-right → bottom-left
  let d = `M 0 ${pts[0].y}`;
  for (let i = 0; i < pts.length; i++) {
    if (i === 0) {
      d += ` L ${pts[i].x} ${pts[i].y}`;
    } else {
      const prev = pts[i - 1];
      const curr = pts[i];
      const cpx  = (prev.x + curr.x) / 2;
      d += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
    }
  }
  const last  = pts[pts.length - 1];
  const first = pts[0];
  d += ` L ${last.x} ${h} L 0 ${h} Z`;
  d += ` M 0 ${first.y}`;
  for (let i = 0; i < pts.length; i++) {
    if (i === 0) {
      d += ` L ${pts[i].x} ${pts[i].y}`;
    } else {
      const prev = pts[i - 1];
      const curr = pts[i];
      const cpx  = (prev.x + curr.x) / 2;
      d += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
    }
  }
  return d;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface EqualizerUIProps {
  bandsHz:    number[];
  gains:      number[];
  onChange:   (newGains: number[]) => void;   // called on every drag tick
  onCommit:   (newGains: number[]) => void;   // called on mouseup → send to backend
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EqualizerUI({ bandsHz, gains, onChange, onCommit }: EqualizerUIProps) {
  const svgRef    = useRef<SVGSVGElement>(null);
  const dragging  = useRef<{ band: number; startY: number; startGain: number } | null>(null);

  // ── SVG layout (responsive via viewBox) ───────────────────────────────────
  const W  = 600;
  const H  = 220;
  const padL  = 40;   // space for y-axis labels
  const padR  = 16;
  const padT  = 16;
  const padB  = 32;   // space for hz labels
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const bandCount = bandsHz.length;

  /** x-coordinate of band i (spread evenly across innerW) */
  const bandX = (i: number) => padL + (i / (bandCount - 1)) * innerW;

  /** y-coordinate for a given dB value */
  const dbY = (db: number) => padT + dbToRatio(db) * innerH;

  /** Control points for the SVG curve */
  const points = gains.map((g, i) => ({ x: bandX(i), y: dbY(g) }));

  // ── Drag handling ─────────────────────────────────────────────────────────
  const handleMouseDown = useCallback(
    (band: number) => (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = { band, startY: e.clientY, startGain: gains[band] };

      const onMove = (ev: MouseEvent) => {
        if (!dragging.current) return;
        const { band, startY, startGain } = dragging.current;
        const svgEl = svgRef.current;
        if (!svgEl) return;
        const rect    = svgEl.getBoundingClientRect();
        const scaleY  = innerH / rect.height; // viewBox → screen scale
        const dy      = (ev.clientY - startY) * scaleY;
        const ddb     = -(dy / innerH) * DB_RANGE;
        const newGain = Math.round(Math.max(DB_MIN, Math.min(DB_MAX, startGain + ddb)) * 2) / 2;
        const next    = [...gains];
        next[band]    = newGain;
        onChange(next);
      };

      const onUp = () => {
        if (dragging.current) {
          onCommit([...gains]);
        }
        dragging.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup",   onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup",   onUp);
    },
    [gains, onChange, onCommit, innerH],
  );

  // ── Zero-line y ───────────────────────────────────────────────────────────
  const zeroY = dbY(0);

  // Build two SVG paths: fill area + curve line
  const fillPath  = buildPath(points, padT + innerH);
  const curvePath = (() => {
    if (points.length === 0) return "";
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpx  = (prev.x + curr.x) / 2;
      d += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
    }
    return d;
  })();

  return (
    <div className="relative w-full select-none">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: 220 }}
      >
        <defs>
          <linearGradient id="eqGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#1db954" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#1db954" stopOpacity="0.05" />
          </linearGradient>
          {/* clip the fill to only show below the zero line downwards too */}
        </defs>

        {/* Background grid lines */}
        {[-12, -6, 0, 6, 12].map((db) => {
          const y = dbY(db);
          return (
            <line
              key={db}
              x1={padL} x2={W - padR}
              y1={y}    y2={y}
              stroke={db === 0 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.07)"}
              strokeWidth={db === 0 ? 1.5 : 1}
            />
          );
        })}

        {/* Vertical band guide lines */}
        {bandsHz.map((_, i) => (
          <line
            key={i}
            x1={bandX(i)} x2={bandX(i)}
            y1={padT}     y2={padT + innerH}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={1}
          />
        ))}

        {/* Filled area under the curve */}
        <path d={fillPath} fill="url(#eqGradient)" opacity="0.9" />

        {/* Curve line */}
        <path
          d={curvePath}
          fill="none"
          stroke="#1db954"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Y-axis labels */}
        {[12, 6, 0, -6, -12].map((db) => (
          <text
            key={db}
            x={padL - 6}
            y={dbY(db) + 4}
            textAnchor="end"
            fontSize={10}
            fill="rgba(255,255,255,0.4)"
          >
            {db > 0 ? `+${db}` : db}
          </text>
        ))}

        {/* Band handles + labels */}
        {gains.map((g, i) => {
          const cx = bandX(i);
          const cy = dbY(g);
          return (
            <g key={i}>
              {/* Hz label */}
              <text
                x={cx}
                y={padT + innerH + 20}
                textAnchor="middle"
                fontSize={10}
                fill="rgba(255,255,255,0.45)"
              >
                {bandsHz[i] >= 1000
                  ? `${bandsHz[i] / 1000}KHz`
                  : `${bandsHz[i]}Hz`}
              </text>

              {/* dB value tooltip above handle */}
              <text
                x={cx}
                y={cy - 12}
                textAnchor="middle"
                fontSize={9}
                fill="rgba(255,255,255,0.55)"
              >
                {g >= 0 ? `+${g.toFixed(1)}` : g.toFixed(1)}
              </text>

              {/* Drag handle */}
              <circle
                cx={cx}
                cy={cy}
                r={7}
                fill="#1db954"
                stroke="#000"
                strokeWidth={1.5}
                style={{ cursor: "ns-resize" }}
                onMouseDown={handleMouseDown(i)}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Preset selector ─────────────────────────────────────────────────────────

interface PresetSelectorProps {
  currentGains: number[];
  onSelect: (gains: number[]) => void;
}

export function PresetSelector({ currentGains, onSelect }: PresetSelectorProps) {
  const detectPreset = () => {
    for (const [name, preset] of Object.entries(EQ_PRESETS)) {
      if (preset.every((v, i) => Math.abs(v - currentGains[i]) < 0.1)) return name;
    }
    return "Custom";
  };

  const current = detectPreset();

  return (
    <select
      value={current}
      onChange={(e) => {
        const preset = EQ_PRESETS[e.target.value];
        if (preset) onSelect(preset);
      }}
      className={cn(
        "bg-[var(--color-surface-elevated)] border border-white/10 rounded-md",
        "text-white text-sm px-3 py-1.5 cursor-pointer",
        "focus:outline-none focus:border-[var(--color-accent)]",
      )}
    >
      {current === "Custom" && <option value="Custom">Custom</option>}
      {Object.keys(EQ_PRESETS).map((name) => (
        <option key={name} value={name}>{name}</option>
      ))}
    </select>
  );
}
