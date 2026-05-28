import { useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import { Visualizer } from "../../../src/components/player/Visualizer";

export function VisualizerPage() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        position:   "relative",
        width:      "100%",
        height:     "100%",
        background: "#000",
        overflow:   "hidden",
      }}
    >
      <Visualizer style={{ width: "100%", height: "100%" }} />

      {/* Back button — floats over the canvas */}
      <button
        onClick={() => navigate(-1)}
        style={{
          position:        "absolute",
          top:             16,
          left:            16,
          display:         "flex",
          alignItems:      "center",
          gap:             6,
          padding:         "6px 12px",
          borderRadius:    8,
          background:      "rgba(0,0,0,0.5)",
          color:           "rgba(255,255,255,0.7)",
          fontSize:        13,
          border:          "1px solid rgba(255,255,255,0.12)",
          cursor:          "pointer",
          backdropFilter:  "blur(8px)",
          transition:      "color 150ms",
          zIndex:          10,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
      >
        <ArrowLeft size={14} />
        Back
      </button>

      {/* Mode hint */}
      <p
        style={{
          position:   "absolute",
          bottom:     14,
          width:      "100%",
          textAlign:  "center",
          fontSize:   11,
          color:      "rgba(255,255,255,0.25)",
          pointerEvents: "none",
          letterSpacing: "0.04em",
        }}
      >
        Click canvas to cycle modes
      </p>
    </div>
  );
}
