import { useState, useEffect } from "react";
import { Code } from "lucide-react";

export function DeveloperSection() {
  const [customCss, setCustomCss] = useState("");
  const [customJs, setCustomJs] = useState("");

  useEffect(() => {
    const savedCss = localStorage.getItem("localify:custom_css") ?? "";
    const savedJs = localStorage.getItem("localify:custom_js") ?? "";
    setCustomCss(savedCss);
    setCustomJs(savedJs);
  }, []);

  const applyCss = (css: string) => {
    let styleEl = document.getElementById("localify-custom-css") as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "localify-custom-css";
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = css;
  };

  const applyJs = (js: string) => {
    const scriptId = "localify-custom-js";
    const existing = document.getElementById(scriptId);
    if (existing) existing.remove();
    if (!js.trim()) return;
    try {
      const script = document.createElement("script");
      script.id = scriptId;
      script.textContent = js;
      document.body.appendChild(script);
    } catch (e) {
      console.error("Custom JS error:", e);
    }
  };

  const handleCssChange = (value: string) => {
    setCustomCss(value);
    localStorage.setItem("localify:custom_css", value);
    applyCss(value);
  };

  const handleJsChange = (value: string) => {
    setCustomJs(value);
    localStorage.setItem("localify:custom_js", value);
    applyJs(value);
  };

  const handleReset = () => {
    handleCssChange("");
    handleJsChange("");
  };

  return (
    <section id="developer" className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Developer</h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          Inject custom CSS and JavaScript into the app. Changes apply immediately.
          Use this to tweak the appearance or add custom behavior.
        </p>
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-white">
          <Code size={14} className="text-[var(--color-accent)]" />
          Custom CSS
        </label>
        <textarea
          value={customCss}
          onChange={(e) => handleCssChange(e.target.value)}
          placeholder="/* Enter CSS here, e.g. */
body { font-size: 14px; }"
          className="w-full h-32 bg-[var(--color-surface-elevated)] text-white text-xs font-mono rounded-lg border border-[var(--color-border)] p-3 resize-y outline-none focus:border-[var(--color-accent)]/60 placeholder:text-white/20"
          spellCheck={false}
        />
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-white">
          <Code size={14} className="text-[var(--color-accent)]" />
          Custom JavaScript
        </label>
        <textarea
          value={customJs}
          onChange={(e) => handleJsChange(e.target.value)}
          placeholder="// Enter JavaScript here
console.log('Localify ready');"
          className="w-full h-32 bg-[var(--color-surface-elevated)] text-white text-xs font-mono rounded-lg border border-[var(--color-border)] p-3 resize-y outline-none focus:border-[var(--color-accent)]/60 placeholder:text-white/20"
          spellCheck={false}
        />
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => {
            applyCss(customCss);
            applyJs(customJs);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] text-black font-semibold text-sm rounded-full hover:bg-[var(--color-accent-hover)] transition-colors"
        >
          Apply
        </button>
        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-4 py-2 border border-white/20 text-white font-semibold text-sm rounded-full hover:border-white/40 transition-colors"
        >
          Reset
        </button>
      </div>
    </section>
  );
}
