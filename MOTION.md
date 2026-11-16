# Biashara motion identity: The Red Thread

Written before the motion code. The code follows this document; where building changed a decision, section 9 says so.

## 1. The idea

*Biashara* means business. In business, money is momentum: it moves from one hand to the next, ties obligations together and keeps a plan moving. The logo already shows this. Its **B** is a single white ribbon that loops through red, ink and grey.

The site has **one living element: a red thread.** It is the same ribbon as the B, pulled out of the mark and laid through the site.

- It is **born in the preloader**: it draws the B, the real logo resolves inside it, then it pulls taut and slices the screen open.
- It **draws itself down every page** as you scroll, with its tip just ahead of your reading position.
- It **weaves**: most of it runs behind the content (cards and text sit on top of it), and at chosen points it crosses in front, over a photo corner, a statistics panel, or a heading underline. Behind, in front, behind: it reads as woven.
- It **takes roles**. It underlines headings, wraps photo corners, becomes the line of the loan process, bends into a growth curve beside the statistics, draws the repayment line in the calculator, measures your scroll at the edge of the screen, and **ties itself off** in a knot at the last call to action.
- It **reacts**. Fast scrolling makes it ripple and draw ahead; on desktop it leans toward the cursor; on phones it leans toward your thumb as you drag and, where the browser allows it without a permission prompt, toward the tilt of the phone.

There is nothing else. No floating blobs, no particle fields, no unrelated effects. Every motion on the site either is the thread, is cut by the thread, or moves to the thread's rhythm.

## 2. Motion tokens

Defined once in `src/css/00-tokens.css` (CSS) and `src/js/motion/tokens.js` (JavaScript). Nothing else invents a duration or a curve.

| Token | Value | Used for |
|---|---|---|
| `--d-1` / `D.quick` | 240 ms | presses, hovers, small state changes, odometer digits |
| `--d-2` / `D.base` | 640 ms | reveals, menu, accordions, page wipes |
| `--d-3` / `D.slow` | 1100 ms | headline lines, image masks, thread drawing in the preloader |
| `--ease-out` / `E.out` | `cubic-bezier(.16, 1, .3, 1)` | everything that arrives (reveals, entrances) |
| `--ease-thread` / `E.thread` | `cubic-bezier(.65, .05, .36, 1)` | everything the thread does (draws, pulls taut, slices, wipes) |
| `--stagger` / `STAGGER` | 60 ms | one rhythm for every group: lines, cards, links, digits |

A spring is used in one place only, the calculator slider thumb (`--ease-spring: cubic-bezier(.34, 1.56, .64, 1)`), because a thumb is a physical object under a finger.

## 3. Rules

