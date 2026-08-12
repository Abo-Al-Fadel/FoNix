import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import Button from "../ui/Button.jsx";
import useMediaQuery from "../../hooks/useMediaQuery.js";
import usePrefersReducedMotion from "../../hooks/usePrefersReducedMotion.js";
import {
  DESKTOP_FRAMES,
  MOBILE_FRAMES,
  frameUrl,
  preloadFrames,
} from "./frameSource.js";

// GSAP plugins are registered once at module scope. Registering inside the
// component would re-run on every mount for no benefit.
gsap.registerPlugin(ScrollTrigger);

/** Seconds into the intro video at which the nav and title fade in. */
const UI_REVEAL_AT = 2.2;

/**
 * How far the pinned section scrolls, as a multiple of viewport height. Higher
 * means a slower, more deliberate scrub over the same 215 frames.
 */
const SCRUB_DISTANCE = 3.4;

/**
 * The homepage cinematic.
 *
 * Two beats, deliberately built with different techniques:
 *
 *   0-6s   a real <video> element. It plays once and is never scrubbed, so
 *          there is no reason to pay the download and decode cost of a frame
 *          sequence for it -- a compressed video is dramatically smaller than
 *          the same six seconds as stills.
 *
 *   after  a <canvas> driven by 215 extracted WebP stills, scrubbed by scroll
 *          position via ScrollTrigger. This part genuinely needs frames:
 *          scroll has to map to an arbitrary point in the sequence, and seeking
 *          a video element per scroll event is neither frame-accurate nor
 *          smooth.
 *
 * Scroll is locked until the video finishes so nobody scrolls past a beat that
 * has not played, and the whole thing is skipped for users who ask for reduced
 * motion.
 */
