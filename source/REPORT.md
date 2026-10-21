# Biashara website: redesign report

The site was redesigned completely: new visual system, new page templates, simplified scripts. All text, facts and
disclaimers are unchanged. The design and its specification are in `../DESIGN-PROTOTYPE.md`; this file records the checks.

## Results

| Check | Result |
|---|---|
| Pages | 14 (home, about, loans, how we lend, terms, who we serve, team, licence, FAQ, contact, apply, profile, privacy, 404) |
| Layout audit | 14 pages × 11 widths (320 to 1920 px): no sideways scrolling, nothing off-screen, no console errors, no failed requests, every image decodes, every tap target at least 44 px (licence hotspots and desktop-only copy buttons excepted) |
| Behaviour tests | 30 of 30 in a real browser: calculator, office hours, licence notice, Apply (all five steps to the ticket), saved progress, enquiry form, mobile menu, accordions, self-check, sliders, high contrast, back to top, no-JavaScript fallback |
| Accessibility (axe, WCAG 2.2 A/AA + best practice) | 0 violations on all 14 pages at 1280 and 390 px |
| Facts and wording | 13 of 13 fact rules, 8 of 8 required disclaimers, 22 of 22 key facts traced to the Company Profile |
| Lighthouse (mobile, slow 4G) | Performance 96–100, Accessibility 100, Best practices 100, SEO 100; layout shift 0 |
| Budgets | JavaScript 15 KB gzip (budget 40) · CSS 14 KB gzip (budget 28) · 3 font files (budget 4) · largest hero image 99 KB |
| Portability | every page links to its files with relative paths: opens from disk, at the top of a domain, in `/biashara/` and in a deep folder (`qa/portable.mjs`); 1,169 references all point at files that exist (`qa/references.mjs`) |

## What changed

- Removed: loading animation, page-transition curtain, custom cursor, command palette, grid overlay, index dialog, side rail, pinned and horizontal scroll sections, smooth-scroll library, animation libraries, number reels.
- New: sticky header with a phone menu, card-based sections, native accordions, one set of design tokens, mobile-first layouts, a full-weight Archivo font.
- Kept: calculator, Apply form (five steps, saved progress, result ticket), enquiry form, licence viewer, live office-hours sign, licence-expiry notice, high-contrast mode, service worker.
- Fixed on the way: the Apply sliders were hidden by a selector clash in the old script; grids that grew wider than a phone; a footer overflow at 1024 px; four colour-contrast failures on dark sections.

## Needs your decision

1. **Form endpoint and mailbox.** `SUBMIT_ENDPOINT` is empty, so Apply and Contact hand visitors a ready-made email and WhatsApp message. Give a form service or server address (and confirm `inquiries@biasharafinance.com` is the mailbox) and applications arrive directly.
2. **Licence renewal.** The 2026 licence expires 31 December 2026. From 1 January 2027 the site shows the verification notice automatically. When renewed, put the new dates and certificate in `src/js/config.js`.
3. **Domain.** `SITE_URL` is `https://www.biasharafinance.com` (canonical links, sitemap, social cards). Pages work wherever they are placed; only the 404 page uses `BASE_PATH` (`/biashara` for the GitHub Pages address, `''` at a domain root).
4. **Reconstructed portraits and low-resolution photos.** Unchanged from the source material; original files would improve them with no code change.
