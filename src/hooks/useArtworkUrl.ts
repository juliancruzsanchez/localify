import { useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useQuery } from "@tanstack/react-query";

export function useArtworkUrl(hash: string | null | undefined): string | null {
  const { data } = useQuery({
    queryKey: ["artwork", hash],
    queryFn: () => invoke<string>("get_artwork_path", { hash: hash! }),
    enabled: !!hash,
    staleTime: Infinity,
  });

  return data ?? null;
}

export function useArtworkSrc(hash: string | null | undefined): string {
  const path = useArtworkUrl(hash);
  // Convert file path to a safe URI for use in img src
  return path ? `localify-artwork://${path}` : "";
}
