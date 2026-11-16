// Builds the static runtime data bundle (public/data/) from the authoritative Phase 0 registries.
// The registries stay the single source of truth; nothing here invents scientific content.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const reg = (p) => JSON.parse(readFileSync(join(root, 'registries', p), 'utf8'));
const out = join(root, 'public', 'data');
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'expl'), { recursive: true });
mkdirSync(join(out, 'reg'), { recursive: true });
const write = (p, data) => writeFileSync(join(out, p), JSON.stringify(data));

const registries = {
  anatomy: reg('anatomical-entities/anatomical-entities.json').items,
  cells: reg('cellular-entities/cellular-entities.json').items,
  molecules: reg('molecular-entities/molecular-entities.json').items,
  mechanisms: reg('mechanisms/physiological-mechanisms.json').items,
  circuits: reg('circuits-pathways/circuits-and-pathways.json').items,
  systems: reg('functional-systems/functional-systems.json').items,
  equations: reg('equations/equations.json').items,
  parameters: reg('parameters/parameters.json').items,
  models: reg('scientific-models/scientific-models.json').items,
  experiments: reg('experiments/experiments.json').items,
  analysisMethods: reg('analysis-methods/analysis-methods.json').items,
  datasets: reg('datasets/datasets.json').items,
  assets: reg('assets-3d/assets-3d.json').items,
  references: reg('scientific-references/scientific-references.json').items,
};
const coverage = reg('explanation-coverage/explanation-coverage.json');
const kg = reg('knowledge-graph/knowledge-graph.json');
const trace = reg('traceability/requirements-traceability.json');

const strip = (o) => {
  const { schemaVersion: _s, ...rest } = o;
  return rest;
};

for (const [name, items] of Object.entries(registries)) write(`reg/${name}.json`, items.map(strip));
write('reg/validationCases.json', trace.validationCases.map(strip));
write('reg/requirements.json', trace.requirements.map(strip));
write('reg/uiCoverageMatrix.json', coverage.uiEntityCoverageMatrix.map(strip));

// Explanation records, chunked by ID prefix so the inspector only loads what it needs.
const chunks = {};
for (const item of coverage.items) {
  const prefix = item.id.split('-')[0];
  (chunks[prefix] ??= {})[item.id] = strip(item);
}
for (const [prefix, items] of Object.entries(chunks)) write(`expl/${prefix}.json`, items);

// Core entity index: powers global search, tooltips and ID resolution. Tuple layout keeps it compact.
// [id, canonicalName, entityType, primaryScale, shortDefinition, epistemicStatus, aliases]
const index = coverage.items.map((i) => [
  i.id,
  i.canonicalName,
  i.entityType,
  i.primaryScale,
  i.shortDefinition,
  i.epistemicStatus,
  (i.aliases ?? []).filter((a) => a !== i.canonicalName),
]);
for (const r of registries.references) {
  index.push([r.id, `${r.authors} (${r.year})`, 'SCIENTIFIC_REFERENCE', 'L9', `${r.title}. ${r.venue}.`, 'ESTABLISHED', [r.title]]);
}
for (const e of registries.experiments) {
  index.push([e.id, e.title, 'EXPERIMENT', e.primaryScale, e.hypothesis, 'THEORETICAL_MODEL', []]);
}
for (const a of registries.assets) {
  index.push([a.id, a.name, 'ASSET_3D', 'L7', a.simplificationDisclosure, 'SYNTHETIC_ILLUSTRATIVE', []]);
}
for (const v of trace.validationCases) {
  index.push([v.id, `Validation case ${v.id}`, 'VALIDATION_CASE', 'L3', `${v.referenceCondition} Expected: ${v.expectedBehavior}`, 'ESTABLISHED', []]);
}
write('index.json', { entities: index });

// Compact knowledge graph: nodes as tuples, edges as index triples.
const relTypes = [...new Set(kg.edges.map((e) => e.relationType))].sort();
const cats = [...new Set(kg.nodes.map((n) => n.nodeCategory))].sort();
const nodeIdx = new Map(kg.nodes.map((n, i) => [n.id, i]));
write('kg.json', {
  relTypes,
  categories: cats,
  nodes: kg.nodes.map((n) => [n.id, n.label, cats.indexOf(n.nodeCategory), n.primaryScale]),
  edges: kg.edges.map((e) => [nodeIdx.get(e.sourceId), nodeIdx.get(e.targetId), relTypes.indexOf(e.relationType)]),
});

const counts = Object.fromEntries(Object.entries(registries).map(([k, v]) => [k, v.length]));
write('manifest.json', {
  counts: { ...counts, explanations: coverage.items.length, kgNodes: kg.nodes.length, kgEdges: kg.edges.length, validationCases: trace.validationCases.length, indexEntities: index.length },
  explanationChunks: Object.keys(chunks).sort(),
});
console.log(`[build-data] ${index.length} index entities, ${coverage.items.length} explanations, ${kg.nodes.length} KG nodes, ${kg.edges.length} KG edges`);
