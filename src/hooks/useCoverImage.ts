import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";

export function useCoverImage(coverPath: string | null | undefined): string | null {
  const { data } = useQuery({
    queryKey: ["coverImage", coverPath],
    queryFn: () => invoke<string>("get_cover_image", { coverPath: coverPath! }),
    enabled: !!coverPath,
    staleTime: 60_000,
  });
  return data ?? null;
}
