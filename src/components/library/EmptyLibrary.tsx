import { Music } from "lucide-react";
import { AddLibraryButton } from "./AddLibraryButton";

export function EmptyLibrary() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 text-center p-8">
      <div className="w-24 h-24 rounded-full bg-[var(--color-surface-elevated)] flex items-center justify-center">
        <Music size={40} className="text-[var(--color-text-muted)]" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Your library is empty</h2>
        <p className="text-[var(--color-text-muted)] max-w-sm">
          Add a folder containing your music files to get started. Localify supports FLAC, ALAC, MP3, AAC, WAV, AIFF, and more.
        </p>
      </div>
      <AddLibraryButton />
    </div>
  );
}
