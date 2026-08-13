import "@testing-library/jest-dom";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

/**
 * Runs once before the whole suite.
 *
 * jsdom is a DOM, but not a complete browser: it implements the tree and events
 * but leaves out a handful of APIs the app relies on. Each test would otherwise
 * crash on a missing function rather than on the thing it means to check, so we
 * stub them here in one place.
 */

// matchMedia: used by usePrefersReducedMotion and useMediaQuery. jsdom has no
// media engine, so without this any component that reads a media query throws.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(), // deprecated, but some libraries still call it
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});

// IntersectionObserver: AnimatedNumber starts its count when scrolled into view.
// jsdom has no viewport, so we provide a no-op that never fires. Tests that need
// the observer to "see" the element override this per-test.
class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.IntersectionObserver = MockIntersectionObserver;
globalThis.IntersectionObserver = MockIntersectionObserver;

// Unmount and clear the DOM after every test, so one test's render never leaks
// into the next. Without this, getByText could match a node left over from an
// earlier test and pass for the wrong reason.
afterEach(() => cleanup());
