import { useRef } from "react";
import { X, Music } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { usePlayerStore } from "@/store/playerStore";
import { useUiStore } from "@/store/uiStore";
import { useArtworkUrl } from "@/hooks/useArtworkUrl";
import { QueueTrackItem } from "./QueueTrackItem";

export function QueuePanel() {
  const { currentTrack, queue, queueIndex, playTrack } = usePlayerStore();
  const { toggleQueue } = useUiStore();

  const nowArtworkPath = useArtworkUrl(currentTrack?.artwork_hash);

  // Tracks coming after the current position
  const upcomingTracks = queue.slice(queueIndex + 1);

  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: upcomingTracks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 10,
  });

  return (
    <aside
      className="flex flex-col overflow-hidden border-l border-[var(--color-border)]"
      style={{ background: "var(--color-surface)", gridArea: "queue" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] flex-shrink-0">
        <h2 className="text-sm font-bold text-white tracking-wide">Queue</h2>
        <button
          onClick={toggleQueue}
          className="text-[var(--color-text-muted)] hover:text-white transition-colors"
          aria-label="Close queue"
        >
          <X size={16} />
        </button>
      </div>

      {/* Now playing */}
      {currentTrack && (
        <div className="px-4 pt-4 pb-3 flex-shrink-0">
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-3">
            Now playing
          </p>
          <div className="flex items-center gap-3">
            {/* Artwork */}
            <div className="w-14 h-14 flex-shrink-0 rounded overflow-hidden bg-[var(--color-surface-elevated)] shadow-lg">
              {nowArtworkPath ? (
                <img
                  src={`asset://localhost/${encodeURIComponent(nowArtworkPath)}`}
                  alt={currentTrack.album_title ?? currentTrack.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Music size={20} className="text-[var(--color-text-dim)]" />
                </div>
              )}
            </div>
            {/* Info */}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--color-accent)] truncate leading-tight">
                {currentTrack.title}
              </p>
              <p className="text-xs text-[var(--color-text-muted)] truncate mt-0.5">
                {currentTrack.artist}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Divider + Next label */}
      <div className="px-4 pt-3 pb-2 flex-shrink-0 border-t border-[var(--color-border)]">
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
          Next in queue
        </p>
      </div>

      {/* Upcoming tracks — virtualized */}
      {upcomingTracks.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-[var(--color-text-dim)] italic">Nothing else queued</p>
        </div>
      ) : (
        <div ref={parentRef} className="flex-1 overflow-y-auto px-1 pb-2">
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((item) => {
              const track = upcomingTracks[item.index];
              // Absolute position in full queue
              const absoluteIndex = queueIndex + 1 + item.index;
              return (
                <div
                  key={track.id + "-" + absoluteIndex}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${item.size}px`,
                    transform: `translateY(${item.start}px)`,
                  }}
                >
                  <QueueTrackItem
                    track={track}
                    position={absoluteIndex}
                    onClick={() => playTrack(track, queue, absoluteIndex)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}
