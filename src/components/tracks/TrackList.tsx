import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";
import { usePlayerStore } from "@/store/playerStore";
import { TrackRow } from "./TrackRow";
import type { Track } from "@/types";

interface TrackListProps {
  tracks: Track[];
}

export function TrackList({ tracks }: TrackListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const { currentTrack } = usePlayerStore();

  const virtualizer = useVirtualizer({
    count: tracks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 20,
  });

  return (
    <div className="px-4 flex flex-col flex-1 min-h-0">
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)] border-b border-[var(--color-border)] mb-2 flex-shrink-0">
        <div className="w-6 text-right">#</div>
        {/* artwork spacer */}
        <div className="w-10 flex-shrink-0" />
        <div className="flex-1">Title</div>
        <div className="hidden md:block flex-1">Album</div>
        <div className="hidden lg:block w-12 text-center">Format</div>
        <div className="w-8" />
        <div className="w-12 text-right">Duration</div>
      </div>

      {/* Virtualized scroll container – takes all remaining space */}
      <div
        ref={parentRef}
        className="overflow-y-auto flex-1 min-h-0"
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((item) => {
            const track = tracks[item.index];
            return (
              <TrackRow
                key={track.id}
                track={track}
                index={item.index}
                queue={tracks}
                isActive={track.id === currentTrack?.id}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: `${item.size}px`,
                  transform: `translateY(${item.start}px)`,
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
