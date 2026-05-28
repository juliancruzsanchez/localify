import { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Loader2, Save, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGetTrackTags, useUpdateTrackTags } from "@/queries/tags";
import type { Track, TrackTags } from "@/types";

interface EditTagsDialogProps {
  track:    Track;
  open:     boolean;
  onClose:  () => void;
}

const EMPTY_TAGS: TrackTags = {
  title:        "",
  artist:       "",
  album_artist: null,
  album:        null,
  year:         null,
  track_number: null,
  disc_number:  null,
  genre:        null,
  comment:      null,
};

export function EditTagsDialog({ track, open, onClose }: EditTagsDialogProps) {
  const getTags   = useGetTrackTags();
  const saveTags  = useUpdateTrackTags();
  const [tags, setTags] = useState<TrackTags>(EMPTY_TAGS);

  // Load the current tags from the file when the dialog opens
  useEffect(() => {
    if (!open) return;
    getTags.mutate(track.file_path, {
      onSuccess: (t) => setTags(t),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, track.file_path]);

  const handleSave = (e?: React.FormEvent) => {
    e?.preventDefault();
    saveTags.mutate(
      { trackId: track.id, tags },
      {
        // Close as soon as the refreshed track comes back —
        // useUpdateTrackTags.onSuccess already patches the store + queries.
        onSuccess: () => onClose(),
      },
    );
  };

  const set = (field: keyof TrackTags, value: string) => {
    setTags((prev) => ({ ...prev, [field]: value || null }));
  };

  const setNum = (field: keyof TrackTags, value: string) => {
    const n = value === "" ? null : parseInt(value, 10);
    setTags((prev) => ({ ...prev, [field]: isNaN(n!) ? null : n }));
  };

  const isLoading = getTags.isPending;
  const isSaving  = saveTags.isPending;

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" />

        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
            "z-50 w-full max-w-lg rounded-2xl shadow-2xl shadow-black/60",
            "border border-[var(--color-border)]",
            "flex flex-col max-h-[90vh]",
          )}
          style={{ background: "var(--color-surface)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[var(--color-border)] flex-shrink-0">
            <div>
              <Dialog.Title className="text-base font-bold text-white">
                Edit Tags
              </Dialog.Title>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate max-w-xs">
                {track.file_path.split("/").pop()}
              </p>
            </div>
            <Dialog.Close asChild>
              <button className="text-[var(--color-text-muted)] hover:text-white transition-colors rounded-lg p-1">
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>

          {/* Body + footer wrapped in a form so Enter submits from any field */}
          <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0">
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-8 gap-2 text-[var(--color-text-muted)]">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-sm">Loading tags…</span>
                </div>
              ) : (
                <>
                  <TagField label="Title"        value={tags.title}                  onChange={(v) => setTags((t) => ({ ...t, title: v }))} />
                  <TagField label="Artist"       value={tags.artist}                 onChange={(v) => setTags((t) => ({ ...t, artist: v }))} />
                  <TagField label="Album Artist" value={tags.album_artist ?? ""}     onChange={(v) => set("album_artist", v)} />
                  <TagField label="Album"        value={tags.album ?? ""}            onChange={(v) => set("album", v)} />
                  <TagField label="Genre"        value={tags.genre ?? ""}            onChange={(v) => set("genre", v)} />
                  <TagField label="Comment"      value={tags.comment ?? ""}          onChange={(v) => set("comment", v)} />

                  {/* Numeric row */}
                  <div className="grid grid-cols-3 gap-3">
                    <TagField
                      label="Year"
                      type="number"
                      value={tags.year?.toString() ?? ""}
                      onChange={(v) => setNum("year", v)}
                      min={1000} max={9999}
                    />
                    <TagField
                      label="Track #"
                      type="number"
                      value={tags.track_number?.toString() ?? ""}
                      onChange={(v) => setNum("track_number", v)}
                      min={1}
                    />
                    <TagField
                      label="Disc #"
                      type="number"
                      value={tags.disc_number?.toString() ?? ""}
                      onChange={(v) => setNum("disc_number", v)}
                      min={1}
                    />
                  </div>
                </>
              )}

              {saveTags.isError && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 text-red-400 text-sm">
                  <AlertCircle size={15} />
                  <span>{String(saveTags.error)}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-[var(--color-border)] flex-shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm text-[var(--color-text-muted)] hover:text-white hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || isSaving}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold",
                  "bg-[var(--color-accent)] text-white",
                  "hover:opacity-90 active:scale-[0.98] transition-all",
                  "disabled:opacity-40 disabled:pointer-events-none",
                )}
              >
                {isSaving
                  ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
                  : <><Save size={14} /> Save changes</>
                }
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ─── Field helper ─────────────────────────────────────────────────────────────

interface TagFieldProps {
  label:    string;
  value:    string;
  onChange: (v: string) => void;
  type?:    string;
  min?:     number;
  max?:     number;
}

function TagField({ label, value, onChange, type = "text", min, max }: TagFieldProps) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
        {label}
      </label>
      <input
        type={type}
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full px-3 py-2 rounded-lg text-sm text-white",
          "bg-[var(--color-surface-elevated)] border border-[var(--color-border)]",
          "placeholder:text-[var(--color-text-dim)] outline-none",
          "focus:border-[var(--color-accent)]/60 transition-colors",
        )}
      />
    </div>
  );
}
