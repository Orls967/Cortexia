// Deterministic route and search resolver (INFORMATION_ARCHITECTURE §5-6).
import type { EntityIndex } from './registry';
import type { IndexEntity } from './types';

export interface EntityRoutes {
  knowledgePath: string;
  explorePath?: string;
  labPath?: string;
}

export function resolveEntityRoute(id: string, associatedModels?: string[]): EntityRoutes {
  const knowledgePath = id.startsWith('EQ-')
    ? `/knowledge/equations/${encodeURIComponent(id)}`
    : id.startsWith('DSET-')
      ? `/knowledge/datasets/${encodeURIComponent(id)}`
      : id.startsWith('REF-')
        ? `/knowledge/references?ref=${encodeURIComponent(id)}`
        : `/knowledge/${encodeURIComponent(id)}`;

  let explorePath: string | undefined;
  if (id.startsWith('ANAT-')) explorePath = `/explore/anatomy/${encodeURIComponent(id)}`;
  else if (id.startsWith('CELL-')) explorePath = `/explore/cellular/${encodeURIComponent(id)}`;
  else if (id.startsWith('MOL-')) explorePath = `/explore/molecular/${encodeURIComponent(id)}`;
  else if (id.startsWith('MECH-')) explorePath = `/explore/physiology/${encodeURIComponent(id)}`;
  else if (id.startsWith('CIRC-')) explorePath = `/explore/circuits/${encodeURIComponent(id)}`;
  else if (id.startsWith('SYS-')) explorePath = `/explore/systems/${encodeURIComponent(id)}`;
  else if (id.startsWith('COG-')) explorePath = `/explore/cognition/${encodeURIComponent(id)}`;
  else if (id.startsWith('ANALYTIC-')) explorePath = '/analytics/signals';

  let labPath: string | undefined;
  if (id.startsWith('MODEL-')) labPath = `/lab/${encodeURIComponent(id)}`;
  else if (id === 'EXP-040' || id === 'EXP-041' || id === 'EXP-042') labPath = `/lab/digital-twin/${encodeURIComponent(id)}`;
  else if (associatedModels && associatedModels.length > 0) labPath = `/lab/${encodeURIComponent(associatedModels[0]!)}?context=${encodeURIComponent(id)}`;

  return { knowledgePath, ...(explorePath ? { explorePath } : {}), ...(labPath ? { labPath } : {}) };
}

const PREFIX_FILTERS: Record<string, string> = {
  anat: 'ANAT-',
  cell: 'CELL-',
  mol: 'MOL-',
  mech: 'MECH-',
  circ: 'CIRC-',
  sys: 'SYS-',
  cog: 'COG-',
  model: 'MODEL-',
  eq: 'EQ-',
  param: 'PARAM-',
  dset: 'DSET-',
  analytic: 'ANALYTIC-',
  ref: 'REF-',
  exp: 'EXP-',
};

export function searchEntities(index: EntityIndex, rawQuery: string, limit = 40): IndexEntity[] {
  const q = rawQuery.trim();
  if (!q) return index.list.slice(0, limit);
  const lower = q.toLowerCase();
  const colon = lower.indexOf(':');
  let prefixFilter: string | null = null;
  let term = lower;
  if (colon > 0) {
    const p = lower.slice(0, colon);
    if (PREFIX_FILTERS[p]) {
      prefixFilter = PREFIX_FILTERS[p]!;
      term = lower.slice(colon + 1).trim();
    }
  }

  const scored: { entity: IndexEntity; score: number }[] = [];
  for (const e of index.list) {
    if (prefixFilter && !e.id.startsWith(prefixFilter)) continue;
    if (!term) {
      scored.push({ entity: e, score: 1 });
      continue;
    }
    const idL = e.id.toLowerCase();
    const nameL = e.name.toLowerCase();
    let score = 0;
    if (idL === term) score = 100;
    else if (nameL === term) score = 90;
    else if (idL.startsWith(term) || nameL.startsWith(term)) score = 70;
    else if (nameL.includes(term)) score = 50;
    else if (e.aliases.some((a) => a.toLowerCase().includes(term))) score = 45;
    else if (idL.includes(term)) score = 40;
    else if (e.shortDefinition.toLowerCase().includes(term)) score = 20;
    if (score > 0) scored.push({ entity: e, score });
  }
  scored.sort((a, b) => b.score - a.score || a.entity.name.localeCompare(b.entity.name));
  return scored.slice(0, limit).map((s) => s.entity);
}
