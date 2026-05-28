import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, useState, useMemo } from "react";
import { usePlayerStore } from "@/store/playerStore";
import { TrackRow } from "./TrackRow";
import { cn } from "@/lib/utils";
import type { Track } from "@/types";

type SortKey = "track_number" | "title" | "album_title" | "format" | "duration_secs";

interface TrackListProps {
  tracks: Track[];
}

function sortTracks(list: Track[], key: SortKey, dir: "asc" | "desc"): Track[] {
  return [...list].sort((a, b) => {
    let cmp = 0;
    switch (key) {
      case "track_number":
        cmp = (a.track_number ?? 0) - (b.track_number ?? 0);
        break;
      case "title":
        cmp = a.title.localeCompare(b.title);
        break;
      case "album_title":
        cmp = (a.album_title ?? "").localeCompare(b.album_title ?? "");
        break;
      case "format":
        cmp = (a.format ?? "").localeCompare(b.format ?? "");
        break;
      case "duration_secs":
        cmp = a.duration_secs - b.duration_secs;
        break;
    }
    return dir === "asc" ? cmp : -cmp;
  });
}

const SORT_COLUMNS: { key: SortKey; label: string; className: string; align?: string }[] = [
  { key: "track_number",  label: "#",       className: "w-6 text-right" },
  { key: "title",         label: "Title",   className: "flex-1" },
  { key: "album_title",   label: "Album",   className: "hidden md:block flex-1" },
  { key: "format",        label: "Format",  className: "hidden lg:block w-12 text-center" },
  { key: "duration_secs", label: "Duration",className: "w-12 justify-end" },
];

export function TrackList({ tracks }: TrackListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const { currentTrack } = usePlayerStore();
  const [sortBy, setSortBy] = useState<SortKey>("album_title");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sorted = useMemo(() => sortTracks(tracks, sortBy, sortDir), [tracks, sortBy, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
  };

  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 20,
  });

  return (
    <div className="px-4 flex flex-col flex-1 min-h-0">
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)] border-b border-[var(--color-border)] mb-2 flex-shrink-0">
        {SORT_COLUMNS.map(({ key, label, className }) => (
          <button
            key={key}
            onClick={() => toggleSort(key)}
            className={cn(
              "flex items-center gap-1 transition-colors hover:text-white text-left",
              sortBy === key ? "text-white" : "",
              className,
            )}
          >
            {label}
            {sortBy === key && (
              <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>
            )}
          </button>
        ))}
        {/* heart spacer */}
        <div className="w-8" />
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
            const track = sorted[item.index];
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
