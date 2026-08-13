# FoNix image prompt sheet (for ChatGPT / GPT-Image)

Everything you need to generate real imagery and replace the placeholders.
Copy a prompt, attach the reference frame it names, generate, then drop the file
at the path given. Re-run `python manage.py seed_catalog` and it appears on the
site.

---

## How to use this sheet

1. **Always attach a reference frame** (listed per prompt). It lives in
   `frontend/public/frames/scroll/`. Attaching it is what keeps every generated
   car in the same studio, lighting and mood as the flagship, instead of six
   cars that look like six different websites.
2. **Paste the STYLE BLOCK** (below) at the top of every prompt, then the
   car-specific part. The style block is the glue.
3. **Generate the 3/4 hero shot first** for each car. Then, to get matching
   gallery angles, attach *your own generated hero* as the reference for the
   other angles and say "same car, same paint, same studio, new angle". This is
   the trick for consistency, one car cannot be regenerated identically from
   scratch, but it can be re-photographed from a new angle.
4. **Aspect ratio matters.** Ask for the ratio named in each prompt. The store
   grid is 16:9; the OG share image is 1.91:1.

> A note on realism: GPT-Image invents details, so two generations of "the same"
> car will differ slightly. That is fine for a portfolio, the goal is six
> plausibly distinct FoNix models, not a real product catalogue.

---

## THE STYLE BLOCK (paste at the top of every car prompt)

```
Cinematic automotive studio photograph of a fictional electric hypercar.
Single soft key light from behind creating a bright halo/rim light around the
silhouette; near-black car body in a near-black studio; wet polished concrete
floor with a soft vertical reflection under the car. Deep blacks, high contrast,
very moody, almost monochrome. One continuous thin white light-blade running
along the lower body line. Colours desaturated except for a faint warm ember
(#E8623D) hint in the brake calipers only. Photoreal, 50mm, shallow depth,
no text, no badges, no license plate, no visible brand logos. 16:9.
```

---

## The six models (paint / character so they read as DIFFERENT cars)

| Model | Character | Distinct visual trait to add |
|---|---|---|
| **Ignis** (done) | Flagship hypercar | Already shot, real frames |
| **Aurea** | Grand tourer, 780 km range | Longer, more elegant proportions; a champagne/warm-graphite sheen instead of pure black; softer, fluid surfaces |
| **Cinder** | Track weapon | Aggressive aero, large fixed rear wing, exposed carbon-fibre weave, glowing ember brake calipers, matte finish |
| **Vesper** | Four-door executive saloon | FOUR doors, long sleek saloon/sedan silhouette, understated, rear-hinged back doors, executive not exotic |
| **Lumen** | Entry, single-motor, lightweight | Smaller and simpler, cleaner minimal surfacing, a lighter gunmetal grey, approachable compact coupe |
| **Atlas** | Raised all-terrain | Tall SUV/crossover stance, ~280 mm ground clearance, chunky matte wheels, subtle skid-plate underbody, rugged |

---

## Per-car prompts

For each car generate **1 hero (thumbnail)** and **1 gallery** image minimum.
The thumbnail is what the store grid shows; more gallery angles are better.

### Aurea  ·  reference: `frame_040.webp`

**Hero / thumbnail** (16:9) - save as `assets/product/aurea/hero.jpg`
```
[STYLE BLOCK]
This car is the FoNix Aurea, a grand touring hypercar: longer, more elegant and
more fluid than a track car, with a warm champagne-graphite metallic sheen
catching the rim light. Front three-quarter view, low angle, car turned slightly
left. Calm, luxurious, effortless.
```

**Gallery** (16:9) - `assets/product/aurea/side.jpg` - attach YOUR aurea/hero.jpg
```
Same FoNix Aurea, same champagne-graphite paint, same dark studio and wet floor.
New angle: full side profile showing its long GT proportions.
```

### Cinder  ·  reference: `frame_040.webp`

**Hero / thumbnail** (16:9) - `assets/product/cinder/hero.jpg`
```
[STYLE BLOCK]
This car is the FoNix Cinder, a road-legal track weapon: aggressive aerodynamics,
a large fixed carbon rear wing, exposed carbon-fibre weave panels, deep front
splitter, matte black finish, and glowing ember-orange brake calipers. Front
three-quarter view, low aggressive angle. Menacing, purposeful.
```

