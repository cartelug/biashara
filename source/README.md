# Biashara Trading Company Limited — website

The website of Biashara Trading Company Limited, built from the 2026 Company Profile (Edition 2026, Version 5).
Every fact on the site comes from that profile; `qa/report/fact-audit.md` lists the page each one comes from.

The finished website sits at the top level of the repository (`index.html` in the root, one folder up from this one).
This `source/` folder is the code that builds it. The site is plain HTML, CSS, JavaScript and images, so any web host can serve it.
You do not need to install anything to publish it.

---

## 1. Publish the site (pick one)

### Netlify (easiest, free)

1. Go to <https://app.netlify.com/drop> and sign in (or create a free account).
2. Drag the site folder onto the page (the unzipped `biashara-dist.zip`, or the repository root without `source/`).
3. Netlify gives you an address such as `https://biashara-1234.netlify.app`. The site is live.
4. To use your own domain: **Site configuration → Domain management → Add a domain**, then follow the steps shown.

The security and caching rules in `_headers` are applied automatically.

### Cloudflare Pages (free)

1. Sign in at <https://dash.cloudflare.com> and open **Workers & Pages → Create → Pages → Upload assets**.
2. Give the project a name, then drag the site folder in and press **Deploy**.
3. To use your own domain: open the project, **Custom domains → Set up a custom domain**.

`_headers` is applied automatically here too.

### From GitHub (Netlify or Cloudflare Pages)

The site is committed at the repository root, so no build step is needed.

- **Netlify:** **Add new site → Import an existing project → GitHub**, pick the repository. `netlify.toml` already tells Netlify to publish the root.
- **Cloudflare Pages:** **Workers & Pages → Create → Pages → Connect to Git**, pick the repository, leave the build command empty and set the build output directory to `/`.
- **GitHub Pages** only works at the root of a domain (custom domain, or a repository named `<user>.github.io`), because the site uses root paths such as `/assets/`. It also ignores `_headers`, so Netlify or Cloudflare Pages are better.

### cPanel (shared hosting)

1. Log in to cPanel and open **File Manager**.
2. Open **`public_html`** (or the folder for your domain). Back up anything already there.
3. Press **Upload** and upload `biashara-dist.zip` (the zip of the site).
4. Select the zip, press **Extract**, and make sure the files land directly in `public_html`
   (you should see `index.html`, `_headers`, `.htaccess`, `assets`, `loans` and so on). Delete the zip afterwards.
5. File Manager hides files that start with a dot. Use **Settings → Show Hidden Files** to check `.htaccess` is there:
   it sets the security headers, caching, compression, clean addresses and the 404 page.
6. Turn on HTTPS in **SSL/TLS Status** (AutoSSL) if it is not on already.

---

## 2. Change settings

All settings live in one file: **`src/js/config.js`**. Open it in any text editor. Each setting has a note above it.

| Setting | What it does |
|---|---|
| `LICENCE.issued`, `LICENCE.expires` | Licence dates (YYYY-MM-DD). The day after `expires` (Kampala time), the licence page, the footer and other licence mentions automatically say: “The reference copy shown is the 2026 certificate. To verify the current licence, contact the Board of Directors.” When the licence is renewed, put in the new dates and replace the certificate image (see section 4). |
| `SUBMIT_ENDPOINT` | Where the Apply and Contact forms send their details. Left empty, visitors get a ready-made email and WhatsApp message to send themselves, and the stamp reads “READY TO SEND”. Put in an `https://` address of a form service (for example Formspree) or your own server to receive the details directly; the stamp then reads “RECEIVED”. |
| `CONTACT` | Email, phone numbers, WhatsApp number and address. |
| `HOURS` | Office hours used by the live “Open now / Closed” sign (Kampala time). |
| `SITE_URL` | Your public web address, used for search engines and link previews. Change it if the domain is not `www.biasharafinance.com`. |
| `SERVICE_WORKER` | Offline support. Set to `false` to switch it off. |

**After editing `config.js`, rebuild the site** (section 3: `npm run release`), then commit and push.

---

## 3. Rebuild the site (only after changing something)

You need Node.js 20 or newer (<https://nodejs.org>, the “LTS” download).

```bash
cd source
npm install        # once, downloads the build tools
npm run build      # writes a fresh source/dist folder
npm run preview    # optional: view it at http://localhost:4173
npm run release    # builds, then copies the site into the repository root (index.html at the top)
```

To check everything after a change:

```bash
npm run qa                      # build, then facts, accessibility, behaviour tests and screenshots
npm run qa -- --lighthouse      # also runs Lighthouse (slower)
```

Reports are written to `qa/report/`.

---

## 4. Replace a photo or the licence certificate

Photos are in `src/img-source/`. Replace a file with a new one of the same name and rebuild; the build makes
all the sizes and formats (AVIF, WebP, JPEG) itself. Crops and descriptions are in `build/images.mjs` and `src/data/images.mjs`.
For a renewed licence, replace `src/img-source/licence-2026.jpg`, update the dates in `config.js`, and check the
numbered markers on the licence page still sit on the right lines (`src/pages/licence.html`, `data-x` / `data-y` in percent).

---

## 5. What is where

```
../index.html …     the finished site, at the repository root
dist/               the last build (copied to the root by `npm run release`)
src/js/config.js    settings (dates, form address, contacts, hours, domain)
src/pages/          page content
src/partials/       header, footer and shared pieces
src/css/            styles (design tokens are in 00-tokens.css)
src/js/             behaviour (calculator, Apply, router, motion)
src/data/           pages, products, footnotes and image list
build/              the build and the local preview server
qa/                 checks and their reports
```

Keyboard shortcuts on the site: **K** or **/** opens the command palette, **G** shows the layout grid, **Esc** closes.
