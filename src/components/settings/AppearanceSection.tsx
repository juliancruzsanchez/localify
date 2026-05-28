import { useState, useRef } from "react";
import { Check, Pencil, Trash2, Plus } from "lucide-react";
import { BUILT_IN_THEMES, COLOR_FIELDS, applyTheme, type Theme, type ThemeColors } from "@/lib/themes";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

// ─── Mini preview card ────────────────────────────────────────────────────────

function ThemePreview({ colors }: { colors: ThemeColors }) {
  return (
    <div
      style={{
        background: colors.sidebarBg,
        borderRadius: 6,
        padding: 6,
        display: "flex",
        gap: 4,
        height: 66,
        overflow: "hidden",
      }}
    >
      {/* Sidebar strip */}
      <div style={{ width: 14, background: colors.surface, borderRadius: 3, flexShrink: 0 }} />

      {/* Main area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        {/* Top bar */}
        <div style={{ height: 9, background: colors.surface, borderRadius: 3 }} />

        {/* Content */}
        <div style={{ flex: 1, background: colors.base, borderRadius: 3, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 4, left: 4, right: 10, height: 2, background: colors.surfaceElevated, borderRadius: 1 }} />
          <div style={{ position: "absolute", top: 9,  left: 4, right: 16, height: 2, background: colors.border,          borderRadius: 1 }} />
          <div style={{ position: "absolute", top: 14, left: 4, right: 8,  height: 2, background: colors.surfaceElevated, borderRadius: 1 }} />
          {/* Accent dot (active state indicator) */}
          <div style={{ position: "absolute", top: 3, right: 3, width: 5, height: 5, borderRadius: "50%", background: colors.accent }} />
        </div>

        {/* Player bar */}
        <div style={{ height: 11, background: colors.surface, borderRadius: 3, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: "50%", left: 4, width: "35%", height: 2, background: colors.accent, transform: "translateY(-50%)", borderRadius: 1 }} />
          <div style={{ position: "absolute", top: "50%", right: 4, width: 5, height: 5, borderRadius: "50%", background: colors.accentHover, transform: "translateY(-50%)" }} />
        </div>
      </div>
    </div>
  );
}

// ─── Theme card ───────────────────────────────────────────────────────────────

