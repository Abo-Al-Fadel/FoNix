import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const RANGE_SLUGS = ["ignis", "aurea", "cinder", "vesper", "lumen", "atlas"];

const ROBOTS_DISALLOW = [
  "/dashboard",
  "/account",
  "/checkout",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
];

function apiOriginFromEnv(env) {
  if (env.VITE_API_ORIGIN) return env.VITE_API_ORIGIN.replace(/\/$/, "");
  const base = env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api";
  try {
    return new URL(base).origin;
  } catch {
    return "";
  }
}

function robotsTxt(siteUrl) {
  const lines = ["User-agent: *", "Allow: /", ...ROBOTS_DISALLOW.map((path) => `Disallow: ${path}`)];
  if (siteUrl) {
    lines.push("", `Sitemap: ${siteUrl}/sitemap.xml`);
  }
  return `${lines.join("\n")}\n`;
}

function sitemapXml(siteUrl) {
  const paths = [
    "/",
    "/store",
    ...RANGE_SLUGS.map((slug) => `/store/${slug}`),
    "/about",
    "/contact",
    "/privacy",
    "/terms",
    "/cookies",
  ];
  const urls = paths
    .map(
      (path) =>
        `  <url>\n    <loc>${siteUrl}${path === "/" ? "/" : path}</loc>\n  </url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function fonixHtmlOrigin(origin) {
  return {
    name: "fonix-api-origin",
    transformIndexHtml(html) {
      if (origin) {
        return html.replaceAll("__FONIX_API_ORIGIN__", origin);
      }
      return html.replace(
        /\n\s*<link rel="preconnect" href="__FONIX_API_ORIGIN__" \/>\s*/,
        "\n",
      );
    },
  };
}

function fonixSeoFiles(siteUrl) {
  return {
    name: "fonix-seo-files",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "robots.txt",
        source: robotsTxt(siteUrl),
      });
      if (siteUrl) {
        this.emitFile({
          type: "asset",
          fileName: "sitemap.xml",
          source: sitemapXml(siteUrl),
        });
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const apiOrigin = apiOriginFromEnv(env);
  const siteUrl = (env.VITE_SITE_URL || "").replace(/\/$/, "");

  return {
    // Tailwind v4 runs as a Vite plugin rather than a PostCSS step -- there is no
    // tailwind.config.js in this project on purpose. The design tokens live in
    // src/index.css under @theme, which keeps the whole design system in one
    // readable CSS file instead of split across a JS config and a stylesheet.
    plugins: [
      react(),
      tailwindcss(),
      fonixHtmlOrigin(apiOrigin),
      fonixSeoFiles(siteUrl),
    ],

    // Vitest configuration. jsdom gives the tests a fake DOM so React components
    // and browser APIs (localStorage, matchMedia) work without a real browser.
    // setupFiles runs once before the suite to register jest-dom matchers and
    // stub the APIs jsdom does not implement.
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: "./src/test/setup.js",
      css: false,
    },
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
  };
});
