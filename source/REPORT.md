# Biashara website — final report

Built from the 2026 Company Profile (Edition 2026, Version 5). Concept: “The Bridge Ledger”.

## Results

| Check | Result |
|---|---|
| Pages | 14 pages built: home, about, loans, how we lend, terms, who we serve, team, licence, FAQ, contact, apply, full profile, privacy, 404 |
| Facts | 22 of 22 key facts traced to a profile page; 13 automatic fact rules pass on every page (no APR, one rate, UGX 1M–50M only, 6 months max, no invented claims, never claims approval) |
| Disclaimers | All four present wherever figures appear: standard published terms · final terms confirmed in writing at approval · an application does not guarantee a facility · review time runs in office hours |
| Behaviour tests | 29 of 29 pass in a real browser with the security policy on: preloader (first visit, repeat visit, skip, reduced motion), page transitions, calculator edges, open-now boundaries in Kampala time, licence expiry guard with a faked 2027 date, Apply full flow, `?product=` preselect, validation, saved progress, mobile file sheet, contact form, skip link, palette (K and /), grid (G), Index dialog, licence zoom, no-JavaScript fallback |
| Accessibility | axe: 0 violations on all 14 pages at phone and desktop width. Lighthouse accessibility 100 on every page tested |
| Lighthouse (mobile, slow 4G) | Performance 81–96 · Accessibility 100 · Best practices 100 · SEO 100 · layout shift 0 |
| Screenshots | 56 views (14 pages × 390, 768, 1280, 1920): no console errors, no sideways scrolling |
| Design tests | Squint and greyscale tests pass (one headline and one red action per screen; hierarchy holds without colour). Anti-AI scan clean: no glass blur, no gradient text, corners ≤ 4px, no soft shadows, no emoji, no stock phrases |
| Type | Archivo and Source Serif 4, self-hosted, 3 font files. `font-synthesis: none`, real weights only, no scaled text |
| Budgets | JavaScript 78 KB gz (budget 180) · CSS 20 KB gz (budget 60) · 3 fonts (budget 4) · largest hero image 99 KB (budget 180) |

Design self-scores (out of 10): concept fidelity 9 · typography 9 · hierarchy 9 · colour discipline 8 · motion 8 · originality 8 · accessibility 10 · performance 8 · content integrity 10.
The two 8s on originality and performance are honest: inner pages share one chapter-opener layout, and the first-visit preloader and serif font cost some mobile load time.

## Needs your decision

1. **Form endpoint and mailbox.** `SUBMIT_ENDPOINT` is empty, so Apply and Contact hand visitors a ready-made email and WhatsApp message, and the ticket stamp reads “READY TO SEND”. Give me a form service or server address (and confirm `inquiries@biasharafinance.com` is the mailbox) and applications arrive directly with a “RECEIVED” stamp. Note: with the fallback, the visitor’s details travel in the email/WhatsApp link only when they click it.
2. **Licence renewal.** The 2026 licence expires 31 December 2026. From 1 January 2027 the site automatically shows: “The reference copy shown is the 2026 certificate. To verify the current licence, contact the Board of Directors.” When renewed, send the new certificate and dates (one file: `src/js/config.js`).
3. **Reconstructed portraits.** Stephen Kwesiga and Bernadette Mugisha’s portraits are reconstructed. They carry a small caption on the Team page and in the image descriptions. Real photographs would remove the caption.
4. **Low-resolution photos.** Most profile photos were extracted small; 21 of 28 may look soft at their largest size (full list with sizes in `qa/report/image-map.md`). Worst: the three discussion photos (372 px wide), the two specialist portraits (~300 px), the five staff portraits (327–413 px), clear-conversations (873 × 374), real-enterprise (831 × 356) and colleagues-office (1280 px, also soft). Original camera files would fix all of them with no code change.
5. **Domain.** The site assumes `https://www.biasharafinance.com` (from the profile’s email address). If it will live elsewhere, change `SITE_URL` in `src/js/config.js` and rebuild.
6. **Profile inconsistencies** (shown as written, not silently changed):
   - The executive summary quote opens with a quotation mark but never closes it; the site sets it as a block quote without marks.
   - The vision sign on the office wall (contact photo) reads “To Become A Micro Finance Institution In The Fast Growing Mass Market In Uganda” (the right edge is cut off in the photo, so the last letters of each line are inferred); the profile’s vision statement reads “To become a microfinance institution serving a fast-growing mass market.” The site uses the profile’s wording.
   - The logo’s red measures #D82028, not the ~#E10A1D in the brief. The site uses the logo’s own red so they match.

## How to see it

- **Live in about a minute:** drag the site folder (`biashara-dist.zip`, unzipped) onto <https://app.netlify.com/drop> (step-by-step for Netlify, Cloudflare Pages and cPanel in `README.md`).
- **On a computer with Node.js:** `npm install`, then `npm run preview` and open <http://localhost:4173>.

## What’s in the delivery

| File | What it is |
|---|---|
| `biashara-dist.zip` | The finished site, ready to upload |
| `biashara-web.zip` | The whole project, ready to push to GitHub: source, build tools, QA, `dist`, `.gitignore`, `netlify.toml` |
| `biashara-web/` | The same, unpacked: `dist/`, `src/`, `build/`, `qa/`, `README.md` |
| `README.md` | Beginner guide: publishing, settings, rebuilding |
| `qa/report/fact-audit.md` | Every key fact with its profile page and the site pages that state it |
| `qa/report/image-map.md` | Every photo: profile page, size, where used, resolution notes |
| `qa/report/profile-vs-site.jpg` | Profile pages beside the matching site pages |
| `qa/report/*.json`, `qa/report/shots/` | Raw results: static checks, behaviour tests, axe, Lighthouse, screenshots |

## Notes on what changed during testing

Testing found and fixed: the skip link not moving keyboard focus; three colour-contrast misses (grey text on the darker paper, figure captions); a “Back to top” control outside page landmarks; FAQ heading levels; two licence markers overlapping on phones; the product scroll sequence hiding its Apply buttons on laptop-height screens (panels now fit at 1280×800 and 1366×768); the footer wordmark cutting the company name; long headings spilling out of the About steps and the Terms cost bar; and the preview server not compressing or applying the security headers (now it mirrors Netlify/Cloudflare, so the tests run under the real security policy).
