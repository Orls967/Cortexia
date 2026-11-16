// Shared contracts for the five-tier educational Digital Twin (docs/02-scientific-foundation/DIGITAL_TWIN_ARCHITECTURE.md).
// A twin experiment chains stage outputs into stage inputs. Every stage declares whether its link to the next
// stage is MECHANISTIC (numbers are passed on) or CONCEPTUAL (interpretive anchoring through the knowledge graph).
import type { ModelOutput, ParamSpec, ViewSpec } from '../core/types';

export type CouplingMode = 'MECHANISTIC' | 'CONCEPTUAL';

export interface TwinStage {
  index: number;
  title: string;
  tier: 'Tier 1' | 'Tier 2' | 'Tier 3' | 'Tier 4' | 'Tier 5';
  coupling: CouplingMode;
  /** Registry models whose equations this stage evaluates. */
  modelIds: string[];
  /** Scientific entities this stage refers to (UCES targets). */
  entityIds: string[];
  input: string;
  output: string;
  timescale: string;
  /** Result-specific sentence filled in after the run. */
  summary: string;
}

export interface TwinComparison {
  key: string;
  label: string;
  unit: string;
  baseline: number;
  intervention: number;
  description: string;
  analyticId?: string;
  digits?: number;
}

export interface TwinResult {
  experimentId: string;
  conditions: { baseline: ModelOutput; intervention: ModelOutput };
  stages: TwinStage[];
  comparisons: TwinComparison[];
  notes: string[];
}

export interface TwinDefinition {
  /** EXP-* registry ID. */
  id: string;
  title: string;
  /** Tier 1 anatomical anchor: a conceptual link, never a claim that the simulation reproduces that region. */
  anchorEntityIds: string[];
  anchorNote: string;
  params: ParamSpec[];
  views: ViewSpec[];
  /** Static description of the pipeline, shown before any run. */
  stages: Omit<TwinStage, 'summary'>[];
  validationBoundary: string;
  limitations: string[];
  references: string[];
  provenance: 'SYNTHETIC_SIMULATION';
  run: (params: Record<string, number>, seed: number, onProgress?: (fraction: number, label?: string) => void) => TwinResult;
}

export const emptyOutput = (): ModelOutput => ({ t: new Float64Array(0), series: {}, curves: {}, matrices: {}, metrics: {}, notes: [], status: 'COMPLETED' });

export function reader(specs: ParamSpec[], values: Record<string, number>): (key: string) => number {
  const defaults = new Map(specs.map((s) => [s.key, s]));
  return (key) => {
    const s = defaults.get(key);
    if (!s) throw new Error(`Unknown twin parameter ${key}`);
    const v = values[key];
    return v !== undefined && Number.isFinite(v) ? Math.min(s.max, Math.max(s.min, v)) : s.default;
  };
}

/** Fixed in-degree random presynaptic lists turned into outgoing adjacency (presynaptic neuron → targets). */
export function outgoingFromInDegree(nPre: number, nPost: number, k: number, pick: (n: number, k: number, exclude: number) => Uint32Array, samepopulation: boolean): Uint32Array[] {
  const lists: number[][] = Array.from({ length: nPre }, () => []);
  for (let post = 0; post < nPost; post++) {
    const pre = pick(nPre, Math.min(k, nPre - (samepopulation ? 1 : 0)), samePopulationExclude(samepopulation, post));
    for (let q = 0; q < pre.length; q++) lists[pre[q]!]!.push(post);
  }
  return lists.map((l) => Uint32Array.from(l));
}
const samePopulationExclude = (same: boolean, post: number) => (same ? post : -1);
