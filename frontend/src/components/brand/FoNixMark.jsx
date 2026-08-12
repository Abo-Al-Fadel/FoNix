/**
 * The FoNix blade mark, as vector geometry.
 *
 * These coordinates are not eyeballed. The raster concept in
 * `public/logo/logo-concept-raw.jpeg` was thresholded to a binary mask, its
 * boundary traced with a marching-squares edge walk, and the resulting outline
 * simplified with Douglas-Peucker. The mark turned out to be two separate
 * straight-edged blades of 6 and 5 points -- so this is the real shape, not an
 * approximation of it, and it stays crisp at any size including a 16px favicon.
 *
 * viewBox is the mark's own bounding box (476 x 393 in the source's pixel
 * space), with the origin shifted to 0,0. Keeping the natural aspect ratio
 * rather than padding it to a square means callers control the padding.
 */

export const MARK_VIEWBOX = "0 0 476 393";

// Upper blade: the top arm of the "F" plus the long tail sweeping down-left.
export const MARK_PATH_UPPER =
  "M190 0 L148 31 L30 334 L227 72 L388 71 L476 2 Z";

// Lower blade: the middle arm, and the second, longer tail beneath it.
export const MARK_PATH_LOWER = "M203 131 L0 393 L209 201 L298 201 L376 132 Z";

/**
 * @param {object} props
 * @param {string} [props.className] - sizing/colour classes.
 * @param {string} [props.title] - accessible name. Omit for decorative use,
 *   in which case the SVG is hidden from assistive tech entirely.
 */
export default function FoNixMark({ className = "", title }) {
  const decorative = !title;

  return (
    <svg
      viewBox={MARK_VIEWBOX}
      className={className}
      // A decorative mark next to a "FONIX" text label would otherwise be read
      // out twice by a screen reader.
      role={decorative ? "presentation" : "img"}
      aria-hidden={decorative ? "true" : undefined}
      focusable="false"
      // currentColor lets the mark inherit text colour, so one component serves
      // the white navbar logo, the ember hover state and the footer.
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      {title ? <title>{title}</title> : null}
      <path d={MARK_PATH_UPPER} />
      <path d={MARK_PATH_LOWER} />
    </svg>
  );
}
