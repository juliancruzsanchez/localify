import { useState } from "react";
import { usePlayerStore } from "@/store/playerStore";
import { formatMs } from "@/lib/formatTime";

export function SeekBar() {
  const { positionMs, durationMs, seek } = usePlayerStore();
  // null = not dragging; number = the percentage the user has dragged to
  const [dragPct, setDragPct] = useState<number | null>(null);

  const livePct = durationMs > 0 ? (positionMs / durationMs) * 100 : 0;
  const displayPct = dragPct ?? livePct;
  const displayMs  = dragPct !== null ? (dragPct / 100) * durationMs : positionMs;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDragPct(parseFloat(e.target.value));
  };

  const commit = () => {
    if (dragPct !== null) {
      seek((dragPct / 100) * durationMs);
      setDragPct(null);
    }
  };

  return (
    <div className="flex items-center gap-2 w-full max-w-md">
      <span className="text-xs text-[var(--color-text-muted)] w-10 text-right tabular-nums">
        {formatMs(displayMs)}
      </span>
      <div className="flex-1">
        <input
          type="range"
          min={0}
          max={100}
          step={0.1}
          value={displayPct}
          onChange={handleChange}
          onMouseUp={commit}
          onTouchEnd={commit}
          onKeyUp={commit}
          className="w-full"
          style={{ "--range-pct": `${displayPct}%` } as React.CSSProperties}
          aria-label="Seek"
        />
      </div>
      <span className="text-xs text-[var(--color-text-muted)] w-10 tabular-nums">
        {formatMs(durationMs)}
      </span>
    </div>
  );
}
