import { defineConfig } from "vite";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Legacy Vite config (project builds with Next.js)
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    mode === 'development' && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
