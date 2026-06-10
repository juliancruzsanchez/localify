import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ArrowDownUp, Check, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SortPref } from "@/hooks/useSortPref";

export interface SortOption<K extends string> {
  key:   K;
  label: string;
}

interface SortMenuProps<K extends string> {
  options: SortOption<K>[];
  pref:    SortPref<K>;
  /** Toggle direction when re-selecting the same key, otherwise switch key. */
  onToggle: (key: K) => void;
}

export function SortMenu<K extends string>({ options, pref, onToggle }: SortMenuProps<K>) {
  const activeLabel = options.find((o) => o.key === pref.key)?.label ?? "Sort";

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium",
            "text-[var(--color-text-muted)] hover:text-white transition-colors",
            "hover:bg-white/5",
          )}
          aria-label="Sort"
        >
          <ArrowDownUp size={13} />
          <span>{activeLabel}</span>
          {pref.dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className={cn(
            "min-w-[180px] rounded-xl shadow-2xl shadow-black/60 overflow-hidden z-50",
            "border border-[var(--color-border)] p-1",
          )}
          style={{ background: "var(--color-surface)" }}
        >
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
            Sort by
          </div>
          {options.map((opt) => {
            const isActive = opt.key === pref.key;
            return (
              <DropdownMenu.Item
                key={opt.key}
                onSelect={() => onToggle(opt.key)}
                className={cn(
                  "flex items-center justify-between gap-3 px-3 py-1.5 rounded-md text-sm cursor-pointer outline-none",
                  "hover:bg-white/5 data-[highlighted]:bg-white/5",
                  isActive ? "text-white" : "text-[var(--color-text-muted)]",
                )}
              >
                <span>{opt.label}</span>
                {isActive && (
                  <span className="flex items-center gap-1 text-[var(--color-accent)]">
                    {pref.dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                    <Check size={12} />
                  </span>
                )}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
