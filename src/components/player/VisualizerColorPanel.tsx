import { RotateCcw } from "lucide-react";
import type { VisualizerColors } from "@/hooks/useVisualizerColors";
import { type Mode, MODES, MODE_LABELS } from "@/components/player/Visualizer";

interface Props {
  colors: VisualizerColors;
  activeMode: Mode;
  onModeSelect: (mode: Mode) => void;
  updateColor: (mode: keyof VisualizerColors, key: string, value: string) => void;
  resetColors: () => void;
  onClose: () => void;
}

const COLOR_DEFS: Record<Mode, Array<{ key: string; label: string }>> = {
  bars:      [{ key: "primary",   label: "Bar Glow" },    { key: "secondary", label: "Bar Shadow" }, { key: "peak", label: "Peak Dot" }],
  alchemy:   [{ key: "primary",   label: "Star" },         { key: "secondary", label: "Blobs" }],
  plasma:    [{ key: "primary",   label: "Lightning" },    { key: "secondary", label: "Cloud Glow" }],
  vortex:    [{ key: "primary",   label: "Ribbons" },      { key: "secondary", label: "Nova" }],
  radial:    [{ key: "primary",   label: "Hue Base" },     { key: "secondary", label: "Accent Ring" }],
  synthgrid: [{ key: "primary",   label: "Horizon" },      { key: "secondary", label: "Grid Lines" }, { key: "sun", label: "Sun" }, { key: "stars", label: "Stars" }],
  tunnel:    [{ key: "primary",   label: "Core Burst" },   { key: "secondary", label: "Rings" }],
  ocean:     [{ key: "primary",   label: "Near Waves" },   { key: "secondary", label: "Deep Waves" }],
  artwork:   [], // colors extracted automatically from album art
  warp:      [{ key: "primary",   label: "Star Tint" },    { key: "secondary", label: "Warp Glow" }],
  hypno:     [{ key: "primary",   label: "Ring A" },       { key: "secondary", label: "Ring B" }],
  dna:       [{ key: "primary",   label: "Strand A" },     { key: "secondary", label: "Strand B" }],
  melt:      [{ key: "primary",   label: "Blobs" },        { key: "secondary", label: "Accent" }],
  nova:      [{ key: "primary",   label: "Rays" },         { key: "secondary", label: "Rings" }],
  spiral:    [{ key: "primary",   label: "Arms" },         { key: "secondary", label: "Dots" }],
  aurora:    [{ key: "primary",   label: "Curtains" },     { key: "secondary", label: "Accent" }],
};

export function VisualizerColorPanel({ colors, activeMode, onModeSelect, updateColor, resetColors, onClose }: Props) {
  const modeDefs    = COLOR_DEFS[activeMode];
  const editableMode = activeMode as keyof VisualizerColors;
  const modeColors   = modeDefs.length > 0 && editableMode in colors
    ? colors[editableMode] as unknown as Record<string, string>
    : {};

  return (
    <div
      style={{
        position: "absolute",
        top: 60,
        right: 16,
        width: 252,
        background: "rgba(10,10,18,0.94)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 12,
        backdropFilter: "blur(18px)",
        padding: "14px 16px",
        zIndex: 20,
        userSelect: "none",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: 700, letterSpacing: "0.10em" }}>
          COLORS
        </span>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            onClick={resetColors}
            title="Reset all to defaults"
            style={{ color: "rgba(255,255,255,0.35)", cursor: "pointer", display: "flex", alignItems: "center", background: "none", border: "none", padding: 0 }}
            onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
          >
            <RotateCcw size={12} />
          </button>
          <button
            onClick={onClose}
            style={{ color: "rgba(255,255,255,0.35)", cursor: "pointer", fontSize: 18, lineHeight: 1, background: "none", border: "none", padding: 0 }}
            onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
          >
            ×
          </button>
        </div>
      </div>

      {/* Mode tabs */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 14 }}>
        {MODES.map(m => (
          <button
            key={m}
            onClick={() => onModeSelect(m)}
            style={{
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: "0.06em",
              padding: "3px 7px",
              borderRadius: 4,
              cursor: "pointer",
              background: activeMode === m ? "rgba(255,255,255,0.14)" : "transparent",
              border: activeMode === m ? "1px solid rgba(255,255,255,0.20)" : "1px solid rgba(255,255,255,0.06)",
              color: activeMode === m ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.40)",
              transition: "all 120ms",
            }}
          >
            {MODE_LABELS[m].split(" ")[0]}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "rgba(255,255,255,0.07)", marginBottom: 12 }} />

      {/* Color pickers — or info message for artwork mode */}
      {modeDefs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "12px 0" }}>
          <div style={{ fontSize: 20, marginBottom: 6 }}>🎨</div>
          <p style={{ color: "rgba(255,255,255,0.50)", fontSize: 11, lineHeight: 1.5, margin: 0 }}>
            Colors are extracted automatically<br />from the current album artwork.
          </p>
        </div>
      ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        {modeDefs.map(({ key, label }) => (
          <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ color: "rgba(255,255,255,0.50)", fontSize: 11 }}>{label}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 10, fontFamily: "monospace", width: 52, textAlign: "right" }}>
                {modeColors[key]}
              </span>
              <div
                style={{
                  width: 24, height: 24, borderRadius: 5,
                  background: modeColors[key],
                  border: "1px solid rgba(255,255,255,0.22)",
                  overflow: "hidden",
                  cursor: "pointer",
                  position: "relative",
                  boxShadow: `0 0 8px ${modeColors[key]}55`,
                  flexShrink: 0,
                }}
              >
                <input
                  type="color"
                  value={modeColors[key]}
                  onChange={e => updateColor(editableMode, key, e.target.value)}
                  style={{
                    position: "absolute",
                    width: "200%", height: "200%",
                    opacity: 0, cursor: "pointer",
                    top: "-25%", left: "-25%",
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}