**Gallery** (16:9) - `assets/product/cinder/rear.jpg` - attach YOUR cinder/hero.jpg
```
Same FoNix Cinder, same matte black with exposed carbon and ember calipers.
New angle: rear three-quarter showing the large carbon wing and diffuser.
```

### Vesper  ·  reference: `frame_040.webp`

**Hero / thumbnail** (16:9) - `assets/product/vesper/hero.jpg`
```
[STYLE BLOCK]
This car is the FoNix Vesper, a four-door electric executive saloon (sedan), NOT
a two-seat supercar: long sleek low four-door silhouette, understated and
sophisticated, rear-hinged rear doors, dark metallic paint. Front three-quarter
view, elegant and restrained.
```

**Gallery** (16:9) - `assets/product/vesper/side.jpg` - attach YOUR vesper/hero.jpg
```
Same FoNix Vesper four-door saloon, same paint and studio. New angle: full side
profile clearly showing all four doors and its long executive proportions.
```

### Lumen  ·  reference: `frame_040.webp`

**Hero / thumbnail** (16:9) - `assets/product/lumen/hero.jpg`
```
[STYLE BLOCK]
This car is the FoNix Lumen, the affordable entry model: a smaller, simpler,
lightweight compact electric coupe with clean minimal surfacing and a lighter
gunmetal-grey paint. Friendly and pure rather than aggressive. Front
three-quarter view.
```

**Gallery** (16:9) - `assets/product/lumen/side.jpg` - attach YOUR lumen/hero.jpg
```
Same FoNix Lumen, same gunmetal grey, same studio. New angle: clean side profile
showing its compact lightweight coupe proportions.
```

### Atlas  ·  reference: `frame_040.webp`

**Hero / thumbnail** (16:9) - `assets/product/atlas/hero.jpg`
```
[STYLE BLOCK]
This car is the FoNix Atlas, a raised all-terrain electric performance SUV: tall
commanding stance with roughly 280 mm ground clearance, chunky matte off-road
wheels, subtle metal skid-plate under the nose, muscular rugged body, matte dark
paint. Front three-quarter view, low hero angle looking up at it.
```

**Gallery** (16:9) - `assets/product/atlas/side.jpg` - attach YOUR atlas/hero.jpg
```
Same FoNix Atlas raised SUV, same matte paint and studio. New angle: side
profile showing the tall ride height, ground clearance and chunky wheels.
```

---

## Brand / site imagery

### 1. Social share image (Open Graph)  ·  1.91:1 (1200 x 630)

Save as `frontend/public/og-image.jpg`, then in `frontend/index.html` point the
`og:image` and add a `twitter:image` at that path.

```
[STYLE BLOCK, but 1.91:1 wide]
The FoNix Ignis hypercar in the same dark studio, positioned in the LEFT third of
a wide banner, lots of negative black space on the right for a logo overlay.
Cinematic, premium, minimal.
```
(You do not add the logo in the prompt; leave the space and the site overlays it.)

### 2. About page - the hangar  ·  16:9  ·  `assets/brand/hangar.jpg`

```
Moody cinematic interior of a converted aircraft hangar used as a hypercar design
studio at night. A single FoNix hypercar silhouette under a pool of overhead
light, huge dark empty space around it, polished concrete floor, industrial roof
trusses barely visible in shadow. Deep blacks, one warm ember light accent in the
distance. Photoreal, wide, atmospheric. No text, no logos.
```

### 3. About page - detail macro  ·  16:9  ·  `assets/brand/light-blade.jpg`

```
Extreme close-up macro of the single continuous thin white light-blade running
along the lower body of a near-black electric hypercar, water droplets on the
carbon surface catching the light, shallow depth of field, almost abstract. Deep
blacks, one faint ember reflection. Photoreal. No text, no logos.
```

---

## After you generate them

1. Put each file at the path the prompt names (create the folders).
2. Tell me, or edit `backend/cars/management/commands/seed_catalog.py`: for each
   now-real car, set `has_real_imagery: True` and point it at the new files the
   way the Ignis entry already points at its frames. I can wire this up for you
   in a couple of minutes once the images exist.
3. Run `python manage.py seed_catalog --reset` and the store shows real cars with
   the "visualisation pending" badge gone.

If you generate even the six hero thumbnails, the store immediately stops looking
like placeholders, that is the highest-impact hour you can spend.
