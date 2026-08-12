import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // Tailwind v4 runs as a Vite plugin rather than a PostCSS step -- there is no
  // tailwind.config.js in this project on purpose. The design tokens live in
  // src/index.css under @theme, which keeps the whole design system in one
  // readable CSS file instead of split across a JS config and a stylesheet.
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        /**
         * Split the heavy third-party libraries out of the app bundle.
         *
         * GSAP and Framer Motion together are the bulk of the JavaScript here,
         * and they change only when their versions do. As separate chunks they
         * stay in the browser cache across every deploy of the site's own code,
         * instead of being re-downloaded because a button's class changed.
         *
         * Written as a function, not the `{name: [modules]}` object form:
         * Vite 8 bundles with Rolldown, which only accepts the function
         * signature and fails the build outright on an object.
         */
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("gsap") || id.includes("framer-motion")) {
            return "animation";
          }
          if (id.includes("react-router")) return "router";
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    // Fail loudly instead of silently moving to 5174 if the port is taken --
    // Django's CORS_ALLOWED_ORIGINS names 5173 explicitly, so a silent port
    // change would produce confusing CORS errors rather than a clear one.
    strictPort: true,
  },
});