interface ThemeCardProps {
  theme: Theme;
  isActive: boolean;
  onActivate: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

function ThemeCard({ theme, isActive, onActivate, onEdit, onDelete }: ThemeCardProps) {
  return (
    <div
      onClick={onActivate}
      className="group relative cursor-pointer rounded-lg overflow-hidden transition-all"
      style={{
        border: isActive
          ? `2px solid var(--color-accent)`
          : "2px solid var(--color-border)",
        background: "var(--color-surface)",
      }}
    >
      <ThemePreview colors={theme.colors} />

      <div
        className="flex items-center justify-between px-2 py-1.5"
        style={{ borderTop: "1px solid var(--color-border)" }}
      >
        <span
          className="text-xs font-medium truncate"
          style={{ color: isActive ? "var(--color-accent)" : "var(--color-text)" }}
        >
          {theme.name}
        </span>

        <div className="flex items-center gap-1 flex-shrink-0">
          {isActive && (
            <Check size={11} style={{ color: "var(--color-accent)" }} />
          )}
          {!theme.builtIn && (
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
              <button
                onClick={e => { e.stopPropagation(); onEdit?.(); }}
                className="rounded p-0.5 transition-colors hover:bg-white/10"
                style={{ color: "var(--color-text-muted)" }}
                title="Edit theme"
              >
                <Pencil size={11} />
              </button>
              <button
                onClick={e => { e.stopPropagation(); onDelete?.(); }}
                className="rounded p-0.5 transition-colors hover:bg-red-500/20 hover:text-red-400"
                style={{ color: "var(--color-text-muted)" }}
                title="Delete theme"
              >
                <Trash2 size={11} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── New-theme button card ────────────────────────────────────────────────────

function NewThemeCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg flex flex-col items-center justify-center gap-1.5 transition-all h-full min-h-[100px] cursor-pointer"
      style={{
        border: "2px dashed var(--color-border)",
        background: "transparent",
        color: "var(--color-text-dim)",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = "var(--color-accent)";
        e.currentTarget.style.color = "var(--color-accent)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = "var(--color-border)";
        e.currentTarget.style.color = "var(--color-text-dim)";
      }}
    >
      <Plus size={18} />
      <span className="text-xs font-medium">New Theme</span>
    </button>
  );
}

// ─── Color field row ──────────────────────────────────────────────────────────

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
        {label}
      </span>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span
          className="text-xs font-mono w-16 text-right"
          style={{ color: "var(--color-text-dim)" }}
        >
          {value}
        </span>
        <div
          style={{
            width: 26, height: 26,
            borderRadius: 6,
            background: value,
            border: "1px solid rgba(255,255,255,0.18)",
            boxShadow: `0 0 8px ${value}55`,
            position: "relative",
            cursor: "pointer",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          <input
            type="color"
            value={value}
            onChange={e => onChange(e.target.value)}
            style={{
              position: "absolute",
              width: "200%", height: "200%",
              top: "-25%", left: "-25%",
              opacity: 0,
              cursor: "pointer",
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Theme editor ─────────────────────────────────────────────────────────────

interface EditorProps {
  initial: Theme;
  allThemes: Theme[];
  isNew: boolean;
  onSave: (theme: Theme) => void;
  onCancel: () => void;
}

function ThemeEditor({ initial, allThemes, isNew, onSave, onCancel }: EditorProps) {
  const [name, setName]     = useState(initial.name);
  const [colors, setColors] = useState<ThemeColors>({ ...initial.colors });
  const prevThemeRef        = useRef(initial);

  function update(key: keyof ThemeColors, value: string) {
    const next = { ...colors, [key]: value };
    setColors(next);
    // Live preview: apply draft colors immediately
    applyTheme({ ...initial, colors: next });
  }

  function handleBaseChange(sourceId: string) {
    const source = allThemes.find(t => t.id === sourceId);
    if (!source) return;
    setColors({ ...source.colors });
    applyTheme({ ...initial, colors: source.colors });
  }

  function handleSave() {
    const theme: Theme = {
      id:      initial.id,
      name:    name.trim() || "Untitled",
      builtIn: false,
      colors,
    };
    onSave(theme);
  }

  function handleCancel() {
    // Revert live preview to the theme that was active before editing
    applyTheme(prevThemeRef.current);
    onCancel();
  }

  return (
    <div
      className="rounded-xl p-5 mt-6"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--color-text)" }}>
        {isNew ? "New Theme" : `Edit "${initial.name}"`}
      </h3>

      {/* Name + base-on */}
      <div className="flex gap-3 mb-5">
        <div className="flex-1">
          <label className="block text-xs mb-1.5" style={{ color: "var(--color-text-muted)" }}>
            Theme Name
          </label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="My Theme"
            className="w-full rounded-md px-3 py-1.5 text-sm outline-none"
            style={{
              background: "var(--color-surface-elevated)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
          />
        </div>
        {isNew && (
          <div className="flex-1">
            <label className="block text-xs mb-1.5" style={{ color: "var(--color-text-muted)" }}>
              Based On
            </label>
            <select
              onChange={e => handleBaseChange(e.target.value)}
              className="w-full rounded-md px-3 py-1.5 text-sm outline-none cursor-pointer"
              style={{
                background: "var(--color-surface-elevated)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
              }}
            >
              {allThemes.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Color grid */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-3 mb-6">
        {COLOR_FIELDS.map(({ key, label }) => (
          <ColorField
            key={key}
            label={label}
            value={colors[key]}
            onChange={v => update(key, v)}
          />
        ))}
      </div>

      {/* Live preview strip */}
      <div className="mb-5">
        <p className="text-xs mb-2" style={{ color: "var(--color-text-dim)" }}>Preview</p>
        <div style={{ maxWidth: 260 }}>
          <ThemePreview colors={colors} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <button
          onClick={handleCancel}
          className="px-4 py-1.5 rounded-md text-sm transition-colors"
          style={{
            background: "var(--color-surface-elevated)",
            color: "var(--color-text-muted)",
          }}
          onMouseEnter={e => (e.currentTarget.style.color = "var(--color-text)")}
          onMouseLeave={e => (e.currentTarget.style.color = "var(--color-text-muted)")}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
          style={{
            background: "var(--color-accent)",
            color: "#000",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "var(--color-accent-hover)")}
          onMouseLeave={e => (e.currentTarget.style.background = "var(--color-accent)")}
        >
          Save Theme
        </button>
      </div>
    </div>
  );
}

// ─── Main section ─────────────────────────────────────────────────────────────

type EditorState =
  | { open: false }
  | { open: true; theme: Theme; isNew: boolean };

export function AppearanceSection() {
  const { allThemes, activeId, activeTheme, activateTheme, saveCustomTheme, deleteCustomTheme } =
    useTheme();
  const [editor, setEditor] = useState<EditorState>({ open: false });

  function openNew() {
    setEditor({
      open: true,
      isNew: true,
      theme: {
        id:      `custom-${Date.now().toString(36)}`,
        name:    "My Theme",
        builtIn: false,
        colors:  { ...activeTheme.colors },
      },
    });
  }

  function openEdit(theme: Theme) {
    setEditor({ open: true, isNew: false, theme });
  }

  function handleSave(theme: Theme) {
    saveCustomTheme(theme);
    setEditor({ open: false });
  }

  function handleCancel() {
    setEditor({ open: false });
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this theme?")) return;
    deleteCustomTheme(id, activeId);
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--color-text)" }}>
        Appearance
      </h2>
      <p className="text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
        Choose a built-in theme or create your own.
      </p>

      {/* Theme grid */}
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {allThemes.map(theme => (
          <ThemeCard
            key={theme.id}
            theme={theme}
            isActive={activeId === theme.id}
            onActivate={() => activateTheme(theme.id)}
            onEdit={!theme.builtIn ? () => openEdit(theme) : undefined}
            onDelete={!theme.builtIn ? () => handleDelete(theme.id) : undefined}
          />
        ))}
        {/* Only show New Theme card if editor isn't creating a new one */}
        {(!editor.open || !editor.isNew) && (
          <NewThemeCard onClick={openNew} />
        )}
      </div>

      {/* Inline editor */}
      {editor.open && (
        <ThemeEditor
          key={editor.theme.id}
          initial={editor.theme}
          allThemes={allThemes}
          isNew={editor.isNew}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}
