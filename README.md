# Biashara Trading Company Limited — website

The website is the files in this folder: `index.html` is at the top, with the pages (`about/`, `loans/`, `apply/` …),
`assets/`, `_headers` and `.htaccess` beside it. Any static web host can serve this folder as it is; there is nothing to build.

**`source/`** holds the code that produces the site (pages, styles, scripts, build tools and checks).
You only need it to change the site. See [`source/README.md`](source/README.md).

## Put it online

- **Netlify:** Add new site → Import an existing project → GitHub → pick this repository. `netlify.toml` is already set up.
- **Cloudflare Pages:** Workers & Pages → Create → Pages → Connect to Git → pick this repository, leave the build command empty and set the build output directory to `/`.
- **cPanel:** upload the contents of this folder (everything except `source/`) into `public_html`, keeping `.htaccess`.
- **GitHub Pages:** works. The repository is published at `https://<user>.github.io/<repository>/`, a folder rather than a domain root, so the site is built with `BASE_PATH: '/biashara'` (set in `source/src/js/config.js`) and every link, image, font and script carries that prefix. **If you change the repository name, add a custom domain, or move to Netlify, Cloudflare Pages or cPanel, set `BASE_PATH` to `''` (or to the new folder) and run `npm run release` again**, otherwise the site loads without images, styles or scripts. GitHub Pages ignores `_headers`, so the security and caching rules are not applied there. Netlify or Cloudflare Pages are better.

## Change something

Settings (licence dates, form address, contacts, hours, domain, `BASE_PATH`) are in `source/src/js/config.js`. After editing:

```bash
cd source
npm install
npm run release    # builds the site and copies it into this folder
```

Then commit and push. Everything else is explained in [`source/README.md`](source/README.md).
