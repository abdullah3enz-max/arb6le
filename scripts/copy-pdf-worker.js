// pdfjs-dist's worker is an ES module (import/export at the top level). Letting webpack
// discover it via `new URL(..., import.meta.url)` pulls it into the Next.js build, where the
// production Terser minify step chokes on ESM syntax ("'import'/'export' cannot be used outside
// module code") — a failure that only shows up in `next build`, never in `next dev`. Copying it
// into public/ as a plain static file sidesteps webpack/Terser entirely; Next serves public/
// files untouched. Runs automatically before both `next dev` and `next build` (see package.json)
// so it's always in sync with whatever pdfjs-dist version is actually installed.
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs');
const destDir = path.join(__dirname, '..', 'public');
const dest = path.join(destDir, 'pdf.worker.min.mjs');

if (!fs.existsSync(src)) {
  console.warn('[copy-pdf-worker] pdfjs-dist worker not found at', src, '— skipping (is pdfjs-dist installed?)');
  process.exit(0);
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log('[copy-pdf-worker] copied pdf.worker.min.mjs to public/');
