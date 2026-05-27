import { Outlet } from "react-router";
import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { Sidebar } from "@/components/layout/Sidebar";
import { NowPlayingBar } from "@/components/layout/NowPlayingBar";
import { useUiStore } from "@/store/uiStore";
import { usePlayerStore } from "@/store/playerStore";
import { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from "@/lib/constants";
import type { PlayerState } from "@/types";

export default function App() {
  const { sidebarCollapsed } = useUiStore();
  const { playNext, setPosition, setDuration, setIsPlaying } = usePlayerStore();

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
        setIsPlaying(state.is_playing);
        if (state.position_ms >= 0) setPosition(state.position_ms);
        if (state.duration_ms > 0) setDuration(state.duration_ms);
      } catch {
        // Not in Tauri context (tests / browser preview)
      }
    }, 250);
    return () => clearInterval(pollTimer);
  }, [setPosition, setDuration, setIsPlaying]);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `${sidebarW}px 1fr`,
        gridTemplateRows: "1fr var(--player-height)",
        gridTemplateAreas: '"sidebar main" "player player"',
        height: "100vh",
        overflow: "hidden",
      }}
    >
      <Sidebar />
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
      <NowPlayingBar />
    </div>
  );
}
