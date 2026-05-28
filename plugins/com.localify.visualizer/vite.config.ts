import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Builds the plugin as a self-contained ES module.
// React and @tauri-apps/api are marked external — the Localify renderer
// already provides them as globals, so the plugin doesn't need to bundle them.
export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: "src/index.tsx",
      formats: ["es"],
      fileName: "index",
    },
    rollupOptions: {
      external: ["react", "react-dom", "@tauri-apps/api", "@tauri-apps/api/event"],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          "@tauri-apps/api/event": "__TAURI__.event",
        },
      },
    },
    outDir: "dist",
    emptyOutDir: true,
  },
});
