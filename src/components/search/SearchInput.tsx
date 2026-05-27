import { Search, X } from "lucide-react";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchInput({ value, onChange, placeholder = "What do you want to listen to?" }: SearchInputProps) {
  return (
    <div className="relative w-full max-w-md">
      <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white/10 text-white placeholder-[var(--color-text-muted)] rounded-full pl-10 pr-8 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white/20"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-white"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
