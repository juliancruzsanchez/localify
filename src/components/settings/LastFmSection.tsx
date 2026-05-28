import { useState } from "react";
import { Music2, LogOut, Loader2, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useLastFmSession,
  useLastFmConnect,
  useLastFmDisconnect,
} from "@/queries/lastfm";

export function LastFmSection() {
  const { data: session } = useLastFmSession();
  const connect    = useLastFmConnect();
  const disconnect = useLastFmDisconnect();

  const [form, setForm] = useState({
    api_key:    "",
    api_secret: "",
    username:   "",
    password:   "",
  });
  const [showPassword, setShowPassword] = useState(false);

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    connect.mutate(form);
  };

  const handleDisconnect = () => {
    disconnect.mutate();
  };

  return (
    <section id="lastfm" className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Last.fm</h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          Scrobble your plays and keep your listening history in sync.
        </p>
      </div>

      {session ? (
        // ── Connected state ───────────────────────────────────────────────────
        <ConnectedCard
          username={session.username}
          onDisconnect={handleDisconnect}
          isPending={disconnect.isPending}
        />
      ) : (
        // ── Login form ────────────────────────────────────────────────────────
        <form onSubmit={handleConnect} className="space-y-4">
          {/* API key setup notice */}
          <div className="flex items-start gap-3 p-4 rounded-xl text-sm"
            style={{ background: "var(--color-surface-elevated)" }}>
            <Music2 size={16} className="mt-0.5 flex-shrink-0 text-[var(--color-accent)]" />
            <p className="text-[var(--color-text-muted)] leading-relaxed">
              You need a free Last.fm API account.{" "}
              <a
                href="https://www.last.fm/api/account/create"
                target="_blank"
                rel="noreferrer"
                className="text-[var(--color-accent)] underline hover:opacity-80 inline-flex items-center gap-1"
              >
                Create one here <ExternalLink size={11} />
              </a>
            </p>
          </div>

          <Field
            label="API Key"
            type="text"
            placeholder="e.g. abc123…"
            value={form.api_key}
            onChange={(v) => setForm((f) => ({ ...f, api_key: v }))}
          />
          <Field
            label="API Secret"
            type="password"
            placeholder="Your API secret"
            value={form.api_secret}
            onChange={(v) => setForm((f) => ({ ...f, api_secret: v }))}
          />

          <div className="pt-2 border-t border-[var(--color-border)]" />

          <Field
            label="Last.fm Username"
            type="text"
            placeholder="your_username"
            value={form.username}
            onChange={(v) => setForm((f) => ({ ...f, username: v }))}
            autoComplete="username"
          />
          <Field
            label="Password"
            type={showPassword ? "text" : "password"}
            placeholder="Your Last.fm password"
            value={form.password}
            onChange={(v) => setForm((f) => ({ ...f, password: v }))}
            autoComplete="current-password"
            suffix={
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="text-xs text-[var(--color-text-muted)] hover:text-white transition-colors px-2"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            }
          />

          {connect.isError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 text-red-400 text-sm">
              <AlertCircle size={15} />
              <span>{String(connect.error)}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={
              connect.isPending ||
              !form.api_key || !form.api_secret ||
              !form.username || !form.password
            }
            className={cn(
              "w-full py-2.5 px-4 rounded-xl text-sm font-semibold transition-all",
              "bg-[var(--color-accent)] text-white",
              "hover:opacity-90 active:scale-[0.98]",
              "disabled:opacity-40 disabled:pointer-events-none",
              "flex items-center justify-center gap-2",
            )}
          >
            {connect.isPending && <Loader2 size={15} className="animate-spin" />}
            Connect to Last.fm
          </button>
        </form>
      )}

      {/* Scrobbling info */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-white uppercase tracking-widest">
          How it works
        </h3>
        <ul className="space-y-1.5 text-sm text-[var(--color-text-muted)]">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] flex-shrink-0" />
            A "Now Playing" update is sent as soon as a track starts.
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] flex-shrink-0" />
            A scrobble is recorded once you've listened to 50 % of the track (or 4 minutes).
          </li>
        </ul>
      </div>
    </section>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ConnectedCard({
  username,
  onDisconnect,
  isPending,
}: {
  username: string;
  onDisconnect: () => void;
  isPending: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between p-4 rounded-xl border border-[var(--color-accent)]/30"
      style={{ background: "var(--color-surface-elevated)" }}
    >
      <div className="flex items-center gap-3">
        <CheckCircle2 size={18} className="text-[var(--color-accent)]" />
        <div>
          <p className="text-sm font-semibold text-white">Connected</p>
          <p className="text-xs text-[var(--color-text-muted)]">{username}</p>
        </div>
      </div>
      <button
        onClick={onDisconnect}
        disabled={isPending}
        className={cn(
          "flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]",
          "hover:text-red-400 transition-colors",
          "disabled:opacity-40",
        )}
      >
        <LogOut size={14} />
        Disconnect
      </button>
    </div>
  );
}

interface FieldProps {
  label:        string;
  type:         string;
  placeholder?: string;
  value:        string;
  onChange:     (v: string) => void;
  autoComplete?: string;
  suffix?:      React.ReactNode;
}

function Field({ label, type, placeholder, value, onChange, autoComplete, suffix }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
        {label}
      </label>
      <div className="flex items-center rounded-xl overflow-hidden border border-[var(--color-border)]"
        style={{ background: "var(--color-surface-elevated)" }}>
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className={cn(
            "flex-1 bg-transparent px-3 py-2.5 text-sm text-white placeholder:text-[var(--color-text-dim)]",
            "outline-none",
          )}
        />
        {suffix}
      </div>
    </div>
  );
}
