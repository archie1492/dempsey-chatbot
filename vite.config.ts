import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Builds one self-contained IIFE script + one stylesheet for Webflow embedding.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "react-dom/server": new URL("./src/react-dom-server-stub.ts", import.meta.url).pathname },
  },
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    target: "es2019",
    outDir: "dist",
    emptyOutDir: true,
    cssCodeSplit: false,
    sourcemap: false,
    lib: {
      entry: "src/main.tsx",
      name: "DempseyChatbot",
      formats: ["iife"],
      fileName: () => "dempsey-chatbot.js",
      cssFileName: "dempsey-chatbot",
    },
  },
});
