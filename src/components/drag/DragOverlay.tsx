import { Music } from "lucide-react";
import type { Track } from "@/types";

interface DragOverlayContentProps {
  track: Track;
}

export function DragOverlayContent({ track }: DragOverlayContentProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 rounded-md bg-[var(--color-surface-elevated)] shadow-lg border border-white/10 max-w-md">
      <div className="w-10 h-10 flex-shrink-0 rounded overflow-hidden bg-[var(--color-surface)] flex items-center justify-center">
        <Music size={14} className="text-[var(--color-text-dim)]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white truncate">{track.title}</p>
        <p className="text-xs text-[var(--color-text-muted)] truncate">{track.artist}</p>
      </div>
    </div>
  );
}
