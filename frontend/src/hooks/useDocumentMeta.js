import { useEffect } from "react";

/**
 * Canonical / og:url when VITE_SITE_URL is set, and noindex on private routes.
 * Layout owns this so individual pages do not each remember to hide themselves
 * from search engines.
 */
export default function useDocumentMeta(pathname) {
  useEffect(() => {
    const site = (import.meta.env.VITE_SITE_URL || "").replace(/\/$/, "");

    let canonical = document.querySelector('link[rel="canonical"]');
    let ogUrl = document.querySelector('meta[property="og:url"]');

    if (site) {
      if (!canonical) {
        canonical = document.createElement("link");
        canonical.setAttribute("rel", "canonical");
        document.head.appendChild(canonical);
      }
      canonical.setAttribute("href", `${site}${pathname}`);

      if (!ogUrl) {
        ogUrl = document.createElement("meta");
        ogUrl.setAttribute("property", "og:url");
        document.head.appendChild(ogUrl);
      }
      ogUrl.setAttribute("content", `${site}${pathname}`);
    }

    const privatePath =
      pathname.startsWith("/dashboard") ||
      pathname === "/account" ||
      pathname === "/checkout";

    let robots = document.querySelector('meta[name="robots"]');
    if (privatePath) {
      if (!robots) {
        robots = document.createElement("meta");
        robots.setAttribute("name", "robots");
        document.head.appendChild(robots);
      }
      robots.setAttribute("content", "noindex, nofollow");
    } else if (robots) {
      robots.remove();
    }
  }, [pathname]);
}
