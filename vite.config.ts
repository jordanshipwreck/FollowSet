/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";

// One id per build. It names the service worker cache, so every deploy replaces the old shell.
const BUILD_ID = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12);

function stampServiceWorker(): Plugin {
  return {
    name: "stamp-sw",
    apply: "build",
    closeBundle() {
      const file = resolve(process.cwd(), "dist/sw.js");
      writeFileSync(file, readFileSync(file, "utf8").replaceAll("__BUILD_ID__", BUILD_ID));
    },
  };
}

export default defineConfig({
  // Relative base: works at /FollowSet/ on Pages and at / locally.
  base: "./",
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [react(), stampServiceWorker()],
  build: { target: "es2020", assetsInlineLimit: 0 },
  test: { environment: "node" },
});
