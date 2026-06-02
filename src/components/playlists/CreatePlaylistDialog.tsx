import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useCreatePlaylist } from "@/queries/playlists";

interface CreatePlaylistDialogProps {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CreatePlaylistDialog({ children, open: controlledOpen, onOpenChange }: CreatePlaylistDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [name, setName] = useState("");
  const createPlaylist = useCreatePlaylist();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await createPlaylist.mutateAsync({ name: name.trim() });
    setName("");
    setOpen(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      {children && <Dialog.Trigger asChild>{children}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-[var(--color-surface-elevated)] rounded-xl p-6 w-96 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-bold text-white">Create Playlist</Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-[var(--color-text-muted)] hover:text-white">
                <X size={20} />
              </button>
            </Dialog.Close>
          </div>
          <form onSubmit={handleCreate} className="space-y-4">
            <input
              type="text"
              placeholder="Playlist name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[var(--color-surface)] text-white placeholder-[var(--color-text-muted)] border border-[var(--color-border)] rounded-lg px-3 py-2 focus:outline-none focus:border-[var(--color-accent)]"
              autoFocus
            />
            <button
              type="submit"
              disabled={!name.trim() || createPlaylist.isPending}
              className="w-full bg-[var(--color-accent)] text-black font-semibold py-2 rounded-full hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50"
            >
              Create
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
