import { useState } from "react";
import { FolderPlus, FolderOpen, Trash2, RefreshCw } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/queries/keys";
import type { LibraryPath } from "@/types";

function useLibraryPathsQuery() {
  return useQuery<LibraryPath[]>({
    queryKey: queryKeys.libraryPaths(),
    queryFn:  () => invoke("get_library_paths"),
  });
}

export function LibrarySection() {
  const qc = useQueryClient();
  const { data: paths = [], isLoading } = useLibraryPathsQuery();
  const [adding,   setAdding]   = useState(false);
  const [scanning, setScanning] = useState(false);

  const removePath = useMutation({
    mutationFn: (id: string) => invoke("remove_library_path", { id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.libraryPaths() });
      invalidateLibrary();
    },
  });

  const invalidateLibrary = () => {
    qc.invalidateQueries({ queryKey: queryKeys.tracks() });
    qc.invalidateQueries({ queryKey: queryKeys.albums() });
    qc.invalidateQueries({ queryKey: queryKeys.artists() });
  };

  const handleAdd = async () => {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (!selected || Array.isArray(selected)) return;
      setAdding(true);
      await invoke("add_library_path", { path: selected });
      qc.invalidateQueries({ queryKey: queryKeys.libraryPaths() });
      setScanning(true);
      await invoke("scan_library_cmd", { forceRescan: false });
      invalidateLibrary();
    } catch (e) {
      console.error("Failed to add library path:", e);
    } finally {
      setAdding(false);
      setScanning(false);
    }
  };

  const handleRescan = async () => {
    try {
      setScanning(true);
      await invoke("scan_library_cmd", { forceRescan: true });
      invalidateLibrary();
    } catch (e) {
      console.error("Rescan failed:", e);
    } finally {
      setScanning(false);
    }
  };

  return (
    <section id="library" className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Music Library</h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          Localify scans these folders for audio files and keeps your library up to date.
        </p>
      </div>

      {/* Folder list */}
      <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-center text-sm text-[var(--color-text-muted)]">Loading…</div>
        ) : paths.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <FolderOpen size={32} className="mx-auto text-[var(--color-text-dim)]" />
            <p className="text-sm text-[var(--color-text-muted)]">No folders added yet</p>
          </div>
        ) : (
          paths.map((lp, i) => (
            <div
              key={lp.id}
              className={`flex items-center gap-3 px-4 py-3 ${
                i < paths.length - 1 ? "border-b border-[var(--color-border)]" : ""
              }`}
              style={{ background: "var(--color-surface-elevated)" }}
            >
              <FolderOpen size={16} className="text-[var(--color-accent)] flex-shrink-0" />
              <span className="flex-1 text-sm text-white truncate font-mono">{lp.path}</span>
              <button
                onClick={() => removePath.mutate(lp.id)}
                disabled={removePath.isPending}
                className="text-[var(--color-text-muted)] hover:text-red-400 transition-colors p-1 rounded flex-shrink-0"
                aria-label="Remove folder"
                title="Remove"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 flex-wrap">
        <button
          onClick={handleAdd}
          disabled={adding || scanning}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] text-black font-semibold text-sm rounded-full hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50"
        >
          <FolderPlus size={16} />
          {adding ? "Adding…" : "Add Music Folder"}
        </button>

        {paths.length > 0 && (
          <button
            onClick={handleRescan}
            disabled={scanning}
            className="flex items-center gap-2 px-4 py-2 border border-white/20 text-white font-semibold text-sm rounded-full hover:border-white/40 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={scanning ? "animate-spin" : ""} />
            {scanning ? "Scanning…" : "Rescan Library"}
          </button>
        )}
      </div>
    </section>
  );
}
