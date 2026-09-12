import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const projectRoot = process.cwd();
const buildOutputRoot = process.env.TRIADICHROME_BUILD_OUTPUT
  ? path.resolve(process.env.TRIADICHROME_BUILD_OUTPUT)
  : path.resolve(projectRoot, "dist", "vite");

export default defineConfig({
  root: projectRoot,
  base: "./",
  plugins: [react()],
  build: {
    outDir: buildOutputRoot,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: path.resolve(projectRoot, "index.html"),
        background: path.resolve(
          projectRoot,
          "Triadichrome-extension",
          "src",
          "extension",
          "background.ts",
        ),
      },
      output: {
        entryFileNames: (chunkInfo) =>
          chunkInfo.name === "background"
            ? "src/extension/background.js"
            : "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