1. **Transform and opacity only.** The thread's draw uses `stroke-dashoffset` on one SVG path (a paint, not a layout). No animation changes layout, so there is no layout shift.
2. **Content first.** All text is in the HTML and readable without JavaScript. Hidden-until-revealed states are added by script only, and a 4-second safety timer in the head removes them if the script never runs.
3. **Nothing depends on hover.** Hover adds; tap and keyboard get the same result.
4. **Reduced motion is a designed mode, not an off switch.** The thread is drawn complete and still (a printed ribbon down the page), sections appear without movement, the preloader is a 300 ms fade, page changes are instant, and numbers show their final value.
5. **One frame budget.** All scroll and pointer work runs in one `requestAnimationFrame` loop (GSAP's ticker). No scroll handler touches layout.
6. **Tiers.** `full` (desktop and capable phones), `lite` (Save-Data, 4 GB of memory or less, 4 cores or fewer, or a slow connection): the thread still draws, but without ripples, leaning, the front layer, pins or parallax; `still` (reduced motion). The motion code loads after first paint, so the first screen never waits for it.
7. **Always escapable.** The preloader skips on tap, click or any key, has a hard timeout, and never blocks reading for more than 2.2 s.
8. **Native scrolling stays native on touch.** Smooth scrolling (Lenis) runs only on desktop with a mouse or trackpad. On phones the browser scrolls, and the thread follows.

## 4. The preloader film (every page)

Full version once per browser session, under 2.2 s; short version (0.4 to 0.6 s) on every later page; tap to skip; hard timeout; a simple fade with reduced motion. It is static HTML and CSS so it starts painting before any script, and it covers nothing that has not already rendered underneath (no layout shift, the hero is painted and starts moving before the panels have gone).

**Full version (first page of a visit)**

| t (ms) | What happens |
|---|---|
| 0 | Ink panel and red panel fill the screen, split along a diagonal. The thread enters from the left edge. |
| 0–900 | The thread draws the page's shape. On the home page it is the B of the logo, traced as one stroke. |
| 500–1100 | The real logo resolves inside the drawn shape (masked rise). A counter climbs in UGX, `UGX 1,000,000` towards `UGX 50,000,000` (the facility range), driven by real loading progress: fonts, the logo, the hero image and the motion code. |
| ≥ 1100 and loaded | The counter lands. The thread **snaps taut** into a straight diagonal. |
| +0–520 | It slices the screen: the ink panel peels up-left, the red panel down-right. The hero headline is already rising underneath. |

**Short version (later pages and page changes)**: the panels are already closed (the previous page's exit wipe closed them), the thread flicks the page's shape in 250 ms, snaps taut, and the panels peel. Total about 500 ms, or less if the page is ready sooner.

**Page shapes** (the thread hints at the page before the reveal):

| Page | Shape |
|---|---|
| Home | the B of the logo |
| Loans | a rising growth curve |
| How we lend | four steps climbing |
| Terms | a ruled document with a total line |
| About | a handshake line: two loops locking |
| Who we serve | a map pin |
| Team | two linked loops (a handshake) |
| Licence | a seal: a circle with a ribbon tail |
| FAQ | a question mark |
| Contact | a map pin |
| Apply | a document with a folded corner and a signature |
| Company profile | a document |
| Privacy | a shield |
| 404 | a knot |

**Page changes** reuse the same wipe: clicking an internal link draws the thread across the screen and closes the ink and red panels behind it (about 350 ms), the browser navigates, and the next page opens with the short version. Modified clicks, new tabs, downloads, `tel:`, `mailto:` and same-page anchors are never intercepted. A page restored from the back/forward cache opens instantly.

## 5. Motion system

**Page open.** Headlines reveal by line (each line slides up out of a mask, 60 ms apart). Hero and page-head photos open through a diagonal mask, the same angle as the thread's slice. Navigation arrives last, staggered.

**Scroll storytelling.** Each section has a designed entrance and no two neighbours share one:

| Entrance | Where it is used |
|---|---|
| *rise*: content lifts 32 px and fades in, staggered | text sections |
| *ink rise*: a dark or red section's colour block opens from a rounded inset to full bleed | night sections, the closing call to action |
| *mask*: photos open through the diagonal mask | photo sections |
| *deal*: cards arrive from alternating sides like cards being dealt | card grids |
| *draw*: the thread draws first, the content follows it | process steps, statistics |
| *scale*: the block settles from 96% scale | the calculator, the licence strip |

- **Pinned chapters (desktop only).** The loan process pins and plays as a scrubbed sequence: the thread runs through the four step numbers and each step lights as the thread reaches it. Products become a horizontal reel that slides past while the thread runs beneath it, snapping to whole cards. On phones nothing pins: the process is the thread running down the step numbers, and products are a swipeable snap carousel with a visible next card and a position counter.
- **Statistics** count up while the thread draws a rising curve across them.
- **Depth.** Photos move at a slightly different speed from the page (stronger on desktop, very light on phones, none in lite mode). The closing line "Your time matters. Your goals matter." sits on a large outlined "Biashara" that drifts sideways with scroll.
- **Colour.** Sections move between paper, ink and red; the dark and red blocks widen to full bleed as they arrive, so the colour change is a movement, not a cut.
- **Scroll progress** is a short thread at the right edge (desktop) or under the header (phones) that fills as you read.
- **Footer finale.** The page thread ends in a knot at the last call to action. Inner pages gain a closing band above the footer for it (existing words: "Your time matters. Your goals matter."), except Apply, which is itself the call to action.

**Interaction.**
- Buttons: magnetic pull on desktop, a liquid fill that floods from the pointer's entry point, and a press-down on tap.
- Cursor (desktop with a mouse): the native cursor stays; a small red ring follows it and says *View* over photos, *Drag* over the reel, sliders and the licence image, *Apply* over apply links.
- Cards: gentle 3D tilt on desktop; on touch, a lift and red glow while pressed.
- Links in text: an underline drawn from left to right on hover and focus (the plain underline is always there).
- Form fields: a red focus line draws under the field, the label shifts to red, errors arrive with a short shake and a clear message, and a sent form gets a thread that ties itself into a tick.
- Calculator: springy slider thumbs, results that roll like an odometer (screen readers get the exact figure, not the roll), and a live repayment line drawn by the thread month by month. The calculation rules are unchanged.
- Accordions open and close with a smooth height and their content arrives staggered.
- Mobile menu: a full-screen takeover; the thread sweeps across, the sheet opens behind it, and oversized links arrive staggered.
- Header: hides on scroll down, returns on scroll up, compacts once you are past the hero (visual compaction by transform; the header's layout height never changes).
- Delights: the logo mark lifts and tilts slightly on hover; the form success ticket is tied by the thread.

## 6. Page-by-page storyboard

| Page | Signature moments |
|---|---|
| **Home** | Film: thread draws the B, logo resolves, UGX counter, slice. Thread underlines "Short-term bridge financing", wraps the hero photo's corner (in front, then behind). Ink rise into *At a glance*; numbers count while the thread draws a growth curve across them. Products: horizontal reel on desktop, snap carousel on phones. Calculator: the thread draws the repayment line. *How we lend* pins and the thread runs through 1-2-3-4. Five Cs dealt. Photos drift. The licence strip settles. The red closing band rises; the thread ties a knot at **Apply now**. |
| **Loans** | Growth-curve preloader. Thread underlines the heading and runs between product rows. The six-month term bar fills segment by segment as the thread passes. Calculator line. Gallery photos open through the mask. |
| **How we lend** | Steps preloader. The process steps are the pinned chapter on desktop. Eligibility checklist items tick in sequence. Discussion photos drift at three depths. |
| **Terms** | Document preloader. The cost-anatomy bar fills segment by segment; the thread runs under the timeline points. Ink rise into *Responsible lending*. |
| **About** | Handshake preloader. The ambition steps light along the thread. Ink rise into vision and mission. Values accordion opens smoothly. |
| **Who we serve** | Pin preloader. Photo pair drifts at two depths. |
| **Team** | Linked loops preloader. Portraits open through the mask in a dealt order. |
| **Licence** | Seal preloader. The thread circles the certificate image; hotspots pulse once when the image arrives. |
| **FAQ** | Question-mark preloader. Accordions with smooth height. |
| **Contact** | Pin preloader. The open/closed sign; form fields with focus lines; a tied-thread tick on send. |
| **Apply** | Document preloader. Step changes slide; the thread ties the result ticket. |
| **Profile, Privacy** | Document and shield preloaders. Reading progress thread. |
| **404** | A knot preloader, then the thread spells out a loose end you can pull: on desktop it follows the pointer, on phones you drag it. |

## 7. Mobile is its own design

- Thumb first: the thread runs in the page gutter and crosses the column only under headings, so it never sits under the line you are reading.
- Touch instead of hover: press states on cards and buttons, lean toward the dragging thumb, tilt where available.
- Swipe where natural: the products carousel.
- Lighter: no pins, parallax at a third of the desktop amount, one thread layer (no front layer), ripples at half strength.
- `lite` tier on Save-Data or modest hardware.

## 8. Engineering

- `src/js/intro.js` (in the main bundle): preloader, page wipe, header, menu wipe, accordions, form touches. Small, no libraries.
- `src/js/motion/*` → `assets/js/motion.js`, loaded after first paint as a separate classic script: GSAP, ScrollTrigger, CustomEase, Lenis and the thread. Never on the critical path.
- The thread is one SVG path in document coordinates, inside `<main>` behind the content containers (`z-index` 0 under containers at 1). A second copy of the same path, clipped to a few rectangles, sits above the content for the woven crossings. Waypoints are measured from the page, rebuilt on resize, font load and image load (debounced), and ScrollTrigger refreshes after them.
- The draw position comes from a lookup table: for any scroll position, the path length whose point is 65% down the screen. Ripple and lean rebuild only the visible part of the path, and only while they are active.

## 9. Changes made while building

- **Tier thresholds.** `lite` is chosen for Save-Data, a 2G connection, 2 GB of memory or less, or 2 cores or fewer (4 cores was too strict: it caught ordinary laptops). `?motion=full|lite|still` forces a tier for testing.
- **Easing.** GSAP's built-in `expo.out` and `power3.inOut` match the two token curves closely, so CustomEase is not loaded.
- **Thread geometry** is computed from the Bézier maths, not the browser's path measuring (which blocked the page for seconds on a long route), and positions come from layout, not from on-screen boxes, so entrances never drag the thread with them.
- **Changing sides.** The thread only crosses from one gutter to the other in empty space (section padding, the gap under a heading). Growth curves are drawn from whichever end the thread arrives at.
- **Closing band on inner pages** uses existing wording and keeps its conditions sentence.
- **Self-critique, the three weakest moments redone:**
  1. The hero underline ran under the whole text box and across the photo. Now it underlines the headline's last line only, rises to the photo, crosses over its corner and runs behind it.
  2. Underlines and the statistics curve cut through introductions (measured mid-entrance, and crossing to the far gutter diagonally). Now measured from layout and routed through gaps.
  3. The final knot crossed the paragraph and the second button. Now it approaches through the column gap and loops the Apply button only, leaving a loose end.
  Also: the film's slice line lingered over the hero; it now fades as the panels peel.

## 10. Owner change (16 November 2026)

The page-long thread that drew itself down every page as you scrolled has been removed at the owner's request (`src/js/motion/thread.js` deleted). The film, page wipe, pinned process line, product reel, statistics count-up, calculator line, scroll progress, closing band and interactions remain. The process steps show their plain connector line again.

## 11. Owner change: reveal everything (16 November 2026)

`src/js/motion/reveal-all.js` animates every element as it scrolls into view, with one IntersectionObserver and the 60 ms stagger:
headings split into masked lines that slide up (GSAP SplitText, reverted to plain text afterwards); icons and step numbers spin and pop in;
chips pop; buttons and links rise; photos open from the bottom; table rows, ledger rows, list items and footer links slide in from the left;
eyebrows, labels, captions, callouts and form fields rise; paragraphs and sub-headings rise. Section entrances keep the dealt cards, photo masks and scale-ins.
Only elements below the first screen are hidden, keyboard focus shows an element at once, and reduced motion skips all of it.
