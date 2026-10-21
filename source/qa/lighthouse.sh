#!/usr/bin/env bash
# Lighthouse (mobile, simulated slow 4G) on the main pages. Needs the preview running: npm run preview
# Usage: bash qa/lighthouse.sh [baseUrl]
BASE=${1:-http://localhost:4173}
CH=${CHROME_PATH:-$(node -e "console.log(require('playwright').chromium.executablePath())")}
mkdir -p qa/report/lighthouse
for p in ${PAGES:-"" loans apply licence contact about}; do
  n=${p:-home}
  CHROME_PATH=$CH npx lighthouse "$BASE/$p${p:+/}" --quiet --chrome-flags="--headless=new --no-sandbox" --output=json --output-path=qa/report/lighthouse/$n.json --only-categories=performance,accessibility,best-practices,seo >/dev/null 2>&1
  node -e "const r=require('./qa/report/lighthouse/$n.json');const c=r.categories;console.log('$n'.padEnd(8),Object.values(c).map(x=>x.id.replace('best-practices','bp').replace('performance','perf').replace('accessibility','a11y')+' '+Math.round(x.score*100)).join(' · '),'· LCP',r.audits['largest-contentful-paint'].displayValue,'· CLS',r.audits['cumulative-layout-shift'].displayValue,'· TBT',r.audits['total-blocking-time'].displayValue)"
done
