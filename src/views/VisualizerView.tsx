import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Maximize2, Minimize2, Palette } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Visualizer, type Mode } from "@/components/player/Visualizer";
import { VisualizerColorPanel } from "@/components/player/VisualizerColorPanel";
import { VisualizerSelector } from "@/components/player/VisualizerSelector";
import { useVisualizerColors } from "@/hooks/useVisualizerColors";
import { usePlayerStore } from "@/store/playerStore";

const BTN: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 6,
  padding: "6px 10px", borderRadius: 8,
  background: "rgba(0,0,0,0.50)", color: "rgba(255,255,255,0.70)",
  fontSize: 13, border: "1px solid rgba(255,255,255,0.12)",
  cursor: "pointer", backdropFilter: "blur(8px)",
  transition: "color 150ms",
};

export function VisualizerView() {
  const navigate = useNavigate();
  const { colors, updateColor, resetColors } = useVisualizerColors();
  const [showColorPanel, setShowColorPanel] = useState(false);
  const [isFullscreen, setIsFullscreen]     = useState(false);
  const [currentMode, setCurrentMode]       = useState<Mode | null>(null);

  const artworkHash = usePlayerStore(s => s.currentTrack?.artwork_hash ?? null);

  useEffect(() => {
    const win = getCurrentWindow();
    win.isFullscreen().then(setIsFullscreen);
    let unlisten: (() => void) | null = null;
    win.onResized(() => { win.isFullscreen().then(setIsFullscreen); })
      .then(fn => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, []);

  const toggleFullscreen = useCallback(() => {
    const win = getCurrentWindow();
    win.isFullscreen().then(fs => {
      win.setFullscreen(!fs);
      setIsFullscreen(!fs);
    });
  }, []);

  const handleModeSelect = useCallback((mode: Mode) => {
    setCurrentMode(mode);
  }, []);

  if (currentMode === null) {
    return (
      <div style={{
        width: "100%", height: "100%", background: "var(--color-base)", overflow: "hidden",
      }}>
        <VisualizerSelector onSelect={handleModeSelect} />
      </div>
    );
  }

  return (
    <div style={{
      position: isFullscreen ? "fixed" : "relative",
      inset:    isFullscreen ? 0       : undefined,
      zIndex:   isFullscreen ? 9999    : undefined,
      width: "100%", height: "100%", background: "#000", overflow: "hidden",
    }}>
      <Visualizer
        style={{ width: "100%", height: "100%" }}
        colors={colors}
        artworkHash={artworkHash}
        mode={currentMode}
      />

      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        style={{ position: "absolute", top: 16, left: 16, zIndex: 10, ...BTN }}
        onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
        onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.70)")}
      >
        <ArrowLeft size={14} />
        Back
      </button>

      {/* Top-right controls */}
      <div style={{ position: "absolute", top: 16, right: 16, zIndex: 10, display: "flex", gap: 8 }}>
        <button
          onClick={() => setShowColorPanel(v => !v)}
          title="Customize colors"
          style={{
            ...BTN,
            color:      showColorPanel ? "#fff" : "rgba(255,255,255,0.70)",
            background: showColorPanel ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.50)",
            border:     showColorPanel ? "1px solid rgba(255,255,255,0.25)" : "1px solid rgba(255,255,255,0.12)",
          }}
        >
          <Palette size={14} />
        </button>
        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          style={{ ...BTN }}
          onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.70)")}
        >
          {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>

      {/* Color panel overlay */}
      {showColorPanel && (
        <VisualizerColorPanel
          colors={colors}
          activeMode={currentMode}
          onModeSelect={setCurrentMode}
          updateColor={updateColor}
          resetColors={resetColors}
          onClose={() => setShowColorPanel(false)}
        />
      )}
    </div>
  );
}
