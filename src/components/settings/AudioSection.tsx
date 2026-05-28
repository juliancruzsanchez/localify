import { useState } from "react";
import { RotateCcw, Radio, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useAudioSettingsQuery, useSetEqBands, useSetCrossfade,
  useAudioOutputDevices, useSelectedAudioDevice, useSetAudioOutputDevice,
} from "@/queries/audioSettings";
import { EqualizerUI, PresetSelector, EQ_PRESETS } from "./EqualizerUI";

export function AudioSection() {
  const { data: settings, isLoading } = useAudioSettingsQuery();
  const setEqBands      = useSetEqBands();
  const setCrossfade    = useSetCrossfade();
  const { data: devices = [] }          = useAudioOutputDevices();
  const { data: selectedDevice }        = useSelectedAudioDevice();
  const setOutputDevice                 = useSetAudioOutputDevice();

  // Local draft state — lets us drag freely without a round-trip on every pixel.
  const [localGains,   setLocalGains]   = useState<number[] | null>(null);
  const [localEnabled, setLocalEnabled] = useState<boolean | null>(null);

  if (isLoading || !settings) {
    return <div className="text-sm text-[var(--color-text-muted)]">Loading audio settings…</div>;
  }

  const gains   = localGains   ?? settings.eq_gains;
  const enabled = localEnabled ?? settings.eq_enabled;
  const cfSec   = settings.crossfade_ms / 1000;

  // ── EQ helpers ────────────────────────────────────────────────────────────

  const commitEq = (g: number[]) => {
    setEqBands.mutate({ enabled, gains: g });
  };

  const handleEnabledToggle = () => {
    const next = !enabled;
    setLocalEnabled(next);
    setEqBands.mutate({ enabled: next, gains });
  };

  const handlePreset = (preset: number[]) => {
    setLocalGains(preset);
    setEqBands.mutate({ enabled: true, gains: preset });
    setLocalEnabled(true);
  };

  const handleReset = () => {
    const flat = EQ_PRESETS["Flat"];
    setLocalGains(flat);
    setEqBands.mutate({ enabled, gains: flat });
  };

  // ── Crossfade helper ─────────────────────────────────────────────────────

  const handleCrossfade = (enabled: boolean, seconds: number) => {
    setCrossfade.mutate(enabled ? Math.round(seconds * 1000) : 0);
  };

  const crossfadeEnabled = settings.crossfade_ms > 0;

  const handleDeviceSelect = (name: string | null) => {
    setOutputDevice.mutate(name);
  };

  return (
    <section id="audio" className="space-y-10">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Audio</h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          Output device, equalizer, and playback settings.
        </p>
      </div>

      {/* ── Output device / Casting ──────────────────────────────────────── */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-white uppercase tracking-widest flex items-center gap-2">
          <Radio size={14} />
          Output Device
        </h3>
        <p className="text-xs text-[var(--color-text-muted)] -mt-1">
          AirPlay receivers appear here once discovered by macOS.
        </p>

        <div className="space-y-1.5">
          {/* Default option */}
          <DeviceRow
            name="System Default"
            isSelected={!selectedDevice}
            onSelect={() => handleDeviceSelect(null)}
          />
          {devices.map((d) => (
            <DeviceRow
              key={d.name}
              name={d.name}
              isDefault={d.is_default}
              isSelected={selectedDevice === d.name}
              onSelect={() => handleDeviceSelect(d.name)}
            />
          ))}
          {devices.length === 0 && (
            <p className="text-xs text-[var(--color-text-dim)] px-1">
              No output devices found.
            </p>
          )}
        </div>
      </div>

      {/* ── Crossfade ─────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-white uppercase tracking-widest">Crossfade</h3>

        <div className="flex items-center justify-between py-3 px-4 rounded-xl"
          style={{ background: "var(--color-surface-elevated)" }}>
          <div>
            <p className="text-sm text-white font-medium">Crossfade songs</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Smoothly blend between tracks
            </p>
          </div>
          <Toggle checked={crossfadeEnabled} onChange={(v) => handleCrossfade(v, cfSec || 3)} />
        </div>

        {crossfadeEnabled && (
          <div className="px-4 py-3 rounded-xl space-y-2"
            style={{ background: "var(--color-surface-elevated)" }}>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--color-text-muted)]">Duration</span>
              <span className="text-white font-medium tabular-nums">{cfSec.toFixed(1)}s</span>
            </div>
            <input
              type="range"
              min={1}
              max={12}
              step={0.5}
              value={cfSec}
              onChange={(e) => handleCrossfade(true, Number(e.target.value))}
              className="w-full accent-[var(--color-accent)] h-1 cursor-pointer"
            />
            <div className="flex justify-between text-xs text-[var(--color-text-dim)]">
              <span>1s</span>
              <span>12s</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Equalizer ─────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-white uppercase tracking-widest">Equalizer</h3>

        {/* EQ on/off row */}
        <div className="flex items-center justify-between py-3 px-4 rounded-xl"
          style={{ background: "var(--color-surface-elevated)" }}>
          <p className="text-sm text-white font-medium">Enable equalizer</p>
          <Toggle checked={enabled} onChange={handleEnabledToggle} />
        </div>

        {/* EQ chart + controls */}
        <div
          className={cn(
            "rounded-xl overflow-hidden border border-[var(--color-border)] transition-opacity",
            !enabled && "opacity-40 pointer-events-none",
          )}
          style={{ background: "var(--color-surface-elevated)" }}
        >
          {/* Toolbar */}
          <div className="flex items-center gap-3 px-4 pt-4 pb-2">
            <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-widest">
              Preset
            </span>
            <PresetSelector currentGains={gains} onSelect={handlePreset} />
            <div className="flex-1" />
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-white transition-colors px-2 py-1 rounded"
              title="Reset to flat"
            >
              <RotateCcw size={13} />
              Reset
            </button>
          </div>

          {/* EQ visualizer */}
          <div className="px-4 pb-4">
            <EqualizerUI
              bandsHz={settings.eq_bands_hz}
              gains={gains}
              onChange={setLocalGains}
              onCommit={commitEq}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Device row ───────────────────────────────────────────────────────────────

function DeviceRow({
  name,
  isDefault = false,
  isSelected,
  onSelect,
}: {
  name:       string;
  isDefault?: boolean;
  isSelected: boolean;
  onSelect:   () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-left transition-all",
        "border",
        isSelected
          ? "border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10"
          : "border-[var(--color-border)] hover:bg-white/5",
        "bg-[var(--color-surface-elevated)]",
      )}
    >
      <CheckCircle2
        size={15}
        className={cn(
          "flex-shrink-0 transition-opacity",
          isSelected ? "text-[var(--color-accent)] opacity-100" : "opacity-0",
        )}
      />
      <span className={cn("flex-1", isSelected ? "text-white font-medium" : "text-[var(--color-text-muted)]")}>
        {name}
      </span>
      {isDefault && (
        <span className="text-xs text-[var(--color-text-dim)]">default</span>
      )}
    </button>
  );
}

// ─── Toggle switch ────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
        checked ? "bg-[var(--color-accent)]" : "bg-white/20",
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-6" : "translate-x-1",
        )}
      />
    </button>
  );
}
