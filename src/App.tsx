import { Outlet } from "react-router";
import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { NowPlayingBar } from "@/components/layout/NowPlayingBar";
import { QueuePanel } from "@/components/queue/QueuePanel";
import { useUiStore } from "@/store/uiStore";
import { usePlayerStore } from "@/store/playerStore";
import { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from "@/lib/constants";
import type { PlayerState } from "@/types";

const QUEUE_PANEL_WIDTH = 280;

export default function App() {
  const { sidebarCollapsed, queueOpen } = useUiStore();
  const { playNext, setPosition, setDuration, setIsPlaying } = usePlayerStore();
  const lastPlayStartedAt = usePlayerStore((s) => s._lastPlayStartedAt);

  const sidebarW = sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;

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
        if (!inTransition) setIsPlaying(state.is_playing);
        if (state.position_ms >= 0) setPosition(state.position_ms);
        if (state.duration_ms > 0) setDuration(state.duration_ms);
      } catch {
        // Not in Tauri context (tests / browser preview)
      }
    }, 250);
    return () => clearInterval(pollTimer);
  }, [lastPlayStartedAt, setPosition, setDuration, setIsPlaying]);

  const queueCol = queueOpen ? `${QUEUE_PANEL_WIDTH}px` : "0px";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `${sidebarW}px 1fr ${queueCol}`,
        gridTemplateRows: "var(--topbar-height) 1fr var(--player-height)",
        gridTemplateAreas: '"topbar topbar topbar" "sidebar main queue" "player player player"',
        height: "100vh",
        overflow: "hidden",
        transition: "grid-template-columns 200ms ease",
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
        }}
      >
        <Outlet />
      </main>
      {queueOpen && <QueuePanel />}
      <NowPlayingBar />
    </div>
  );
}
