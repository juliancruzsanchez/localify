import { usePlayerStore } from "@/store/playerStore";
import { formatMs } from "@/lib/formatTime";

export function SeekBar() {
  const { positionMs, durationMs, seek } = usePlayerStore();

  const pct = durationMs > 0 ? (positionMs / durationMs) * 100 : 0;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    seek((val / 100) * durationMs);
  };

  return (
    <div className="flex items-center gap-2 w-full max-w-md">
      <span className="text-xs text-[var(--color-text-muted)] w-10 text-right tabular-nums">
        {formatMs(positionMs)}
      </span>
      <div className="flex-1">
        <input
          type="range"
          min={0}
          max={100}
          step={0.1}
          value={pct}
          onChange={handleChange}
          className="w-full"
          style={{ "--range-pct": `${pct}%` } as React.CSSProperties}
          aria-label="Seek"
        />
      </div>
      <span className="text-xs text-[var(--color-text-muted)] w-10 tabular-nums">
        {formatMs(durationMs)}
      </span>
    </div>
  );
}
