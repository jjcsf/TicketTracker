import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client/src"),
      "@shared": path.resolve(__dirname, "./shared"),
      "@assets": path.resolve(__dirname, "./attached_assets"),
    },
  },
  build: {
    outDir: "dist/public",
    rollupOptions: {
      input: path.resolve(__dirname, "client/index-container.html"),
    },
  },
  server: {
    proxy: {
      "/api": "http://localhost:5000",
    },
  },
});