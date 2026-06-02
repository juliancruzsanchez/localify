import { useEffect } from "react";
import { useNavigate } from "react-router";
import { usePlayerStore } from "@/store/playerStore";
import { useUiStore } from "@/store/uiStore";
import { useIsLiked, useLikeTrack, useUnlikeTrack } from "@/queries/liked";

export function useKeyboardShortcuts() {
  const navigate = useNavigate();

  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause);
  const playNext = usePlayerStore((s) => s.playNext);
  const playPrev = usePlayerStore((s) => s.playPrev);
  const seek = usePlayerStore((s) => s.seek);
  const positionMs = usePlayerStore((s) => s.positionMs);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const volumePct = usePlayerStore((s) => s.volumePct);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const cycleRepeat = usePlayerStore((s) => s.cycleRepeat);
  const currentTrack = usePlayerStore((s) => s.currentTrack);

  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const toggleQueue = useUiStore((s) => s.toggleQueue);
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);
  const shortcutsModalOpen = useUiStore((s) => s.shortcutsModalOpen);
  const setShortcutsModalOpen = useUiStore((s) => s.setShortcutsModalOpen);
  const setCreatePlaylistOpen = useUiStore((s) => s.setCreatePlaylistOpen);

  const isLiked = useIsLiked(currentTrack?.id ?? "");
  const { mutate: likeTrack } = useLikeTrack();
  const { mutate: unlikeTrack } = useUnlikeTrack();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      const cmd = e.metaKey || e.ctrlKey;
      const alt = e.altKey;
      const shift = e.shiftKey;
      const key = e.key;

      // Toggle shortcuts modal: ⌘/ or ?
      if (cmd && !alt && !shift && key === "/") {
        e.preventDefault();
        setShortcutsModalOpen(!shortcutsModalOpen);
        return;
      }
      if (!inInput && !cmd && !alt && !shift && key === "?") {
        e.preventDefault();
        setShortcutsModalOpen(!shortcutsModalOpen);
        return;
      }

      // Close shortcuts modal on Escape (handled in App.tsx for settings too,
      // but we add it here for the shortcuts modal)
      if (key === "Escape" && shortcutsModalOpen) {
        setShortcutsModalOpen(false);
        return;
      }

      // Don't fire shortcuts when a modal/dialog is open that captures input
      if (shortcutsModalOpen) return;

      // ── Playback ──────────────────────────────────────────────────────────
      // Space: play/pause (not in input fields)
      if (!inInput && !cmd && !alt && !shift && key === " ") {
        e.preventDefault();
        togglePlayPause();
        return;
      }

      // ⌥ Shift B: like/unlike current track
      if (!cmd && alt && shift && key.toLowerCase() === "b") {
        e.preventDefault();
        if (currentTrack) {
          if (isLiked) unlikeTrack(currentTrack.id);
          else likeTrack(currentTrack.id);
        }
        return;
      }

      // ⌘ S: shuffle
      if (cmd && !alt && !shift && key.toLowerCase() === "s") {
        e.preventDefault();
        toggleShuffle();
        return;
      }

      // ⌘ R: repeat
      if (cmd && !alt && !shift && key.toLowerCase() === "r") {
        e.preventDefault();
        cycleRepeat();
        return;
      }

      // ⌘ ←: skip to previous  (must check before ⌘ ⌥ ← below)
      if (cmd && !alt && !shift && key === "ArrowLeft") {
        e.preventDefault();
        playPrev();
        return;
      }

      // ⌘ →: skip to next
      if (cmd && !alt && !shift && key === "ArrowRight") {
        e.preventDefault();
        playNext();
        return;
      }

      // ⌘ Shift ←: seek backward 10s
      if (cmd && !alt && shift && key === "ArrowLeft") {
        e.preventDefault();
        seek(Math.max(0, positionMs - 10_000));
        return;
      }

      // ⌘ Shift →: seek forward 10s
      if (cmd && !alt && shift && key === "ArrowRight") {
        e.preventDefault();
        seek(positionMs + 10_000);
        return;
      }

      // ⌘ ↑: raise volume +5
      if (cmd && !alt && !shift && key === "ArrowUp") {
        e.preventDefault();
        setVolume(Math.min(100, volumePct + 5));
        return;
      }

      // ⌘ ↓: lower volume -5
      if (cmd && !alt && !shift && key === "ArrowDown") {
        e.preventDefault();
        setVolume(Math.max(0, volumePct - 5));
        return;
      }

      // ── Navigation ────────────────────────────────────────────────────────
      // ⌥ Shift H: home
      if (!cmd && alt && shift && key.toLowerCase() === "h") {
        e.preventDefault();
        navigate("/");
        return;
      }

      // ⌘ ⌥ ←: back in history
      if (cmd && alt && !shift && key === "ArrowLeft") {
        e.preventDefault();
        navigate(-1);
        return;
      }

      // ⌘ ⌥ →: forward in history
      if (cmd && alt && !shift && key === "ArrowRight") {
        e.preventDefault();
        navigate(1);
        return;
      }

      // ⌘ ,: preferences / settings
      if (cmd && !alt && !shift && key === ",") {
        e.preventDefault();
        setSettingsOpen(true);
        return;
      }

      // ⌘ L / ⌘ K: search
      if (cmd && !alt && !shift && (key.toLowerCase() === "l" || key.toLowerCase() === "k")) {
        e.preventDefault();
        navigate("/search");
        return;
      }

      // ⌥ Shift S: liked songs
      if (!cmd && alt && shift && key.toLowerCase() === "s") {
        e.preventDefault();
        navigate("/liked");
        return;
      }

      // ⌥ Shift Q: toggle queue
      if (!cmd && alt && shift && key.toLowerCase() === "q") {
        e.preventDefault();
        toggleQueue();
        return;
      }

      // ⌥ Shift 0: songs library
      if (!cmd && alt && shift && key === "0") {
        e.preventDefault();
        navigate("/songs");
        return;
      }

      // ⌥ Shift 3: artists
      if (!cmd && alt && shift && key === "3") {
        e.preventDefault();
        navigate("/artists");
        return;
      }

      // ⌥ Shift 4: albums
      if (!cmd && alt && shift && key === "4") {
        e.preventDefault();
        navigate("/albums");
        return;
      }

      // ── Layout ────────────────────────────────────────────────────────────
      // ⌥ Shift L: toggle sidebar
      if (!cmd && alt && shift && key.toLowerCase() === "l") {
        e.preventDefault();
        toggleSidebar();
        return;
      }

      // ── Basic ─────────────────────────────────────────────────────────────
      // ⌘ N: new playlist
      if (cmd && !alt && !shift && key.toLowerCase() === "n") {
        e.preventDefault();
        setCreatePlaylistOpen(true);
        return;
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [
    navigate,
    togglePlayPause,
    playNext,
    playPrev,
    seek,
    positionMs,
    setVolume,
    volumePct,
    toggleShuffle,
    cycleRepeat,
    currentTrack,
    isLiked,
    likeTrack,
    unlikeTrack,
    toggleSidebar,
    toggleQueue,
    setSettingsOpen,
    shortcutsModalOpen,
    setShortcutsModalOpen,
    setCreatePlaylistOpen,
  ]);
}
