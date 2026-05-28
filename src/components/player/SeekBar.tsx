import { useState, useRef, useCallback } from "react";
import { usePlayerStore } from "@/store/playerStore";
import { formatMs } from "@/lib/formatTime";

export function SeekBar() {
  const { positionMs, durationMs, seek, setPosition } = usePlayerStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragPct, setDragPct] = useState<number | null>(null);

  const livePct = durationMs > 0 ? (positionMs / durationMs) * 100 : 0;
  const displayPct = dragPct ?? livePct;
  const displayMs  = dragPct !== null ? (dragPct / 100) * durationMs : positionMs;

  const commit = useCallback(() => {
    if (!inputRef.current) return;
    const pct = parseFloat(inputRef.current.value);
    const targetMs = (pct / 100) * durationMs;
    // Optimistically update the store so the display doesn't snap back
    // before the async invoke completes.
    setPosition(targetMs);
    setDragPct(null);
    seek(targetMs);
  }, [durationMs, seek, setPosition]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pct = parseFloat(e.target.value);
    setDragPct(pct);
    const targetMs = (pct / 100) * durationMs;
    // Update position during drag so the time label and thumb stay in sync
    setPosition(targetMs);
  };

  return (
    <div className="flex items-center gap-2 w-full max-w-md">
      <span className="text-xs text-[var(--color-text-muted)] w-10 text-right tabular-nums">
        {formatMs(displayMs)}
      </span>
      <div className="flex-1">
        <input
          ref={inputRef}
          type="range"
          min={0}
          max={100}
          step={0.1}
          value={displayPct}
          onChange={handleChange}
          onPointerUp={commit}
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
