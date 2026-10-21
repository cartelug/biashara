// Local preview of /dist with the same clean URLs and 404 page as the hosts in the README.
// When the site was built with a BASE_PATH (dist/build.json), it is served under that folder, as GitHub Pages does.
// Usage: node build/serve.mjs [port]
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const PORT = Number(process.argv[2] || process.env.PORT || 4173);
let BASE = '';
try { BASE = JSON.parse(await fs.readFile(path.join(ROOT, 'build.json'), 'utf8')).base || ''; } catch { /* built without a base */ }
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml',
};

async function resolve(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  let p = path.normalize(path.join(ROOT, clean));
  if (!p.startsWith(ROOT)) return null;
  try {
    const st = await fs.stat(p);
    if (st.isDirectory()) {
      if (!clean.endsWith('/')) return { redirect: clean + '/' };
      p = path.join(p, 'index.html');
      await fs.stat(p);
    }
    return { file: p };
  } catch { return null; }
}

// Apply the security and cache headers from dist/_headers (Netlify / Cloudflare Pages format)
async function hostHeaders(urlPath) {
  let txt = ''; try { txt = await fs.readFile(path.join(ROOT, '_headers'), 'utf8'); } catch { return {}; }
  const out = {}; let match = false;
  for (const line of txt.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) { const pat = line.trim(); match = pat.endsWith('*') ? urlPath.startsWith(pat.slice(0, -1)) : urlPath === pat; continue; }
    if (match) { const i = line.indexOf(':'); out[line.slice(0, i).trim()] = line.slice(i + 1).trim(); }
  }
  return out;
}

http.createServer(async (req, res) => {
  const [rawPath, query = ''] = req.url.split('?');
  const inBase = !BASE || rawPath.startsWith(BASE + '/');
  if (BASE && (rawPath === '/' || rawPath === BASE)) { res.writeHead(302, { Location: BASE + '/' + (query ? '?' + query : '') }); return res.end(); }
  const sitePath = inBase ? rawPath.slice(BASE.length) || '/' : rawPath;
  const r = inBase ? await resolve(sitePath) : null;
  if (r?.redirect) { res.writeHead(301, { Location: BASE + r.redirect + (query ? '?' + query : '') }); return res.end(); }
  const file = r?.file || path.join(ROOT, '404.html');
  let body;
  try { body = await fs.readFile(file); } catch { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
  const type = TYPES[path.extname(file)] || 'application/octet-stream';
  const headers = { ...(await hostHeaders(sitePath)), 'Content-Type': type, 'Cache-Control': 'no-cache', Vary: 'Accept-Encoding' };
  // the preview runs on plain http, so drop the https upgrade from the policy
  if (headers['Content-Security-Policy']) headers['Content-Security-Policy'] = headers['Content-Security-Policy'].replace(/;\s*upgrade-insecure-requests/, '');
  // Compress text the way Netlify, Cloudflare Pages and most cPanel hosts do, so local measurements match
  const accept = req.headers['accept-encoding'] || '';
  if (/text|javascript|json|xml|svg/.test(type)) {
    if (/\bbr\b/.test(accept)) { body = zlib.brotliCompressSync(body); headers['Content-Encoding'] = 'br'; }
    else if (/gzip/.test(accept)) { body = zlib.gzipSync(body); headers['Content-Encoding'] = 'gzip'; }
  }
  res.writeHead(r ? 200 : 404, headers);
  res.end(body);
}).listen(PORT, () => console.log(`Preview: http://localhost:${PORT}${BASE}/`));
