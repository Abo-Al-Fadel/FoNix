import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { SCENE_CAPTIONS, captionAt } from "./sceneCaptions.js";
import Button from "../ui/Button.jsx";
import useMediaQuery from "../../hooks/useMediaQuery.js";
import usePrefersReducedMotion from "../../hooks/usePrefersReducedMotion.js";
import {
  DESKTOP_FRAMES,
  MOBILE_FRAMES,
  frameUrl,
  preloadFrames,
} from "./frameSource.js";

gsap.registerPlugin(ScrollTrigger);

/**
 * Seconds into the intro video at which the title fades in.
 *
 * Timed to the moment the headlights come up, not to the instant the page
 * loads. That is what makes it read as "welcome" rather than as UI popping
 * over an unfinished animation. Re-timed from 2.2s to 1.4s for the 3.9s cut,
 * keeping it at roughly the same proportion through the clip.
 */
const UI_REVEAL_AT = 1.4;

/** How far the pinned section scrolls, as a multiple of viewport height. */
const SCRUB_DISTANCE = 4.2;

/**
 * A line of text that rises up out of a clip window on reveal.
 *
 * The outer span clips (overflow-hidden); the inner content starts translated
 * fully below it and slides up to place. The bottom of the glyphs enters first
 * and the line fills upward, the "reveal from the bottom" motion, and it never
 * simply pops. Used for the eyebrow and each headline line so they arrive in
 * sequence via the `delay`.
 */
function ClipReveal({ show, delay = 0, children }) {
  return (
    <span className="block overflow-hidden pb-[0.08em]">
      <span
        className="block transition-transform duration-[1100ms] ease-fonix"
        style={{
          transform: show ? "translateY(0)" : "translateY(110%)",
          transitionDelay: `${delay}ms`,
        }}
      >
        {children}
      </span>
    </span>
  );
}

/**
 * Marks that the intro has already played in this browser tab.
 *
 * sessionStorage, not localStorage: the cinematic should play on arrival, but
 * not punish someone who refreshes the page or navigates home and back. It
 * resets when the tab closes, so the next real visit is the full experience.
 */
const INTRO_SEEN_KEY = "fonix.hero.introSeen";

