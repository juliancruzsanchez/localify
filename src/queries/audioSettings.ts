import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";

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
