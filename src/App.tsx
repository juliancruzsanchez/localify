import { useState, useEffect } from "react";
import { Outlet, useNavigate } from "react-router";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { X } from "lucide-react";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { NowPlayingBar } from "@/components/layout/NowPlayingBar";
import { QueuePanel } from "@/components/queue/QueuePanel";
import { DragOverlayContent } from "@/components/drag/DragOverlay";
import { SettingsView } from "@/views/SettingsView";
import { LyricsView } from "@/components/lyrics/LyricsView";
import { useUiStore } from "@/store/uiStore";
import { usePlayerStore } from "@/store/playerStore";
import { useLastFmScrobbling } from "@/hooks/useLastFmScrobbling";
import { useAddTrackToPlaylist } from "@/queries/playlists";
import { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from "@/lib/constants";
import { setPluginNavigate } from "@/plugins/navigation";
import type { PlayerState, Track } from "@/types";

const QUEUE_PANEL_WIDTH = 280;

export default function App() {
  const { sidebarCollapsed, queueOpen, settingsOpen, setSettingsOpen, lyricsOpen } = useUiStore();
  const { playNext, setPosition, setDuration, setIsPlaying } = usePlayerStore();
  const [activeTrack, setActiveTrack] = useState<Track | null>(null);
  const { mutate: addTrackToPlaylist } = useAddTrackToPlaylist();
  const navigate = useNavigate();
  setPluginNavigate((path) => navigate(path));

  // Require a 250 ms hold before drag activates; short taps fire click instead.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

  // Close settings on Escape
  useEffect(() => {
    if (!settingsOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setSettingsOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [settingsOpen, setSettingsOpen]);

  // Last.fm scrobbling (no-ops when not connected)
  useLastFmScrobbling();
  const lastPlayStartedAt = usePlayerStore((s) => s._lastPlayStartedAt);

  const sidebarW = sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;

  const handleDragStart = (event: any) => {
    if (event.active.data.current?.type === "track") {
      setActiveTrack(event.active.data.current.track);
    }
  };

  const handleDragEnd = (event: any) => {
    setActiveTrack(null);
    if (
      event.active.data.current?.type === "track" &&
      event.over?.data.current?.type === "playlist"
    ) {
      addTrackToPlaylist({
        playlistId: event.over.data.current.playlistId,
        trackId: event.active.data.current.track.id,
      });
    }
  };

  // Listen for track-ended event from Rust to auto-advance queue
  useEffect(() => {
    const unlistenPromise = listen("player:ended", () => {
      playNext();
    });
    return () => {
      unlistenPromise.then((f) => f());
    };
  }, [playNext]);

  // Poll player state every 250ms for position/duration updates
  useEffect(() => {
    const pollTimer = setInterval(async () => {
      try {
        const state = await invoke<PlayerState>("get_player_state");
        // Suppress is_playing sync for 600 ms after playTrack() is called.
        // The Rust audio loop processes the Play command asynchronously, so
        // the backend's is_playing may still reflect the previous track state
        // for a brief window — overwriting the optimistic "true" we set in
        // playTrack() would cause a visible flash to "paused".
        const inTransition = Date.now() - lastPlayStartedAt < 600;
        if (!inTransition) {
          setIsPlaying(state.is_playing);
          if (state.position_ms >= 0) setPosition(state.position_ms);
          if (state.duration_ms > 0) setDuration(state.duration_ms);
        }
      } catch {
        // Not in Tauri context (tests / browser preview)
      }
    }, 250);
    return () => clearInterval(pollTimer);
  }, [lastPlayStartedAt, setPosition, setDuration, setIsPlaying]);

  const queueCol = queueOpen ? `${QUEUE_PANEL_WIDTH}px` : "0px";

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `${sidebarW}px 1fr ${queueCol}`,
          gridTemplateRows: "var(--topbar-height) 1fr var(--player-height)",
          gridTemplateAreas: '"topbar topbar topbar" "sidebar main queue" "player player player"',
          height: "100vh",
          overflow: "hidden",
          borderRadius: "12px",
          transition: "grid-template-columns 200ms ease",
          columnGap: "8px",
          rowGap: "8px",
          padding: "8px",
          background: "var(--color-sidebar-bg)",
        }}
      >
        <Sidebar />
        <TopBar />
        <main
          style={{
            gridArea: "main",
            background: "var(--color-base)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            borderRadius: "0 0 12px 12px",
            position: "relative",
          }}
        >
          <Outlet />
          {lyricsOpen && <LyricsView />}
        </main>
        {queueOpen && <QueuePanel />}
        <NowPlayingBar />
        <DragOverlay dropAnimation={null}>
          {activeTrack ? <DragOverlayContent track={activeTrack} /> : null}
        </DragOverlay>
      </div>

      {/* Settings modal */}
      {settingsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="relative w-full max-w-4xl h-[80vh] rounded-xl overflow-hidden"
            style={{
              background: "var(--color-base)",
              border: "1px solid var(--color-border)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSettingsOpen(false)}
              className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/40 text-[var(--color-text-muted)] hover:text-white hover:bg-black/60 transition-colors"
              aria-label="Close settings"
            >
              <X size={18} />
            </button>
            <SettingsView />
          </div>
        </div>
      )}
    </DndContext>
  );
}
