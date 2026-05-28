import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import type { AudioDevice } from "@/types";

export interface AudioSettings {
  eq_enabled:   boolean;
  eq_gains:     number[];   // 6 values in dB
  eq_bands_hz:  number[];   // centre frequencies (read-only)
  crossfade_ms: number;
}

export function useAudioSettingsQuery() {
  return useQuery<AudioSettings>({
    queryKey: ["audioSettings"],
    queryFn:  () => invoke<AudioSettings>("get_audio_settings"),
    staleTime: Infinity,
  });
}

export function useSetEqBands() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ enabled, gains }: { enabled: boolean; gains: number[] }) =>
      invoke("set_eq_bands", { enabled, gains }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["audioSettings"] }),
  });
}

export function useSetCrossfade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (durationMs: number) =>
      invoke("set_crossfade", { durationMs }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["audioSettings"] }),
  });
}

// ─── Audio output devices ─────────────────────────────────────────────────────

export function useAudioOutputDevices(refetchInterval?: number) {
  return useQuery<AudioDevice[]>({
    queryKey: ["audioDevices"],
    queryFn:  () => invoke<AudioDevice[]>("get_audio_output_devices"),
    staleTime: 30_000,
    refetchInterval,
  });
}

export function useAudioOutputDevicesLive() {
  return useAudioOutputDevices(5_000);
}

export function useSelectedAudioDevice() {
  return useQuery<string | null>({
    queryKey: ["selectedAudioDevice"],
    queryFn:  () => invoke<string | null>("get_selected_audio_device"),
    staleTime: Infinity,
  });
}

export function useSetAudioOutputDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (deviceName: string | null) =>
      invoke("set_audio_output_device", { deviceName }),
    onSuccess: (_data, deviceName) => {
      qc.setQueryData(["selectedAudioDevice"], deviceName);
    },
  });
}
