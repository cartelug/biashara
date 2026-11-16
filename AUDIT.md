# Biashara website audit

Audit of the site as published at commit `25fb0a3` (16 November 2026), before the motion work, then re-checked after it.
Every page was opened at 320×640, 360×740, 390×844, 414×896, 768×1024, 1024×768, 1280×800, 1440×900 and 1920×1080 (portrait), and at 844×390, 740×360 and 1024×1366 (landscape and tall tablet), with the sweep in `source/qa/sweep.mjs`. Each item ends with its fix.

## Summary

| Check | Before | After |
|---|---|---|
| Sideways scrolling, 14 pages × 12 sizes | none | none (two new causes found during the build and fixed: M1, M2) |
| Console errors and failed requests | none (the 404 page's own 404 status is expected) | none |
| Tap targets under 44 px | 7 kinds on 4 pages, 223 reports | 0 (licence marks keep their 32 px dot with a 48 px hit area) |
| axe, WCAG 2.2 A/AA, 14 pages at 390 and 1280 | 28 violations | 0 |
| Behaviour tests | 30/30 | 30/30 |
| Layout shift (Lighthouse) | licence page 0.027 | 0 on every page tested |
| Fact rules, disclaimers, key facts | pass | pass (no rate, fee, contact, name or licence detail changed) |

## Unfinished work, broken behaviour and placeholders

| # | Finding | Fix |
|---|---|---|
| F1 | **404 page broken on the live domain.** `CNAME` publishes the site at `biasharafinance.com` (domain root), but `BASE_PATH` was still `/biashara`, so the 404 page asked for `/biashara/assets/...` and rendered unstyled. | `BASE_PATH: ''` in `config.js`; `.htaccess` now sends 404s to `/404.html`. |
| F2 | **Header logo failed accessibility on every page** (axe *label-content-name-mismatch*, 28 runs): the link's label "Biashara Trading Company Limited, home" did not contain the visible text, which was hidden from assistive technology. | The visible wordmark is now the link text, with a hidden ", home". |
| F3 | **Privacy statement out of date.** The opening animation stores a flag in session storage; the privacy page said the site remembers only the contrast setting. | Privacy page now states both, and that the session flag is cleared when the tab closes. |
| F4 | Inner pages ended on a footnote list with no next step; only the home page had a closing call to action. | A closing band (existing wording: "Your time matters. Your goals matter.", the four-hour-review sentence with its conditions, Apply now, Call) on every page except Home, which has its own, and Apply. |
| F5 | The 404 page was a plain list. | Designed 404: the thread's loose end hangs from "404"; pull it with the pointer or drag it with a finger. Links unchanged. |
| F6 | QA browser tests could not start (Playwright version mismatch with the installed browser). | All QA scripts accept `PW_CHROMIUM` for the browser path. |
| F7 | No placeholder text, dead links or dead buttons were found (1,183 references checked, every link resolves). | Re-checked after the work: all references resolve (`qa/references.mjs`). |
| F8 | Forms: no broken behaviour; both forms validate, summarise errors and fall back to email and WhatsApp while `SUBMIT_ENDPOINT` is empty. | Kept as is (see "Needs from you"). Added friendly feedback only: focus line, a short shake for errors, a tied-thread tick on success. |

## Responsive findings

| # | Finding | Where | Fix |
|---|---|---|---|
| R1 | **Ten breakpoints in use** (360, 480, 600, 640, 700, 768, 900, 1024, 1100 in script, 1200). | all CSS | One set: 360, 600, 768, 1024, 1280. `qa/static.mjs` now fails the build on any other width. |
| R2 | The 900–1023 px band had its own layouts (hero two columns at 900 that crowded at 1000). | hero, page heads, steps | Folded into the 1024 breakpoint. |
| R3 | Script used 1100 px for "desktop", CSS used 1024. | `utils.js` | 1024 everywhere. |
| R4 | Header phone number appeared at 1200 while navigation tightened between 1024 and 1199. | header | Phone number from 1280; one rule for 1024–1279. |
| R5 | `100vh` | none found | The film uses `inset: 0` on a fixed layer, so mobile browser bars cannot clip it. |
| R6 | Safe areas | header, film, back-to-top | `env(safe-area-inset-*)` kept on the header and back-to-top; added to the film's Skip control. |
| R7 | Contact phone and WhatsApp links were 19 px tall. | Contact | 44 px hit area, still wrapping on a 320 px screen. |
| R8 | Copy buttons were 36 px tall on desktop. | footer, Contact | 44 px everywhere. |
| R9 | Calculator quick amounts (1M … 50M) were 42 px tall. | Home, Loans, Apply | 44 × 44 minimum. |
| R10 | Consent link "How information is handled" was 16–40 px tall inside its label. | Contact form | 40+ px hit area without moving the text. |
| R11 | Footer contact links were 19 px tall. | footer | 44 px hit area. |
| R12 | Licence hotspots were placed by script after first paint, a 0.027 layout shift. | Licence | Hidden until placed; layout shift 0. |
| R13 | Images | all | Already correct: every photo has width and height, AVIF/WebP/JPEG `srcset`, lazy loading below the fold and `object-fit: cover`. No stretched image at any size. |
| R14 | Tables | Loans matrix, profile | Already redesigned for phones (labelled cards under 768, a focusable scroll region for the long profile table). Kept. |

## Found while building the motion layer (and fixed)

| # | Finding | Fix |
|---|---|---|
| M1 | The phone products carousel (grid with column flow) made mobile Chrome widen the page to 980 px. | Flex carousel with `contain: paint`; layout viewport is 390 px again. |
| M2 | Cards entering from the side widened the phone page before they arrived. | On phones cards are dealt vertically; side entrances are desktop only. |
| M3 | The thread's first version measured the page with `getPointAtLength`, blocking the main thread for about five seconds on a long page. | Lengths and points computed from the Bézier maths (a few milliseconds); `pathLength` keeps the dash maths exact. |
| M4 | Underlines struck through introductions because headings were measured mid-entrance. | Positions are read from layout (`offsetTop`), ignoring transforms, and re-measured once the headline settles. |
| M5 | A hairline seam showed where the film's two panel halves meet. | Halves overlap by 2 px. |

## Lighthouse (mobile, simulated slow 4G, this machine)

| Page | Performance | Accessibility | Best practices | SEO | LCP | CLS |
|---|---|---|---|---|---|---|
| Home | 92 | 100 | 100 | 100 | 3.0 s | 0 |
| Loans | 95 | 100 | 100 | 100 | 2.7 s | 0 |
| How we lend | 97 | 100 | 100 | 100 | 2.4 s | 0 |
| About | 93 | 100 | 100 | 100 | 2.9 s | 0 |
| Licence | 94 | 100 | 100 | 100 | 2.9 s | 0 |
| FAQ | 97 | 100 | 100 | 100 | 2.3 s | 0 |
| Contact | 97 | 100 | 100 | 100 | 2.2 s | 0 |
| Apply | 97 | 100 | 100 | 100 | 2.2 s | 0 |

Lighthouse sees a first visit, so it measures the full opening film. JavaScript before first paint: 19.2 KB gzip (budget 40). The motion file (GSAP, ScrollTrigger, Lenis, the thread) is 59.2 KB gzip and loads after first paint (budget 64).

## Needs from you (facts the site cannot invent)

1. **Form address.** `SUBMIT_ENDPOINT` is empty, so Apply and Contact hand the visitor a ready-made email or WhatsApp message. Give a form service or server address and confirm `inquiries@biasharafinance.com` is the right mailbox.
2. **Licence renewal.** The 2026 licence expires 31 December 2026. Send the renewed certificate and dates; until then the site switches to the verification notice on 1 January 2027 automatically.
3. **Canonical domain.** `CNAME` is `biasharafinance.com` but canonical links and the sitemap use `https://www.biasharafinance.com`. Confirm which one is primary (and that the other redirects).
4. **Original photographs.** Several portraits are reconstructions and some photos are low resolution; originals would sharpen them with no code change.
