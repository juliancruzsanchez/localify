/**
 * Cast button in the NowPlayingBar.
 *
 * • When not casting: clicking opens a popover with discovered Chromecast
 *   devices.  "Scan" triggers an mDNS discovery.
 * • When casting: button turns accent-colored; clicking opens the popover
 *   showing "Casting to [device]" with a Stop button.
 */

import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Tv2, Loader2, RefreshCw, X, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/store/playerStore";
import {
  useCastDevices,
  useCastSession,
  useDiscoverCastDevices,
  useCastTrack,
  useStopCast,
} from "@/queries/cast";

export function CastButton() {
  const [open, setOpen] = useState(false);
  const popoverRef      = useRef<HTMLDivElement>(null);
  const currentTrack    = usePlayerStore((s) => s.currentTrack);

  const { data: devices = [] }      = useCastDevices();
  const { data: session }           = useCastSession();
  const discover                    = useDiscoverCastDevices();
  const castTrack                   = useCastTrack();
  const stopCast                    = useStopCast();
  const setCastSession              = usePlayerStore((s) => s.setCastSession);
  const positionMs                  = usePlayerStore((s) => s.positionMs);

  const isCasting = !!session;

  // Close popover on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleCast = (deviceName: string) => {
    if (!currentTrack) return;
    // Pause local playback before handing off to the Chromecast
    invoke("pause").catch(() => {});
    const device = devices.find(d => d.name === deviceName);
    castTrack.mutate({ trackId: currentTrack.id, deviceName, positionMs }, {
      onSuccess: () => {
        setOpen(false);
        if (device) {
          setCastSession({ deviceName, deviceHost: device.host });
        }
      },
    });
  };

  const handleStop = () => {
    stopCast.mutate(undefined, {
      onSuccess: () => {
        setOpen(false);
        setCastSession(null);
      },
    });
  };

  return (
    <div className="relative" ref={popoverRef}>
      {/* ── Trigger button ─────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen((o) => !o)}
        title={isCasting ? `Casting to ${session?.device_name}` : "Cast to device"}
        className={cn(
          "transition-colors flex-shrink-0",
          isCasting
            ? "text-[var(--color-accent)]"
            : "text-[var(--color-text-muted)] hover:text-white",
        )}
      >
        <Tv2 size={18} />
      </button>

      {/* ── Popover ────────────────────────────────────────────────────── */}
      {open && (
        <div
          className={cn(
            "absolute bottom-full right-0 mb-2 w-72 rounded-2xl shadow-2xl shadow-black/60",
            "border border-[var(--color-border)] overflow-hidden z-50",
          )}
          style={{ background: "var(--color-surface)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
            <span className="text-sm font-semibold text-white flex items-center gap-2">
              <Tv2 size={14} />
              {isCasting ? "Now Casting" : "Cast to Device"}
            </span>
            <button onClick={() => setOpen(false)} className="text-[var(--color-text-muted)] hover:text-white transition-colors">
              <X size={15} />
            </button>
          </div>

          <div className="p-3 space-y-2">
            {/* Active session banner */}
            {isCasting && session && (
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30">
                <div>
                  <p className="text-xs font-semibold text-[var(--color-accent)]">
                    {session.device_name}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    {currentTrack ? currentTrack.title : "—"}
                  </p>
                </div>
                <button
                  onClick={handleStop}
                  disabled={stopCast.isPending}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-40"
                >
                  {stopCast.isPending ? <Loader2 size={13} className="animate-spin" /> : "Stop"}
                </button>
              </div>
            )}

            {/* Device list */}
            {devices.length === 0 ? (
              <p className="text-xs text-[var(--color-text-muted)] text-center py-3">
                No devices found.{" "}
                <button
                  onClick={() => discover.mutate()}
                  className="text-[var(--color-accent)] underline hover:opacity-80"
                >
                  Scan now
                </button>
              </p>
            ) : (
              <div className="space-y-1">
                {devices.map((device) => (
                  <DeviceRow
                    key={device.name}
                    device={device}
                    isActive={session?.device_name === device.name}
                    isCasting={castTrack.isPending && castTrack.variables?.deviceName === device.name}
                    disabled={!currentTrack || castTrack.isPending}
                    onCast={() => handleCast(device.name)}
                  />
                ))}
              </div>
            )}

            {/* Scan button */}
            <button
              onClick={() => discover.mutate()}
              disabled={discover.isPending}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs",
                "text-[var(--color-text-muted)] hover:text-white transition-colors",
                "hover:bg-white/5 disabled:opacity-40",
              )}
            >
              {discover.isPending
                ? <><Loader2 size={12} className="animate-spin" /> Scanning…</>
                : <><RefreshCw size={12} /> Scan for devices</>
              }
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Device row ───────────────────────────────────────────────────────────────

function DeviceRow({
  device,
  isActive,
  isCasting,
  disabled,
  onCast,
}: {
  device:    import("@/queries/cast").CastDevice;
  isActive:  boolean;
  isCasting: boolean;
  disabled:  boolean;
  onCast:    () => void;
}) {
  return (
    <button
      onClick={onCast}
      disabled={disabled || isActive}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left transition-all",
        "border",
        isActive
          ? "border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 cursor-default"
          : "border-transparent hover:bg-white/5 hover:border-[var(--color-border)]",
        "disabled:opacity-50",
      )}
    >
      <Wifi size={14} className={cn("flex-shrink-0", isActive ? "text-[var(--color-accent)]" : "text-[var(--color-text-muted)]")} />
      <span className={cn("flex-1 font-medium", isActive ? "text-[var(--color-accent)]" : "text-white")}>
        {device.friendly || device.name}
      </span>
      {isCasting && <Loader2 size={13} className="animate-spin text-[var(--color-accent)]" />}
      {isActive && !isCasting && <span className="text-xs text-[var(--color-accent)]">Active</span>}
    </button>
  );
}
