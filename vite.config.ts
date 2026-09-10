import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const projectRoot = process.cwd();

export default defineConfig({
  root: projectRoot,
  base: "./",
  plugins: [react()],
  build: {
    outDir: path.resolve(projectRoot, "dist", "extension"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: path.resolve(projectRoot, "index.html"),
        background: path.resolve(projectRoot, "src", "extension", "background.ts"),
      },
      output: {
        entryFileNames: (chunkInfo) =>
          chunkInfo.name === "background" ? "background.js" : "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
