import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";

export interface CastDevice {
  name:     string;
  host:     string;
  port:     number;
  friendly: string;
}

export interface CastSession {
  device_name:   string;
  device_host:   string;
  local_port:    number;
  current_track: string | null;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useCastDevices() {
  return useQuery<CastDevice[]>({
    queryKey: ["cast", "devices"],
    queryFn:  () => invoke<CastDevice[]>("get_cast_devices"),
    staleTime: 30_000,
  });
}

export function useCastSession() {
  return useQuery<CastSession | null>({
    queryKey: ["cast", "session"],
    queryFn:  () => invoke<CastSession | null>("get_cast_session"),
    refetchInterval: 5_000, // poll to stay in sync
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useDiscoverCastDevices() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => invoke<CastDevice[]>("discover_cast_devices"),
    onSuccess: (devices) => {
      qc.setQueryData(["cast", "devices"], devices);
    },
  });
}

export function useCastTrack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ trackId, deviceName, positionMs }: { trackId: string; deviceName: string; positionMs?: number }) =>
      invoke("cast_track", { trackId, deviceName, positionMs: positionMs ?? 0 }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cast", "session"] });
    },
  });
}

export function useCastPause() {
  return useMutation({ mutationFn: () => invoke("cast_pause") });
}

export function useCastResume() {
  return useMutation({ mutationFn: () => invoke("cast_resume") });
}

export function useCastSeek() {
  return useMutation({ mutationFn: (positionMs: number) => invoke("cast_seek", { positionMs }) });
}

export function useStopCast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => invoke("stop_cast"),
    onSuccess: () => {
      qc.setQueryData(["cast", "session"], null);
    },
  });
}
