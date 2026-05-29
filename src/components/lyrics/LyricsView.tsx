import { useEffect, useRef } from "react";
import { X, Music2 } from "lucide-react";
import { usePlayerStore } from "@/store/playerStore";
import { useUiStore } from "@/store/uiStore";
import { useLyrics, useCurrentLyricIndex } from "@/hooks/useLyrics";
import { useArtworkColor } from "@/hooks/useArtworkColor";
import { cn } from "@/lib/utils";

export function LyricsView() {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const positionMs = usePlayerStore((s) => s.positionMs);
  const seek = usePlayerStore((s) => s.seek);
  const { toggleLyrics } = useUiStore();

  const { lines, isLoading } = useLyrics(currentTrack?.id);
  const currentIndex = useCurrentLyricIndex(lines, positionMs);
  const bgColor = useArtworkColor(currentTrack?.artwork_hash);

  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [currentIndex]);

  return (
    <div
      className="absolute inset-0 z-20 flex flex-col overflow-hidden"
      style={{
        background: `linear-gradient(180deg, ${bgColor} 0%, #0d0d0d 75%)`,
      }}
    >
      {/* Close button */}
      <button
        onClick={toggleLyrics}
        className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/30 text-white/60 hover:text-white hover:bg-black/50 transition-colors"
        aria-label="Close lyrics"
      >
        <X size={16} />
      </button>

      {/* Lyrics scroll container */}
      <div className="flex-1 overflow-y-auto px-10 py-24 scroll-smooth" style={{ scrollbarWidth: "none" }}>
        {isLoading && (
          <p className="text-white/40 text-lg text-center mt-12">Loading lyrics…</p>
        )}

        {!isLoading && (!lines || lines.length === 0) && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-white/30">
            <Music2 size={40} />
            <p className="text-lg">No lyrics available</p>
          </div>
        )}

        {lines && lines.length > 0 && (
          <div className="flex flex-col gap-2">
            {lines.map((line, i) => {
              const isCurrent = i === currentIndex;
              const isPast = i < currentIndex;
              return (
                <button
                  key={i}
                  ref={isCurrent ? activeRef : undefined}
                  onClick={() => seek(line.time_ms)}
                  className={cn(
                    "text-left font-bold leading-snug transition-all duration-300 rounded-lg px-2 py-1 -mx-2",
                    "hover:bg-white/10 cursor-pointer",
                    isCurrent
                      ? "text-white text-3xl"
                      : isPast
                      ? "text-white/30 text-2xl"
                      : "text-white/50 text-2xl",
                  )}
                  style={{ transitionProperty: "color, font-size, opacity" }}
                >
                  {line.text}
                </button>
              );
            })}
            {/* Bottom padding so last line can scroll to center */}
            <div className="h-48 flex-shrink-0" />
          </div>
        )}
      </div>
    </div>
  );
}
