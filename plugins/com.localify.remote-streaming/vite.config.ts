import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: "src/index.tsx",
      formats: ["es"],
      fileName: "index",
    },
    rollupOptions: {
      external: ["react", "react-dom", "@tauri-apps/api", "@tauri-apps/api/core"],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          "@tauri-apps/api/core": "__TAURI__.core",
        },
      },
    },
    outDir: "dist",
    emptyOutDir: true,
  },
});