export default function HeroSequence() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const isMobile = useMediaQuery("(max-width: 767px)");

  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const videoRef = useRef(null);

  // Frame images and the currently drawn index live in refs, not state:
  // ScrollTrigger fires these on every scroll frame, and a setState per frame
  // would queue hundreds of React renders a second for something that only
  // needs to touch a canvas.
  const imagesRef = useRef([]);
  const drawnFrameRef = useRef(-1);

  // "intro" -> video playing, scroll locked.
  // "scrub" -> canvas live, scroll unlocked.
  const [phase, setPhase] = useState(prefersReducedMotion ? "scrub" : "intro");
  const [isUiVisible, setIsUiVisible] = useState(prefersReducedMotion);
  const [framesReady, setFramesReady] = useState(prefersReducedMotion);

  const source = isMobile ? MOBILE_FRAMES : DESKTOP_FRAMES;

  // ------------------------------------------------------------------ //
  // Canvas drawing
  // ------------------------------------------------------------------ //

  /**
   * Paint one frame, letterboxed to cover the canvas.
   *
   * This reimplements `object-fit: cover` by hand because a canvas has no such
   * property -- drawImage stretches to whatever rectangle it is given, which
   * would distort the car on any viewport that is not 16:9.
   */
  const drawFrame = useCallback((index) => {
    const canvas = canvasRef.current;
    const image = imagesRef.current[index];
    if (!canvas || !image?.complete || image.naturalWidth === 0) return;

    const context = canvas.getContext("2d");
    const { width, height } = canvas;

    const scale = Math.max(
      width / image.naturalWidth,
      height / image.naturalHeight,
    );
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;

    context.clearRect(0, 0, width, height);
    context.drawImage(
      image,
      (width - drawWidth) / 2,
      (height - drawHeight) / 2,
      drawWidth,
      drawHeight,
    );
    drawnFrameRef.current = index;
  }, []);

  /** Size the canvas backing store to the viewport, accounting for DPR. */
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // A canvas has two sizes: its CSS box and its pixel buffer. Setting only
    // the CSS size leaves the buffer at the default 300x150 and the result is
    // visibly blurry. Capping DPR at 2 avoids allocating a needlessly huge
    // buffer on 3x phone screens for no visible gain.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);

    // Repaint at the new size, or the canvas stays blank after a resize.
    if (drawnFrameRef.current >= 0) drawFrame(drawnFrameRef.current);
  }, [drawFrame]);

  // ------------------------------------------------------------------ //
  // Scroll lock during the intro
  // ------------------------------------------------------------------ //

  useEffect(() => {
    if (phase !== "intro") return undefined;

    // A refresh part-way down the page would otherwise start the intro with
    // the viewport somewhere in the middle of it.
    window.scrollTo(0, 0);

    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";

    return () => {
      // Restoring the previous value rather than hardcoding "" means this
      // cannot clobber an overflow set by something else (the mobile nav
      // drawer, say).
      body.style.overflow = previousOverflow;
    };
  }, [phase]);

  // ------------------------------------------------------------------ //
  // Preload frames -- started immediately, so it overlaps the video
  // ------------------------------------------------------------------ //

  useEffect(() => {
    const preload = preloadFrames(source, (loaded, total) => {
      // The scrub can start before every frame has landed: the first ~15% is
      // all that is needed to begin, and the rest arrives during the opening
      // moments of scrolling. Waiting for all 215 would idle the user for no
      // reason.
      if (loaded >= Math.ceil(total * 0.15)) setFramesReady(true);
    });

    imagesRef.current = preload.images;

    // Paint the first frame as soon as it is decodable, so the canvas is never
    // a black rectangle behind the fading video.
    const first = preload.images[0];
    if (first) {
      const paintFirst = () => drawFrame(0);
      if (first.complete) paintFirst();
      else first.addEventListener("load", paintFirst, { once: true });
    }

    return preload.cancel;
  }, [source, drawFrame]);

  // ------------------------------------------------------------------ //
  // Canvas sizing
  // ------------------------------------------------------------------ //

  useEffect(() => {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [resizeCanvas]);

  // ------------------------------------------------------------------ //
  // The scroll-scrubbed sequence
  // ------------------------------------------------------------------ //

  useEffect(() => {
    // Reduced motion: no pinning, no scrubbing, no scroll hijacking. The hero
    // is a still image and the page scrolls normally.
    if (prefersReducedMotion) return undefined;
    if (phase !== "scrub") return undefined;

    const container = containerRef.current;
    if (!container) return undefined;

    // gsap.context scopes everything created inside it, so ctx.revert() below
    // removes the ScrollTrigger, the pin, and the pin spacer it injected into
    // the DOM. Without this, StrictMode's double-mount in development leaves
    // two live triggers fighting over the same element.
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: container,
        start: "top top",
        end: `+=${SCRUB_DISTANCE * 100}%`,
        // pin holds the hero still while the page scrolls "through" it, which
        // is what converts scroll distance into sequence position.
        pin: true,
        // scrub: 1 eases the canvas toward the scroll position over ~1s rather
        // than snapping to it. On a trackpad with momentum, snapping reads as
        // jittery; a little lag reads as weight.
        scrub: 1,
        // Recalculate on resize, but not on mobile browser-chrome show/hide --
        // which fires resize constantly and would restart the pin mid-scroll.
        invalidateOnRefresh: true,
        onUpdate(self) {
          const lastIndex = source.count - 1;
          const index = Math.min(
            lastIndex,
            Math.max(0, Math.round(self.progress * lastIndex)),
          );

          // Skip the redraw when the frame has not actually changed -- with 215
          // frames over ~3400px of scroll, most scroll events land on the frame
          // already on screen.
          if (index !== drawnFrameRef.current) drawFrame(index);

          // Fade the title out over the first fifth of the scrub, so the
          // wordmark clears the frame before the car reaches the door.
          setIsUiVisible(self.progress < 0.2);
        },
      });
    }, container);

    // ScrollTrigger measures the document on creation. The fonts and the first
    // frames are still settling at that moment, so a refresh on the next tick
    // makes sure the pin's start/end are based on the final layout.
    const refresh = window.setTimeout(() => ScrollTrigger.refresh(), 60);

    return () => {
      window.clearTimeout(refresh);
      ctx.revert();
    };
  }, [phase, prefersReducedMotion, source.count, drawFrame]);

  // ------------------------------------------------------------------ //
  // Video timing
  // ------------------------------------------------------------------ //

  /** Ends the intro beat: unlocks scroll and hands over to the canvas. */
  const finishIntro = useCallback(() => {
    setPhase((current) => (current === "intro" ? "scrub" : current));
    setIsUiVisible(true);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) return undefined;

    const video = videoRef.current;
    if (!video) return undefined;

    // The nav and title arrive 2.2s in -- the moment the headlights come up,
    // not the instant the page loads. Timing it to the beat is what makes it
    // read as "welcome" rather than as UI popping over an unfinished animation.
    // Driven off the video clock rather than a setTimeout, so a stalled video
    // does not desynchronise it.
    const onTimeUpdate = () => {
      if (video.currentTime >= UI_REVEAL_AT) {
        setIsUiVisible(true);
        video.removeEventListener("timeupdate", onTimeUpdate);
      }
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("ended", finishIntro);
    // A video that fails to load must not lock scroll forever.
    video.addEventListener("error", finishIntro);

    // Autoplay can be refused (a browser setting, or iOS low-power mode). The
    // promise rejecting is the only way to find out, and the correct response
    // is to skip the theatrics rather than trap the user behind a video that
    // will never play.
    const attempt = video.play();
    if (attempt?.catch) {
      attempt.catch(() => finishIntro());
    }

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("ended", finishIntro);
      video.removeEventListener("error", finishIntro);
    };
  }, [prefersReducedMotion, finishIntro]);

  // ------------------------------------------------------------------ //
  // Render
  // ------------------------------------------------------------------ //

  const isIntro = phase === "intro";

  return (
    <section
      ref={containerRef}
      className="relative h-screen w-full overflow-hidden bg-void"
      aria-label="FoNix Ignis introduction"
    >
      {/* --- Beat 2: the scroll-scrubbed canvas (underneath the video) --- */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        // The canvas is pure decoration: it conveys the same thing as the
        // heading and the still fallback below, and a screen reader has no way
        // to read a canvas anyway.
        aria-hidden="true"
      />

      {/*
        Reduced-motion fallback. A real <img> rather than a canvas draw, so it
        is present in the DOM immediately with no JavaScript timing involved --
        which is the point: no wait, no sequence, just the final state.
      */}
      {prefersReducedMotion ? (
        <img
          src={frameUrl(source, Math.floor(source.count * 0.56))}
          alt="The FoNix Ignis in a dark studio with its dihedral door raised."
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}

      {/* --- Beat 1: the intro video --- */}
      {!prefersReducedMotion ? (
        <video
          ref={videoRef}
          src="/video/intro.mp4"
          // muted is not optional: every browser blocks autoplay with sound.
          muted
          // playsInline stops iOS Safari taking the video fullscreen, which
          // would replace the whole page with a native player.
          playsInline
          preload="auto"
          // Not `loop` -- the "ended" event is what hands over to the canvas.
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1200ms] ease-[var(--ease-fonix)] ${
            isIntro ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          aria-hidden="true"
        />
      ) : null}

      {/* Vignette. Sits above the media and below the type, so the wordmark
          keeps its contrast over the brightest part of the footage. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-void/70 via-transparent to-void"
      />

      {/* --- Title --- */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
        <div
          className={`flex flex-col items-center text-center transition-all duration-1000 ease-[var(--ease-fonix)] ${
            isUiVisible
              ? "translate-y-0 opacity-100"
              : "translate-y-4 opacity-0"
          }`}
        >
          {/*
            The only place Anton appears on the entire site. Spending the
            display face in exactly one moment is what gives it any weight --
            used on every heading it would just be a loud font.
          */}
          {/*
            leading-none, not a tighter value. Anton's glyphs are taller than
            their em box, so a line-height below 1 lets the line box end above
            the letterforms -- and the tagline below then renders *inside* the
            wordmark. The type still reads tight at this size without stealing
            space it does not own.
          */}
          <h1
            className="font-display leading-none tracking-[0.02em] text-white"
            style={{ fontSize: "clamp(4rem, 1rem + 17vw, 15rem)" }}
          >
            FONIX
          </h1>

          <p className="mt-5 font-body text-xs uppercase tracking-[0.42em] text-muted md:mt-7 md:text-sm">
            The future, ignited
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Button to="/store/ignis" size="lg">
              Meet the Ignis
            </Button>
            <Button to="/store" variant="ghost" size="lg">
              The full range
            </Button>
          </div>
        </div>
      </div>

      {/* --- Scroll hint --- */}
      {!prefersReducedMotion ? (
        <div
          aria-hidden="true"
          className={`absolute inset-x-0 bottom-8 flex flex-col items-center gap-3 transition-opacity duration-700 ${
            !isIntro && framesReady && isUiVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          <span className="font-body text-[10px] uppercase tracking-[0.34em] text-faint">
            Scroll
          </span>
          {/* A line that travels down its own track -- quieter than a bouncing
              chevron, and it survives being looked at for thirty seconds. */}
          <span className="relative block h-10 w-px overflow-hidden bg-white/15">
            <span className="fx-scroll-tick absolute inset-x-0 top-0 block h-4 bg-ember" />
          </span>
        </div>
      ) : null}
    </section>
  );
}
