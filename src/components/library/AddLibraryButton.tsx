import { FolderPlus } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/queries/keys";
import { useState } from "react";

export function AddLibraryButton() {
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (!selected || Array.isArray(selected)) return;

      setLoading(true);
      await invoke("add_library_path", { path: selected });
      qc.invalidateQueries({ queryKey: queryKeys.libraryPaths() });
      // Kick off a scan
      await invoke("scan_library_cmd", { forceRescan: false });
      qc.invalidateQueries({ queryKey: queryKeys.tracks() });
      qc.invalidateQueries({ queryKey: queryKeys.albums() });
      qc.invalidateQueries({ queryKey: queryKeys.artists() });
    } catch (e) {
      console.error("Failed to add library path:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleAdd}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] text-black font-medium rounded-full hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50"
    >
      <FolderPlus size={18} />
      {loading ? "Scanning..." : "Add Music Folder"}
    </button>
  );
}
