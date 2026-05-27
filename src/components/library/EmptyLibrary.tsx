import { Music, FolderPlus } from "lucide-react";
import { useNavigate } from "react-router";

export function EmptyLibrary() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 text-center p-8">
      <div className="w-24 h-24 rounded-full bg-[var(--color-surface-elevated)] flex items-center justify-center">
        <Music size={40} className="text-[var(--color-text-muted)]" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Your library is empty</h2>
        <p className="text-[var(--color-text-muted)] max-w-sm">
          Add a music folder in Settings to get started. Localify supports FLAC,
          ALAC, MP3, AAC, WAV, AIFF, and more.
        </p>
      </div>
      <button
        onClick={() => navigate("/settings")}
        className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-accent)] text-black font-semibold rounded-full hover:bg-[var(--color-accent-hover)] transition-colors"
      >
        <FolderPlus size={18} />
        Go to Settings
      </button>
    </div>
  );
}
