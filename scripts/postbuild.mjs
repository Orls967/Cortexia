// Post-build verification for GitHub Pages static artifact integrity (GITHUB_PAGES_DEPLOYMENT §3).
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

const required = ['index.html', '404.html', '.nojekyll', 'data/manifest.json', 'data/index.json', 'data/kg.json'];
for (const rel of required) {
  const full = join(dist, rel);
  if (!existsSync(full)) {
    console.error(`[postbuild] Missing required artifact: dist/${rel}`);
    process.exit(1);
  }
}

let fileCount = 0;
let totalBytes = 0;
const maxFileBytes = 25 * 1024 * 1024;

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else {
      fileCount++;
      totalBytes += st.size;
      if (st.size > maxFileBytes) {
        console.error(`[postbuild] File exceeds 25 MB GitHub Pages safety limit: ${p} (${st.size} bytes)`);
        process.exit(1);
      }
    }
  }
}

walk(dist);
console.log(`[postbuild] Verified ${fileCount} files in dist/ (${(totalBytes / (1024 * 1024)).toFixed(2)} MB total).`);
