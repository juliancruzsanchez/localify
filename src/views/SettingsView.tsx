import { useState } from "react";
import { cn } from "@/lib/utils";
import { LibrarySection } from "@/components/settings/LibrarySection";
import { AudioSection }   from "@/components/settings/AudioSection";

type Tab = "library" | "audio";

const TABS: { id: Tab; label: string }[] = [
  { id: "library", label: "Library" },
  { id: "audio",   label: "Audio"   },
];

export function SettingsView() {
  const [activeTab, setActiveTab] = useState<Tab>("library");

  return (
    <div className="h-full flex overflow-hidden">
      {/* ── Left nav ──────────────────────────────────────────────────────── */}
      <nav
        className="w-44 flex-shrink-0 border-r border-[var(--color-border)] py-6 px-3 space-y-1"
        style={{ background: "var(--color-surface)" }}
      >
        <p className="px-3 mb-4 text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
          Settings
        </p>
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
              activeTab === id
                ? "bg-white/10 text-white font-medium"
                : "text-[var(--color-text-muted)] hover:text-white hover:bg-white/5",
            )}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-8 py-8">
          {activeTab === "library" && <LibrarySection />}
          {activeTab === "audio"   && <AudioSection />}
        </div>
      </div>
    </div>
  );
}
