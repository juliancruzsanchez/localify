import { useRef, useEffect } from "react";
import { MODES, MODE_LABELS } from "@/components/player/Visualizer";
import type { Mode } from "@/components/player/Visualizer";
import { renderPreview } from "@/lib/visualizerPreviews";

interface Props {
  onSelect: (mode: Mode) => void;
}

function PreviewCard({ mode, onSelect }: { mode: Mode; onSelect: (mode: Mode) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = 240 * dpr;
    canvas.height = 135 * dpr;
    ctx.scale(dpr, dpr);
    renderPreview(mode, ctx, 240, 135);
  }, [mode]);

  return (
    <button
      onClick={() => onSelect(mode)}
      className="group flex flex-col rounded-lg overflow-hidden transition-all hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
      style={{ background: "var(--color-surface-elevated)" }}
    >
      <canvas
        ref={canvasRef}
        className="w-full pointer-events-none"
        style={{ aspectRatio: "240/135", display: "block" }}
      />
      <div className="px-3 py-2.5 text-left">
        <p className="text-white text-sm font-semibold">{MODE_LABELS[mode]}</p>
        <p className="text-[var(--color-text-muted)] text-xs capitalize">{mode}</p>
      </div>
    </button>
  );
}

export function VisualizerSelector({ onSelect }: Props) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="px-8 pt-8 pb-2">
        <h1 className="text-2xl font-bold text-white">Choose a Visualizer</h1>
        <p className="text-[var(--color-text-muted)] text-sm mt-1">
          Pick a visual style to get started. You can change it later in the color panel.
        </p>
      </div>
      <div
        className="px-8 pb-8 grid gap-4"
        style={{
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        }}
      >
        {MODES.map((mode) => (
          <PreviewCard key={mode} mode={mode} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}
