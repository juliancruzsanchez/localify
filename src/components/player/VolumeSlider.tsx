import { Volume2, VolumeX } from "lucide-react";
import { usePlayerStore } from "@/store/playerStore";

export function VolumeSlider() {
  const { volumePct, setVolume } = usePlayerStore();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(parseFloat(e.target.value));
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setVolume(volumePct > 0 ? 0 : 80)}
        className="text-[var(--color-text-muted)] hover:text-white transition-colors flex-shrink-0"
        aria-label="Toggle mute"
      >
        {volumePct === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={volumePct}
        onChange={handleChange}
        className="w-24"
        style={{ "--range-pct": `${volumePct}%` } as React.CSSProperties}
        aria-label="Volume"
      />
    </div>
  );
}
