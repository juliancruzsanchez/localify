import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Smartphone, Download, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFfmpegStatus, useFfmpegInstall } from "@/queries/ffmpeg";

interface RemoteStreamInfo {
  port: number;
  local_ip: string;
  base_url: string;
}

export function RemoteSection() {
  const [server, setServer] = useState<RemoteStreamInfo | null>(null);
  const { status: ffStatus, refresh: refreshFf } = useFfmpegStatus();
  const { state: installState, install } = useFfmpegInstall(refreshFf);

  useEffect(() => {
    invoke<RemoteStreamInfo | null>("remote_stream_status")
      .then(setServer)
      .catch(() => setServer(null));
  }, []);

  return (
    <section id="remote" className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Remote Streaming</h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          Stream your library to the Localify mobile app over your local network.
        </p>
      </div>

      {/* ── Server address ──────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 p-4 rounded-xl border border-[var(--color-border)]"
        style={{ background: "var(--color-surface-elevated)" }}
      >
        <Smartphone size={18} className="flex-shrink-0 text-[var(--color-accent)]" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">
            {server ? "Server running" : "Starting server…"}
          </p>
          <p className="text-xs text-[var(--color-text-muted)] truncate">
            {server
              ? `Enter ${server.base_url} in the mobile app's server settings.`
              : "The LAN server starts automatically with the app."}
          </p>
        </div>
      </div>

      {/* ── ffmpeg requirement ──────────────────────────────────────────────── */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-white uppercase tracking-widest">
          Universal format support
        </h3>
        <p className="text-sm text-[var(--color-text-muted)]">
          Phones can only play certain audio formats natively. Installing ffmpeg
          lets Localify convert anything else (FLAC, OGG, Opus, WMA…) on the fly so
          every track plays on mobile.
        </p>

        <FfmpegRow
          available={ffStatus?.available ?? false}
          installState={installState}
          onInstall={install}
        />
      </div>
    </section>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FfmpegRow({
  available,
  installState,
  onInstall,
}: {
  available: boolean;
  installState: ReturnType<typeof useFfmpegInstall>["state"];
  onInstall: () => void;
}) {
  if (available && installState.status !== "installing") {
    return (
      <div
        className="flex items-center gap-3 p-4 rounded-xl border border-[var(--color-accent)]/30"
        style={{ background: "var(--color-surface-elevated)" }}
      >
        <CheckCircle2 size={18} className="text-[var(--color-accent)]" />
        <div>
          <p className="text-sm font-semibold text-white">ffmpeg installed</p>
          <p className="text-xs text-[var(--color-text-muted)]">
            All formats will be converted for mobile playback.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-4 p-4 rounded-xl border border-[var(--color-border)]"
      style={{ background: "var(--color-surface-elevated)" }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium">ffmpeg not installed</p>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
          Without it, non-native formats won't play on the phone. It will be
          downloaded automatically.
        </p>
        {installState.status === "error" && (
          <div className="flex items-center gap-2 mt-1 text-xs text-red-400">
            <AlertCircle size={13} />
            <span>{installState.message}</span>
          </div>
        )}
      </div>

      {(installState.status === "idle" || installState.status === "done") && (
        <button
          onClick={onInstall}
          className="flex items-center gap-2 px-3 py-1.5 rounded bg-[var(--color-accent)] hover:opacity-90 text-white text-sm font-medium flex-shrink-0 transition-opacity"
        >
          <Download className="w-3.5 h-3.5" />
          Install ffmpeg
        </button>
      )}

      {installState.status === "installing" && (
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] flex-shrink-0">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>{Math.round(installState.pct)}%</span>
        </div>
      )}

      {installState.status === "error" && (
        <button
          onClick={onInstall}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded bg-white/10 hover:bg-white/20",
            "text-white text-sm flex-shrink-0 transition-colors",
          )}
        >
          Retry
        </button>
      )}
    </div>
  );
}