function hasSeenIntro() {
  try {
    return window.sessionStorage.getItem(INTRO_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markIntroSeen() {
  try {
    window.sessionStorage.setItem(INTRO_SEEN_KEY, "1");
  } catch {
    /* storage disabled -- the intro simply plays again */
  }
}

/**
 * The homepage cinematic.
 *
 *   beat 1  a real <video>. Played once, never scrubbed, so there is no reason
 *           to pay the download cost of a frame sequence for it.
 *   beat 2  a <canvas> driven by extracted WebP stills, scrubbed by scroll via
 *           ScrollTrigger. Scroll has to map to an arbitrary point in the
 *           sequence, which seeking a video element cannot do smoothly.
 *
 * Scroll is locked during beat 1 so nobody scrolls past a beat that has not
 * played. Users who ask for reduced motion get the final state immediately.
 */
export default function HeroSequence() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const isMobile = useMediaQuery("(max-width: 767px)");

  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const videoRef = useRef(null);

  // Frame images and the drawn index live in refs, not state: ScrollTrigger
  // fires on every scroll frame, and a setState per frame would queue hundreds
  // of React renders a second to do something that only touches a canvas.
  const imagesRef = useRef([]);
  const drawnFrameRef = useRef(-1);

  // Skip the intro entirely if it has already played in this tab, or if the
  // user asked for reduced motion.
  const skipIntro = prefersReducedMotion || hasSeenIntro();

  const [phase, setPhase] = useState(skipIntro ? "scrub" : "intro");
  const [isUiVisible, setIsUiVisible] = useState(skipIntro);
  const [framesReady, setFramesReady] = useState(prefersReducedMotion);

  // Scroll-driven values for the depth effect and captions. State (not refs)
  // because these DO drive React output -- but they are set from a throttled
  // ScrollTrigger callback that only updates when the value actually changes.
  const [scrubProgress, setScrubProgress] = useState(0);

  const source = isMobile ? MOBILE_FRAMES : DESKTOP_FRAMES;

  // ------------------------------------------------------------------ //
  // Canvas drawing
  // ------------------------------------------------------------------ //

  /**
   * Paint one frame, cropped to cover the canvas.
   *
   * Reimplements `object-fit: cover` by hand: a canvas has no such property,
   * and drawImage stretches to whatever rectangle it is given -- which would
   * distort the car on any viewport that is not 16:9.
   */
  const drawFrame = useCallback((index) => {
    const canvas = canvasRef.current;
    const image = imagesRef.current[index];
    if (!canvas || !image?.complete || image.naturalWidth === 0) return;

    const context = canvas.getContext("2d");
    const { width, height } = canvas;
    if (width === 0 || height === 0) return;

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

  /** Size the canvas pixel buffer to its CSS box, accounting for DPR. */
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // A canvas has two sizes: its CSS box and its pixel buffer. Setting only
    // the CSS size leaves the buffer at the default 300x150, and the browser
    // stretches it to fit -- which is exactly the "page looks stretched after
    // opening devtools" bug. Capped at 2x so a 3x phone screen does not
    // allocate a needlessly huge buffer.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.floor(canvas.clientWidth * dpr);
    const height = Math.floor(canvas.clientHeight * dpr);

    if (width === canvas.width && height === canvas.height) return;

    canvas.width = width;
    canvas.height = height;

    // Resizing a canvas clears it, so it must be repainted immediately.
    if (drawnFrameRef.current >= 0) drawFrame(drawnFrameRef.current);
    else drawFrame(0);
  }, [drawFrame]);

  // ------------------------------------------------------------------ //
  // Scroll lock during the intro
  // ------------------------------------------------------------------ //

  useEffect(() => {
    if (phase !== "intro") return undefined;

    // Browsers restore scroll position on reload. Combined with the lock below
    // that used to strand the page: restored half-way down, then frozen. Taking
    // manual control means we decide where the page starts.
    const previousRestoration = window.history.scrollRestoration;
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    window.scrollTo(0, 0);

    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";

    return () => {
      body.style.overflow = previousOverflow;
      if ("scrollRestoration" in window.history) {
        window.history.scrollRestoration = previousRestoration ?? "auto";
      }
    };
  }, [phase]);

  // ------------------------------------------------------------------ //
  // Preload frames -- starts immediately so it overlaps the video
  // ------------------------------------------------------------------ //

  useEffect(() => {
    const preload = preloadFrames(source, (loaded, total) => {
      // The scrub can begin before every frame has landed; the rest arrive
      // during the opening moments of scrolling.
      if (loaded >= Math.ceil(total * 0.15)) setFramesReady(true);
    });

    imagesRef.current = preload.images;

    const first = preload.images[0];
    if (first) {
      const paintFirst = () => {
        resizeCanvas();
        drawFrame(0);
      };
      if (first.complete) paintFirst();
      else first.addEventListener("load", paintFirst, { once: true });
    }

    return preload.cancel;
  }, [source, drawFrame, resizeCanvas]);

  // ------------------------------------------------------------------ //
  // Canvas sizing -- ResizeObserver, not just window.resize
  // ------------------------------------------------------------------ //

  useEffect(() => {
    resizeCanvas();

    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    // A ResizeObserver watches the ELEMENT, not the window. That matters here
    // because GSAP's pin sets an explicit pixel width/height on the pinned
    // section: the element can change size without the window resizing at all,
    // and a window-only listener misses it.
    const observer = new ResizeObserver(() => {
      resizeCanvas();
      // The pin's start/end were measured at the old viewport height. Without
      // this the pinned section ends at the wrong scroll position after a
      // resize, and the layout appears to stretch or jump.
      ScrollTrigger.refresh();
    });
    observer.observe(canvas);

    return () => observer.disconnect();
  }, [resizeCanvas]);

  // ------------------------------------------------------------------ //
  // The scroll-scrubbed sequence
  // ------------------------------------------------------------------ //

  /*
   * useLayoutEffect, NOT useEffect -- this is load-bearing.
   *
   * ScrollTrigger's `pin: true` wraps the pinned <section> in a `.pin-spacer`
   * div that it inserts into the DOM. React knows nothing about that wrapper.
   *
   * When you navigate away, React tries to remove the section from the parent
   * it believes it has, hits the pin-spacer instead, and throws
   * "removeChild: The node to be removed is not a child of this node" --
   * which tears down the entire React root and leaves a blank white page.
   *
   * useEffect cleanup runs in the passive phase, AFTER React has already
   * mutated the DOM, so ctx.revert() never got the chance to unwrap the
   * spacer. useLayoutEffect cleanup runs synchronously during the commit
   * phase, BEFORE the removal -- so GSAP restores the original DOM structure
   * first and React then removes a node that is where it expects it to be.
   */
  useLayoutEffect(() => {
    if (prefersReducedMotion) return undefined;
    if (phase !== "scrub") return undefined;

    const container = containerRef.current;
    if (!container) return undefined;

    // gsap.context scopes everything created inside it so ctx.revert() removes
    // the trigger, the pin, and the injected spacer in one call.
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: container,
        start: "top top",
        end: `+=${SCRUB_DISTANCE * 100}%`,
        pin: true,
        // scrub: 1 eases toward the scroll position over ~1s instead of
        // snapping. On a trackpad with momentum, snapping reads as jitter; a
        // little lag reads as weight.
        scrub: 1,
        invalidateOnRefresh: true,
        onUpdate(self) {
          const lastIndex = source.count - 1;
          const index = Math.min(
            lastIndex,
            Math.max(0, Math.round(self.progress * lastIndex)),
          );
          if (index !== drawnFrameRef.current) drawFrame(index);

          // Rounded to 3dp before storing: without it, every sub-pixel scroll
          // event would be a new float and re-render React continuously.
          setScrubProgress(Math.round(self.progress * 1000) / 1000);
          // Clear the hero content quickly once scrolling starts, so it does
          // not sit on top of the first scene caption (which begins at 0.10).
          setIsUiVisible(self.progress < 0.05);
        },
      });
    }, container);

    // ScrollTrigger measures the document when it is created, while fonts and
    // the first frames are still settling. One refresh on the next tick makes
    // the pin's start/end reflect the final layout.
    const refresh = window.setTimeout(() => ScrollTrigger.refresh(), 80);

    return () => {
      window.clearTimeout(refresh);
      ctx.revert();
    };
  }, [phase, prefersReducedMotion, source.count, drawFrame]);

  // ------------------------------------------------------------------ //
  // Video timing
  // ------------------------------------------------------------------ //

  const finishIntro = useCallback(() => {
    setPhase((current) => (current === "intro" ? "scrub" : current));
    setIsUiVisible(true);
    markIntroSeen();
  }, []);

  useEffect(() => {
    if (skipIntro) return undefined;

    const video = videoRef.current;
    if (!video) return undefined;

    // The nav and title arrive 2.2s in -- when the headlights come up, not the
    // instant the page loads. Driven off the video clock rather than a
    // setTimeout so a stalled video cannot desynchronise it.
    const onTimeUpdate = () => {
      if (video.currentTime >= UI_REVEAL_AT) {
        setIsUiVisible(true);
        video.removeEventListener("timeupdate", onTimeUpdate);
      }
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("ended", finishIntro);
    // A video that fails to load must never lock scroll forever.
    video.addEventListener("error", finishIntro);

    // Autoplay can be refused (browser setting, iOS low-power mode). The
    // promise rejecting is the only way to find out, and the right response is
    // to skip the theatrics rather than trap the user behind a video that will
    // never play.
    const attempt = video.play();
    if (attempt?.catch) attempt.catch(() => finishIntro());

    // Scroll-to-skip: an impatient visitor who tries to scroll during the
    // locked intro should not feel stuck. Scrolling fast-forwards the clip
    // (and keeps accelerating the more they scroll) rather than doing nothing,
    // so their input is acknowledged instead of swallowed. This is why the
    // SCROLL hint is shown from the very start, not only after the intro.
    const onIntent = () => {
      // Cap at 8x so it always feels like *their* scroll drove it forward,
      // not like the intro just gave up and skipped.
      video.playbackRate = Math.min(video.playbackRate + 1.6, 8);
    };
    window.addEventListener("wheel", onIntent, { passive: true });
    window.addEventListener("touchmove", onIntent, { passive: true });
    window.addEventListener("keydown", (e) => {
      // Space / PageDown / ArrowDown are all "I want to scroll" signals.
      if ([" ", "PageDown", "ArrowDown"].includes(e.key)) onIntent();
    });

    // Safety net: if 'ended' never fires for any reason, release the lock
    // anyway. A hero that can trap the page is worse than one that ends early.
    const failsafe = window.setTimeout(finishIntro, 12000);

    return () => {
      window.clearTimeout(failsafe);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("ended", finishIntro);
      video.removeEventListener("error", finishIntro);
      window.removeEventListener("wheel", onIntent);
      window.removeEventListener("touchmove", onIntent);
    };
  }, [skipIntro, finishIntro]);

  // ------------------------------------------------------------------ //
  // Derived render values
  // ------------------------------------------------------------------ //

  const isIntro = phase === "intro";
  const caption = captionAt(scrubProgress);

  // Depth: the hero content drifts up as you scroll while the car stays put.
  // Two layers changing at different rates is the strongest depth cue available
  // without a real cutout of the car.
  const heroShift = -scrubProgress * 90;

  return (
    <section
      ref={containerRef}
      className="relative h-[100svh] w-full overflow-hidden bg-void"
      aria-label="FoNix Ignis introduction"
    >
      {/* ---------- Layer 1: the scroll-scrubbed canvas ---------- */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        // Decorative: it conveys the same thing as the heading, and a screen
        // reader cannot read a canvas regardless.
        aria-hidden="true"
      />

      {/* Reduced-motion fallback: a real <img>, in the DOM immediately, no
          JavaScript timing involved. That is the point -- no wait, no sequence,
          just the final state. */}
      {prefersReducedMotion ? (
        <img
          src={frameUrl(source, Math.floor(source.count * 0.56))}
          alt="The FoNix Ignis in a dark studio with its dihedral door raised."
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}

      {/* ---------- Layer 3: the intro video ---------- */}
      {!skipIntro ? (
        <video
          ref={videoRef}
          // The 3.9s cut, not the original 6.2s. A hero that locks scroll is
          // borrowing the visitor's patience -- the shorter the loan, the
          // better. UI_REVEAL_AT is timed against this edit.
          src="/video/intro-short.mp4"
          // muted is not optional: every browser blocks autoplay with sound.
          muted
          // playsInline stops iOS Safari taking the video fullscreen, which
          // would replace the whole page with a native player.
          playsInline
          preload="auto"
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1100ms] ease-[var(--ease-fonix)] ${
            isIntro ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          aria-hidden="true"
        />
      ) : null}

      {/* Vignette: above the media, below the type, so the wordmark keeps its
          contrast over the brightest part of the footage. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-void/75 via-transparent to-void"
      />

      {/* ---------- Layer 4: hero content ---------- */}
      {/*
        An editorial, bottom-left composition rather than a centred wordmark.
        Real marque sites (Porsche, Lamborghini) anchor a headline and a single
        clear call to action to one corner over a full-bleed car, instead of
        floating a logo and a tagline dead-centre. The tagline is now the
        HEADLINE, set in the display face and given supporting copy, so it reads
        as a statement about the car rather than a caption drifting in space.

        Each line rises out of its own clip window on reveal (the motion that
        was liked), and the whole block drifts up slightly with scroll for
        depth before the scene captions take over.
      */}
      <div
        className="pointer-events-none absolute inset-0 flex items-end"
        style={{
          transform: `translateY(${heroShift}px)`,
          willChange: "transform",
        }}
      >
        <div className="fx-container w-full pb-20 md:pb-28">
          <div
            className={`max-w-3xl transition-opacity duration-500 ${
              isUiVisible ? "opacity-100" : "opacity-0"
            }`}
          >
            <ClipReveal show={isUiVisible}>
              <p className="fx-eyebrow">The FoNix Ignis &middot; Flagship</p>
            </ClipReveal>

            {/*
              Anton, the one display moment on the site, carries the headline.
              Two lines, each rising from its own clip window, with the payoff
              word in ember. Both spans are left-aligned blocks, so the first
              letter of each line stacks vertically -- the "T" of THE FUTURE sits
              directly above the "I" of IGNITED. No trailing punctuation: a
              headline is not a sentence.
            */}
            <h1
              className="mt-4 font-display uppercase leading-[0.9] tracking-[0.01em] text-white"
              style={{ fontSize: "clamp(2.75rem, 1rem + 8.5vw, 7.5rem)" }}
            >
              <ClipReveal show={isUiVisible} delay={80}>
                <span className="block">The future</span>
              </ClipReveal>
              <ClipReveal show={isUiVisible} delay={160}>
                <span className="block text-ember">ignited</span>
              </ClipReveal>
            </h1>

            <p
              className={`mt-6 max-w-xl font-body text-sm leading-relaxed text-white/70 transition-all duration-1000 ease-fonix md:text-base ${
                isUiVisible
                  ? "translate-y-0 opacity-100 delay-300"
                  : "translate-y-4 opacity-0"
              }`}
            >
              Four independent motors. 412 km/h. Not a decibel of engine noise.
              The car every other FoNix is measured against.
            </p>

            <div
              className={`pointer-events-auto mt-9 flex flex-col gap-3 sm:flex-row sm:items-center transition-all duration-1000 ease-fonix ${
                isUiVisible
                  ? "translate-y-0 opacity-100 delay-[420ms]"
                  : "translate-y-4 opacity-0"
              }`}
            >
              <Button to="/store/ignis" size="lg">
                Explore the Ignis
              </Button>
              <Button to="/store" variant="ghost" size="lg">
                See all six models
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ---------- Layer 5: scene captions ---------- */}
      {/*
        Rendered as one stack of absolutely-positioned blocks whose opacity is
        driven by scroll progress, rather than mounting/unmounting them. Keeping
        them all in the DOM means the browser never re-lays-out mid-scroll,
        which is what keeps the scrub smooth.
      */}
      {!prefersReducedMotion ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 px-6 pb-16 md:px-12 md:pb-20">
          <div className="fx-container relative h-40 md:h-36">
            {SCENE_CAPTIONS.map((entry) => {
              const active = caption?.title === entry.title;
              return (
                <figure
                  key={entry.title}
                  className={`absolute inset-x-0 bottom-0 max-w-md transition-all duration-700 ease-[var(--ease-fonix)] ${
                    active
                      ? "translate-y-0 opacity-100"
                      : "translate-y-3 opacity-0"
                  }`}
                  // Hidden from assistive tech when inactive, so a screen
                  // reader does not announce all four captions at once.
                  aria-hidden={!active}
                >
                  <figcaption>
                    <p className="fx-eyebrow">{entry.eyebrow}</p>
                    <h2 className="mt-3 font-heading text-xl font-bold text-white md:text-2xl">
                      {entry.title}
                    </h2>
                    <p className="mt-2.5 font-body text-sm leading-relaxed text-white/65">
                      {entry.body}
                    </p>
                  </figcaption>
                </figure>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* ---------- Layer 6: scroll hint ---------- */}
      {/*
        Shown from the very beginning, including during the locked intro. That
        is deliberate: scrolling during the intro fast-forwards it (see the
        wheel/touch listener above), so the hint is an honest invitation rather
        than a lie about what scrolling does. It appears together with the
        title and only fades once the scrub has actually begun.
      */}
      {!prefersReducedMotion ? (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-0 bottom-8 flex flex-col items-center gap-3 transition-opacity duration-700 ${
            isUiVisible && scrubProgress < 0.03 ? "opacity-100" : "opacity-0"
          }`}
        >
          <span className="font-body text-[10px] uppercase tracking-[0.34em] text-white/40">
            {isIntro ? "Scroll to skip" : "Scroll"}
          </span>
          <span className="relative block h-10 w-px overflow-hidden bg-white/15">
            <span className="fx-scroll-tick absolute inset-x-0 top-0 block h-4 bg-ember" />
          </span>
        </div>
      ) : null}
    </section>
  );
}
