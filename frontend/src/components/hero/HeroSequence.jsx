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
 * loads — that is what makes it read as "welcome" rather than as UI popping
 * over an unfinished animation. Re-timed from 2.2s to 1.4s for the 3.9s cut,
 * keeping it at roughly the same proportion through the clip.
 */
const UI_REVEAL_AT = 1.4;

/** How far the pinned section scrolls, as a multiple of viewport height. */
const SCRUB_DISTANCE = 4.2;

/**
 * Fades the bottom of the hero wordmark out where the car's bonnet crosses it.
 *
 * Cut against the front-on pose the intro video settles into: the letterforms
 * stay solid through their top three-quarters, then dissolve over the band
 * where the bodywork sits. Stopping short of fully transparent (0.06 alpha at
 * the base) leaves a whisper of the letter visible, which reads as light
 * catching the type through the scene rather than as a hard clipping edge.
 */
const HERO_OCCLUSION_MASK =
  "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 66%, rgba(0,0,0,0.62) 86%, rgba(0,0,0,0.22) 100%)";

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
          setIsUiVisible(self.progress < 0.14);
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

    // Safety net: if 'ended' never fires for any reason, release the lock
    // anyway. A hero that can trap the page is worse than one that ends early.
    const failsafe = window.setTimeout(finishIntro, 12000);

    return () => {
      window.clearTimeout(failsafe);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("ended", finishIntro);
      video.removeEventListener("error", finishIntro);
    };
  }, [skipIntro, finishIntro]);

  // ------------------------------------------------------------------ //
  // Derived render values
  // ------------------------------------------------------------------ //

  const isIntro = phase === "intro";
  const caption = captionAt(scrubProgress);

  // Depth: the wordmark drifts up and scales down as you scroll, while the car
  // stays put. Different rates of change between two layers is the strongest
  // depth cue available without a real cutout of the car.
  const wordmarkShift = -scrubProgress * 130;
  const wordmarkScale = 1 - scrubProgress * 0.12;

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

      {/* ---------- Layer 4: the title block ---------- */}
      {/*
        DEPTH.

        True occlusion would need an alpha cutout of the car, and these assets
        cannot give us one -- the car and the studio are both near-black, so no
        luminance threshold separates them (89% of pixels sit below 64).

        So the depth is faked with two cues that need no cutout:

          1. A mask that fades the bottom of the letterforms out exactly where
             the car's bonnet crosses them. The eye reads the missing section as
             the car passing in front of the type.
          2. Parallax -- the wordmark drifts up and shrinks as you scroll while
             the footage stays put. Two layers changing at different rates is
             the strongest depth cue available.

        The mask is only applied once the intro video has finished. During the
        video the car is moving, so a fixed mask would not line up with
        anything; at the end it settles into the front-on pose the mask is cut
        for. The wordmark appearing to sink behind the car as the intro lands is
        the nicest moment in the sequence.
      */}
      <div
        className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6"
        style={{
          transform: `translateY(${wordmarkShift}px) scale(${wordmarkScale})`,
          willChange: "transform",
        }}
      >
        <div
          className={`flex flex-col items-center text-center transition-all duration-1000 ease-fonix ${
            isUiVisible
              ? "translate-y-0 opacity-100"
              : "pointer-events-none translate-y-5 opacity-0"
          }`}
        >
          {/*
            The only place Anton appears on the whole site. Spending the display
            face in exactly one moment is what gives it weight -- on every
            heading it would just be a loud font.

            leading-none, not tighter: Anton's glyphs are taller than their em
            box, and a line-height below 1 lets the tagline render inside the
            letterforms.
          */}
          <h1
            className="font-display leading-none tracking-[0.02em] text-white transition-[mask-image] duration-1000"
            style={{
              fontSize: "clamp(3.5rem, 1rem + 15vw, 13rem)",
              // Deliberately NO text-shadow. A mask clips the shadow at the
              // element's box, which draws a visible rectangle around the
              // wordmark -- the glow fades out but its bounding box does not.
              // The vignette already provides the separation the shadow was
              // there for.
              ...(isIntro
                ? {}
                : {
                    maskImage: HERO_OCCLUSION_MASK,
                    WebkitMaskImage: HERO_OCCLUSION_MASK,
                  }),
            }}
          >
            FONIX
          </h1>

          <p className="mt-5 font-body text-[0.65rem] uppercase tracking-[0.42em] text-white/70 md:mt-7 md:text-sm">
            The future, ignited
          </p>

          <div className="pointer-events-auto mt-9 flex flex-col gap-3 sm:flex-row md:mt-11">
            <Button to="/store/ignis" size="lg">
              Meet the Ignis
            </Button>
            <Button to="/store" variant="ghost" size="lg">
              The full range
            </Button>
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
      {!prefersReducedMotion ? (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-0 bottom-8 flex flex-col items-center gap-3 transition-opacity duration-700 ${
            !isIntro && framesReady && scrubProgress < 0.03
              ? "opacity-100"
              : "opacity-0"
          }`}
        >
          <span className="font-body text-[10px] uppercase tracking-[0.34em] text-white/40">
            Scroll
          </span>
          <span className="relative block h-10 w-px overflow-hidden bg-white/15">
            <span className="fx-scroll-tick absolute inset-x-0 top-0 block h-4 bg-ember" />
          </span>
        </div>
      ) : null}
    </section>
  );
}
