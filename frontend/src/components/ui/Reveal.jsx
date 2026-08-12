import { motion } from "framer-motion";

/**
 * The site's one scroll-reveal animation.
 *
 * Everything below the hero animates in through this component, which is what
 * keeps the motion feeling like one system instead of a dozen slightly
 * different fades. The hero is the site's single maximalist moment; these are
 * deliberately quiet by comparison.
 *
 * `whileInView` + `viewport={{ once: true }}` means each element animates the
 * first time it is scrolled to and then stays put. Re-animating on every pass
 * is the most irritating thing a scroll animation can do.
 *
 * Reduced motion is handled globally: the media query at the bottom of
 * index.css collapses every transition and animation to ~0s, so a
 * reduced-motion visitor sees this content already in place.
 */

const DIRECTIONS = {
  up: { y: 22, x: 0 },
  down: { y: -22, x: 0 },
  left: { x: 26, y: 0 },
  right: { x: -26, y: 0 },
  none: { x: 0, y: 0 },
};

export default function Reveal({
  children,
  direction = "up",
  delay = 0,
  duration = 0.7,
  className = "",
  as = "div",
}) {
  const offset = DIRECTIONS[direction] ?? DIRECTIONS.up;
  const MotionTag = motion[as] ?? motion.div;

  return (
    <MotionTag
      className={className}
      initial={{ opacity: 0, ...offset }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      // margin pulls the trigger point up so the element starts animating just
      // before it reaches the viewport edge -- by the time you look at it, it
      // has arrived. Triggering exactly at the edge feels late.
      viewport={{ once: true, margin: "-70px" }}
      transition={{
        duration,
        delay,
        // The same curve as --ease-fonix in index.css. Reusing one easing
        // everywhere is most of what makes unrelated motion feel related.
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      {children}
    </MotionTag>
  );
}

/**
 * Staggers a list of children.
 *
 * Wrap a group in <RevealGroup> and each <RevealItem> inside animates a beat
 * after the previous one. Framer handles the timing through variants, so the
 * delays stay correct however many children there are -- no hand-computed
 * `delay={index * 0.08}` at the call site.
 */
export function RevealGroup({ children, className = "", stagger = 0.09 }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-70px" }}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: stagger } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({ children, className = "", as = "div" }) {
  const MotionTag = motion[as] ?? motion.div;
  return (
    <MotionTag
      className={className}
      // No `initial`/`animate` here: the variant names are inherited from
      // RevealGroup, which is what drives the stagger.
      variants={{
        hidden: { opacity: 0, y: 22 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.65, ease: [0.16, 1, 0.3, 1] },
        },
      }}
    >
      {children}
    </MotionTag>
  );
}
