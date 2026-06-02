import { X } from "lucide-react";
import { useUiStore } from "@/store/uiStore";

function Key({ label }: { label: string }) {
  return (
    <kbd
      className="inline-flex items-center justify-center min-w-[28px] h-7 px-1.5 rounded text-xs font-medium font-mono"
      style={{
        background: "var(--color-surface-elevated)",
        border: "1px solid var(--color-border)",
        color: "var(--color-text)",
      }}
    >
      {label}
    </kbd>
  );
}

function Shortcut({ action, keys }: { action: string; keys: string[][] }) {
  return (
    <div
      className="flex items-center justify-between py-3"
      style={{ borderBottom: "1px solid color-mix(in srgb, var(--color-border) 50%, transparent)" }}
    >
      <span className="text-sm" style={{ color: "var(--color-text)" }}>
        {action}
      </span>
      <div className="flex items-center gap-2 flex-shrink-0 ml-4">
        {keys.map((combo, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && (
              <span className="text-xs mx-1" style={{ color: "var(--color-text-muted)" }}>
                or
              </span>
            )}
            {combo.map((k, j) => (
              <Key key={j} label={k} />
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <h2 className="text-white font-bold text-base py-3">{title}</h2>
      {children}
    </div>
  );
}

const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);
const Cmd = isMac ? "⌘" : "Ctrl";
const Alt = isMac ? "⌥" : "Alt";

export function KeyboardShortcutsModal() {
  const { shortcutsModalOpen, setShortcutsModalOpen } = useUiStore();

  if (!shortcutsModalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={() => setShortcutsModalOpen(false)}
    >
      <div
        className="relative flex flex-col rounded-xl overflow-hidden"
        style={{
          width: 560,
          maxHeight: "85vh",
          background: "var(--color-base)",
          border: "1px solid var(--color-border)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fixed header */}
        <div
          className="flex-shrink-0 px-6 pt-6 pb-4"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-white text-xl font-bold">Keyboard Shortcuts</h1>
              <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
                Press <Key label={`${Cmd}`} /> <Key label="/" /> or <Key label="?" /> to toggle this modal.
              </p>
            </div>
            <button
              onClick={() => setShortcutsModalOpen(false)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors flex-shrink-0"
              style={{ color: "var(--color-text-muted)" }}
              aria-label="Close keyboard shortcuts"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <Section title="Basic">
            <Shortcut action="Create new playlist" keys={[[Cmd, "N"]]} />
            <Shortcut action="Open Quick Search" keys={[[Cmd, "K"]]} />
          </Section>

          <Section title="Playback">
            <Shortcut action="Play / Pause" keys={[["Space"]]} />
            <Shortcut action="Like current track" keys={[[Alt, "Shift", "B"]]} />
            <Shortcut action="Shuffle" keys={[[Cmd, "S"]]} />
            <Shortcut action="Repeat" keys={[[Cmd, "R"]]} />
            <Shortcut action="Skip to previous" keys={[[Cmd, "←"]]} />
            <Shortcut action="Skip to next" keys={[[Cmd, "→"]]} />
            <Shortcut action="Seek backward 10s" keys={[[Cmd, "Shift", "←"]]} />
            <Shortcut action="Seek forward 10s" keys={[[Cmd, "Shift", "→"]]} />
            <Shortcut action="Raise volume" keys={[[Cmd, "↑"]]} />
            <Shortcut action="Lower volume" keys={[[Cmd, "↓"]]} />
          </Section>

          <Section title="Navigation">
            <Shortcut action="Home" keys={[[Alt, "Shift", "H"]]} />
            <Shortcut action="Back in history" keys={[[Cmd, Alt, "←"]]} />
            <Shortcut action="Forward in history" keys={[[Cmd, Alt, "→"]]} />
            <Shortcut action="Preferences" keys={[[Cmd, ","]]} />
            <Shortcut action="Search" keys={[[Cmd, "L"]]} />
            <Shortcut action="Liked songs" keys={[[Alt, "Shift", "S"]]} />
            <Shortcut action="Queue" keys={[[Alt, "Shift", "Q"]]} />
            <Shortcut action="Songs" keys={[[Alt, "Shift", "0"]]} />
            <Shortcut action="Artists" keys={[[Alt, "Shift", "3"]]} />
            <Shortcut action="Albums" keys={[[Alt, "Shift", "4"]]} />
          </Section>

          <Section title="Layout">
            <Shortcut action="Toggle sidebar" keys={[[Alt, "Shift", "L"]]} />
          </Section>
        </div>
      </div>
    </div>
  );
}
