import { useState } from "react";
import { cn } from "@/lib/utils";
import { LibrarySection } from "@/components/settings/LibrarySection";
import { AudioSection }   from "@/components/settings/AudioSection";
import { LastFmSection }  from "@/components/settings/LastFmSection";
import { RemoteSection }  from "@/components/settings/RemoteSection";
import { AppearanceSection } from "@/components/settings/AppearanceSection";
import { PluginsView }    from "@/views/PluginsView";
import { DeveloperSection } from "@/components/settings/DeveloperSection";
import { usePluginRegistrySnapshot } from "@/plugins/PluginRegistryContext";

type BuiltInTab = "library" | "audio" | "lastfm" | "remote" | "extensions" | "developer" | "appearance";

const BUILT_IN_TABS: { id: BuiltInTab; label: string }[] = [
  { id: "library",    label: "Library"    },
  { id: "audio",      label: "Audio"      },
  { id: "lastfm",     label: "Last.fm"    },
  { id: "remote",     label: "Remote"     },
  { id: "appearance", label: "Appearance" },
  { id: "extensions", label: "Extensions" },
  { id: "developer",  label: "Developer"  },
];

export function SettingsView() {
  const [activeTab, setActiveTab] = useState<string>("library");
  const pluginRegistry = usePluginRegistrySnapshot();
  const pluginSections = pluginRegistry.getSettingsSections();

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
        {BUILT_IN_TABS.map(({ id, label }) => (
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
        {pluginSections.length > 0 && (
          <>
            <div className="mx-2 my-2 border-t border-[var(--color-border)]" />
            <p className="px-3 mb-1 text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
              Plugins
            </p>
            {pluginSections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveTab(section.id)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
                  activeTab === section.id
                    ? "bg-white/10 text-white font-medium"
                    : "text-[var(--color-text-muted)] hover:text-white hover:bg-white/5",
                )}
              >
                {section.label}
              </button>
            ))}
          </>
        )}
      </nav>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "extensions" ? (
          <PluginsView />
        ) : (
          <div className="max-w-2xl mx-auto px-8 py-8">
            {activeTab === "library"    && <LibrarySection />}
            {activeTab === "audio"      && <AudioSection />}
            {activeTab === "lastfm"     && <LastFmSection />}
            {activeTab === "remote"     && <RemoteSection />}
            {activeTab === "appearance" && <AppearanceSection />}
            {activeTab === "developer"  && <DeveloperSection />}
            {pluginSections.map((section) =>
              activeTab === section.id ? <section.component key={section.id} /> : null
            )}
          </div>
        )}
      </div>
    </div>
  );
}
