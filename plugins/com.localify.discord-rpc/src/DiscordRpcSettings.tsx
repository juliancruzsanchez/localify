import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { cn } from "@/lib/utils";

interface Status {
  enabled: boolean;
}

export function DiscordRpcSettings() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    invoke<Status>("discord_rpc_get_status").then((s) => setEnabled(s.enabled));
  }, []);

  const toggle = async () => {
    if (busy || enabled === null) return;
    setBusy(true);
    try {
      if (enabled) {
        await invoke("discord_rpc_disable");
        setEnabled(false);
      } else {
        await invoke("discord_rpc_enable");
        setEnabled(true);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-white font-medium">Rich Presence</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            Shows what you&apos;re listening to in your Discord status
          </p>
        </div>
        <button
          onClick={toggle}
          disabled={busy || enabled === null}
          className={cn(
            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
            enabled ? "bg-[var(--color-accent)]" : "bg-white/20",
            busy && "opacity-50 cursor-not-allowed",
          )}
          aria-label={enabled ? "Disable Discord Rich Presence" : "Enable Discord Rich Presence"}
        >
          <span
            className={cn(
              "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
              enabled ? "translate-x-6" : "translate-x-1",
            )}
          />
        </button>
      </div>

      <div className="rounded-lg bg-white/5 border border-white/10 p-3 space-y-1">
        <p className="text-xs text-[var(--color-text-muted)] font-medium">Setup</p>
        <ol className="text-xs text-[var(--color-text-muted)] space-y-1 list-decimal list-inside">
          <li>
            Create an application at{" "}
            <span className="text-white/70">discord.com/developers/applications</span>
          </li>
          <li>Enable Rich Presence and upload a logo as <span className="text-white/70">localify_logo</span></li>
          <li>
            Set <span className="text-white/70">DISCORD_CLIENT_ID</span> in{" "}
            <span className="text-white/70">src-tauri/src/discord_rpc/mod.rs</span> and rebuild
          </li>
        </ol>
      </div>

      <div className={cn(
        "flex items-center gap-2 text-xs",
        enabled ? "text-[var(--color-accent)]" : "text-[var(--color-text-muted)]",
      )}>
        <span className={cn(
          "inline-block h-2 w-2 rounded-full",
          enabled ? "bg-[var(--color-accent)]" : "bg-white/20",
        )} />
        {enabled === null ? "Loading…" : enabled ? "Rich Presence active" : "Rich Presence disabled"}
      </div>
    </div>
  );
}
