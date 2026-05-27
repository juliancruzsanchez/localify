import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import type { SearchResults } from "@/types";
import { queryKeys } from "./keys";

export function useSearchQuery(query: string) {
  return useQuery({
    queryKey: queryKeys.search(query),
    queryFn: () => invoke<SearchResults>("search_library", { query }),
    enabled: query.trim().length > 0,
    staleTime: 30_000,
  });
}
