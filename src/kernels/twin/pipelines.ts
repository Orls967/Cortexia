// Registry of the three documented five-tier Digital Twin experiments (EXP-040, EXP-041, EXP-042).
import type { TwinDefinition } from './common';
import { TWIN_EXCITABILITY } from './excitability';
import { TWIN_OSCILLATIONS } from './oscillations';
import { TWIN_PLASTICITY } from './plasticity';

export const TWINS: readonly TwinDefinition[] = [
  TWIN_EXCITABILITY,
  TWIN_PLASTICITY,
  TWIN_OSCILLATIONS,
];

export const TWIN_BY_ID: ReadonlyMap<string, TwinDefinition> = new Map(TWINS.map((t) => [t.id, t]));

export function getTwin(id: string): TwinDefinition {
  const t = TWIN_BY_ID.get(id);
  if (!t) throw new Error(`No Digital Twin experiment registered for ${id}`);
  return t;
}
