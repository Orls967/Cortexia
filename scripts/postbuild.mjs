// Post-build verification & static SPA route pre-emission for GitHub Pages (GITHUB_PAGES_DEPLOYMENT §3).
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
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

// Pre-emit static index.html copies for every known client route and entity permalink so direct
// navigation on GitHub Pages returns HTTP 200 (via canonical directory index) instead of triggering 404.html.
const indexHtml = readFileSync(join(dist, 'index.html'), 'utf-8');
const staticRoutes = [
  'explore/observatory',
  'explore/anatomy',
  'explore/cellular',
  'explore/molecular',
  'explore/synapses',
  'explore/circuits',
  'explore/physiology',
  'explore/systems',
  'explore/cognition',
  'lab',
  'lab/digital-twin',
  'lab/digital-twin/EXP-040',
  'lab/digital-twin/EXP-041',
  'lab/digital-twin/EXP-042',
  'analytics',
  'analytics/signals',
  'analytics/spikes',
  'analytics/networks',
  'analytics/stats',
  'analytics/import',
  'knowledge',
  'knowledge/graph',
  'knowledge/equations',
  'knowledge/datasets',
  'knowledge/validation',
  'knowledge/references',
  'research',
  'research/notebook',
];

const routeSet = new Set(staticRoutes);
const idxData = JSON.parse(readFileSync(join(dist, 'data/index.json'), 'utf-8'));
for (const row of idxData.entities ?? []) {
  const id = String(row[0] ?? '');
  if (!/^[A-Za-z0-9._-]+$/.test(id)) continue;
  routeSet.add(`knowledge/${id}`);
  routeSet.add(`knowledge/graph/${id}`);
  if (id.startsWith('ANAT-')) routeSet.add(`explore/anatomy/${id}`);
  else if (id.startsWith('CELL-')) routeSet.add(`explore/cellular/${id}`);
  else if (id.startsWith('MOL-')) routeSet.add(`explore/molecular/${id}`);
  else if (id.startsWith('MECH-')) {
    routeSet.add(`explore/synapses/${id}`);
    routeSet.add(`explore/physiology/${id}`);
  } else if (id.startsWith('CIRC-')) routeSet.add(`explore/circuits/${id}`);
  else if (id.startsWith('SYS-')) routeSet.add(`explore/systems/${id}`);
  else if (id.startsWith('COG-')) routeSet.add(`explore/cognition/${id}`);
  else if (id.startsWith('MODEL-')) routeSet.add(`lab/${id}`);
  else if (id.startsWith('EQ-')) routeSet.add(`knowledge/equations/${id}`);
  else if (id.startsWith('DSET-')) routeSet.add(`knowledge/datasets/${id}`);
}

let emittedRoutes = 0;
for (const rel of routeSet) {
  const outDir = join(dist, rel);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'index.html'), indexHtml, 'utf-8');
  emittedRoutes++;
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
console.log(`[postbuild] Verified ${fileCount} files (${emittedRoutes} static routes) in dist/ (${(totalBytes / (1024 * 1024)).toFixed(2)} MB total).`);
