import { Download, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import type { YtdlpSearchResult, DownloadState } from "@/queries/ytdlp";

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface Props {
  result: YtdlpSearchResult;
  state: DownloadState;
  onDownload: (result: YtdlpSearchResult) => void;
}

export function YtdlpResultRow({ result, state, onDownload }: Props) {
  const busy = state.status === "downloading" || state.status === "processing";

  return (
    <div className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-white/5 group">
      <img
        src={result.thumbnail_url}
        alt=""
        className="w-10 h-10 rounded object-cover flex-shrink-0 bg-white/10"
        loading="lazy"
      />

      <div className="flex-1 min-w-0">
        <div className="text-sm text-white truncate">{result.title}</div>
        <div className="text-xs text-[var(--color-text-muted)] truncate">{result.uploader}</div>
      </div>

      <span className="text-xs text-[var(--color-text-muted)] flex-shrink-0 mr-2">
        {formatDuration(result.duration_secs)}
      </span>

      <div className="flex-shrink-0 w-20 flex items-center justify-end">
        {state.status === "idle" && (
          <button
            onClick={() => onDownload(result)}
            className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 px-2.5 py-1 rounded text-xs bg-white/10 hover:bg-white/20 text-white transition-all"
          >
            <Download className="w-3 h-3" />
            Add
          </button>
        )}

        {busy && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>{Math.round((state as { pct: number }).pct)}%</span>
          </div>
        )}

        {state.status === "done" && (
          <div className="flex items-center gap-1 text-xs text-green-400">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Added</span>
          </div>
        )}

        {state.status === "error" && (
          <div
            className="flex items-center gap-1 text-xs text-red-400"
            title={state.message ?? "Download failed"}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Failed</span>
          </div>
        )}
      </div>
    </div>
  );
}
