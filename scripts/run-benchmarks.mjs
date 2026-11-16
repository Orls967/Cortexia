// Performance benchmark harness (docs/14-quality-and-validation/PERFORMANCE_BENCHMARKS.md).
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { performance } from 'node:perf_hooks';

// Verify dist entry bundle gzip budget (< 250 KB)
const distAssetsDir = join(process.cwd(), 'dist', 'assets');
let entryGzipKb = NaN;
try {
  const manifestHtml = readFileSync(join(process.cwd(), 'dist', 'index.html'), 'utf8');
  const match = manifestHtml.match(/assets\/(index-[^"]+\.js)/);
  if (match) {
    const raw = readFileSync(join(distAssetsDir, match[1]));
    entryGzipKb = gzipSync(raw).length / 1024;
  }
} catch {
  // dist may not exist yet if build has not run
}

const indexRaw = JSON.parse(readFileSync(join(process.cwd(), 'public', 'data', 'index.json'), 'utf8'));

const t0 = performance.now();
const q = 'hippocampus';
const hits = indexRaw.entities.filter(
  ([id, name, , , def, , aliases]) =>
    id.toLowerCase().includes(q) || name.toLowerCase().includes(q) || def.toLowerCase().includes(q) || aliases.some((a) => a.toLowerCase().includes(q)),
);
const searchMs = performance.now() - t0;

const indexSizeKb = statSync(join(process.cwd(), 'public', 'data', 'index.json')).size / 1024;

console.log(JSON.stringify({
  platform: process.platform,
  nodeVersion: process.version,
  entryBundleGzipKb: Number.isFinite(entryGzipKb) ? Number(entryGzipKb.toFixed(2)) : null,
  entryBudgetKb: 250,
  indexJsonSizeKb: Number(indexSizeKb.toFixed(2)),
  searchLatencyMs: Number(searchMs.toFixed(3)),
  searchBudgetMs: 30,
  searchHits: hits.length,
}, null, 2));

if (Number.isFinite(entryGzipKb) && entryGzipKb > 250) {
  console.error(`FAIL: entry bundle ${entryGzipKb.toFixed(2)} KB > 250 KB budget`);
  process.exit(1);
}
if (searchMs > 30) {
  console.error(`FAIL: search latency ${searchMs.toFixed(2)} ms > 30 ms budget`);
  process.exit(1);
}
