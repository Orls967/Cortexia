// Seeded graph generators. Every graph produced here is SYNTHETIC_TOPOLOGY (NETWORK_MODELS mandatory
// provenance distinction): none of these matrices is a measured connectome.
import { Rng } from '../core/prng';

export type GraphProvenance = 'EMPIRICAL_STRUCTURAL' | 'ESTIMATED_FUNCTIONAL' | 'SYNTHETIC_TOPOLOGY';

export interface GeneratedGraph {
  n: number;
  /** Row-major weight matrix W[i*n + j] = weight of edge j → i (symmetric for undirected graphs). */
  weights: Float64Array;
  provenance: GraphProvenance;
  description: string;
  labels?: string[];
  /** Node coordinates (x, y, z) for layout; schematic unless stated otherwise. */
  positions?: Float64Array;
  /** Node group index (module / lobe). */
  groups?: Int32Array;
  groupNames?: string[];
  /** Pairwise distances in mm when positions carry a metric interpretation. */
  distances?: Float64Array;
}

export const GRAPH_KIND_OPTIONS = [
  { value: 0, label: 'All-to-all' },
  { value: 1, label: 'Ring lattice (k = 4)' },
  { value: 2, label: 'Watts–Strogatz small world (k = 6, p = 0.1)' },
  { value: 3, label: 'Erdős–Rényi random (p = 0.1)' },
  { value: 4, label: 'Barabási–Albert scale-free (m = 3)' },
  { value: 5, label: 'Modular stochastic block model (4 modules)' },
];

const sym = (w: Float64Array, n: number, i: number, j: number, v = 1) => { w[i * n + j] = v; w[j * n + i] = v; };

export function ringLattice(n: number, k: number): Float64Array {
  const w = new Float64Array(n * n);
  const half = Math.floor(k / 2);
  for (let i = 0; i < n; i++) for (let d = 1; d <= half; d++) { const j = (i + d) % n; if (j !== i) sym(w, n, i, j); }
  return w;
}

export function wattsStrogatz(n: number, k: number, p: number, rng: Rng): Float64Array {
  const w = ringLattice(n, k);
  const half = Math.floor(k / 2);
  for (let d = 1; d <= half; d++) {
    for (let i = 0; i < n; i++) {
      if (rng.next() >= p) continue;
      const j = (i + d) % n;
      if (w[i * n + j] === 0) continue;
      let tries = 0, target = rng.int(n);
      while ((target === i || w[i * n + target] !== 0) && tries++ < 50) target = rng.int(n);
      if (target === i || w[i * n + target] !== 0) continue;
      sym(w, n, i, j, 0);
      sym(w, n, i, target);
    }
  }
  return w;
}

export function erdosRenyi(n: number, p: number, rng: Rng): Float64Array {
  const w = new Float64Array(n * n);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (rng.next() < p) sym(w, n, i, j);
  return w;
}

export function barabasiAlbert(n: number, m: number, rng: Rng): Float64Array {
  const w = new Float64Array(n * n);
  const m0 = Math.min(n, m + 1);
  for (let i = 0; i < m0; i++) for (let j = i + 1; j < m0; j++) sym(w, n, i, j);
  const deg = new Float64Array(n);
  for (let i = 0; i < m0; i++) deg[i] = m0 - 1;
  let total = m0 * (m0 - 1);
  for (let v = m0; v < n; v++) {
    const chosen = new Set<number>();
    let guard = 0;
    while (chosen.size < Math.min(m, v) && guard++ < 10000) {
      let r = rng.next() * total, pick = 0;
      for (let u = 0; u < v; u++) { r -= deg[u]!; if (r <= 0) { pick = u; break; } pick = u; }
      chosen.add(pick);
    }
    for (const u of chosen) { sym(w, n, v, u); deg[u] = deg[u]! + 1; deg[v] = deg[v]! + 1; total += 2; }
  }
  return w;
}

export function modularGraph(n: number, modules: number, pIn: number, pOut: number, rng: Rng): { weights: Float64Array; groups: Int32Array } {
  const w = new Float64Array(n * n);
  const groups = new Int32Array(n);
  for (let i = 0; i < n; i++) groups[i] = Math.min(modules - 1, Math.floor((i * modules) / n));
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (rng.next() < (groups[i] === groups[j] ? pIn : pOut)) sym(w, n, i, j);
  return { weights: w, groups };
}

export function completeGraph(n: number): Float64Array {
  const w = new Float64Array(n * n);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) sym(w, n, i, j);
  return w;
}

/** Two cliques of size n/2 joined by a single bridge edge (modularity benchmark). */
export function twoCliques(n: number): Float64Array {
  const w = new Float64Array(n * n);
  const h = Math.floor(n / 2);
  for (let i = 0; i < h; i++) for (let j = i + 1; j < h; j++) sym(w, n, i, j);
  for (let i = h; i < n; i++) for (let j = i + 1; j < n; j++) sym(w, n, i, j);
  sym(w, n, h - 1, h);
  return w;
}

export function starGraph(n: number): Float64Array {
  const w = new Float64Array(n * n);
  for (let i = 1; i < n; i++) sym(w, n, 0, i);
  return w;
}

export function generateGraph(kind: number, n: number, seed: number): GeneratedGraph {
  const rng = new Rng(seed ^ 0x7f4a7c15);
  switch (kind) {
    case 1: return { n, weights: ringLattice(n, 4), provenance: 'SYNTHETIC_TOPOLOGY', description: 'Ring lattice, each node linked to its 4 nearest neighbours' };
    case 2: return { n, weights: wattsStrogatz(n, 6, 0.1, rng), provenance: 'SYNTHETIC_TOPOLOGY', description: 'Watts–Strogatz small-world graph (k = 6, rewiring p = 0.1)' };
    case 3: return { n, weights: erdosRenyi(n, 0.1, rng), provenance: 'SYNTHETIC_TOPOLOGY', description: 'Erdős–Rényi random graph (p = 0.1)' };
    case 4: return { n, weights: barabasiAlbert(n, 3, rng), provenance: 'SYNTHETIC_TOPOLOGY', description: 'Barabási–Albert preferential-attachment graph (m = 3)' };
    case 5: { const g = modularGraph(n, 4, 0.4, 0.03, rng); return { n, weights: g.weights, groups: g.groups, groupNames: ['Module 1', 'Module 2', 'Module 3', 'Module 4'], provenance: 'SYNTHETIC_TOPOLOGY', description: 'Stochastic block model with 4 modules (p_in = 0.4, p_out = 0.03)' }; }
    default: return { n, weights: completeGraph(n), provenance: 'SYNTHETIC_TOPOLOGY', description: 'Complete (all-to-all) graph' };
  }
}

// Desikan–Killiany atlas region labels (34 per hemisphere; REF-DESIKAN-2006). The labels are the atlas
// nomenclature. The coordinates below are a SCHEMATIC layout authored for visualization (approximate lobar
// placement in a head-like frame: +x right, +y anterior, +z superior, mm-like units). They are not measured
// MNI centroids and must not be cited as such.
const DK: [string, string, number, number, number][] = [
  ['bankssts', 'Temporal', 52, -44, 6], ['caudalanteriorcingulate', 'Cingulate', 6, 18, 28], ['caudalmiddlefrontal', 'Frontal', 38, 10, 48],
  ['cuneus', 'Occipital', 8, -80, 20], ['entorhinal', 'Temporal', 24, -8, -32], ['fusiform', 'Temporal', 34, -44, -20],
  ['inferiorparietal', 'Parietal', 44, -64, 30], ['inferiortemporal', 'Temporal', 50, -32, -24], ['isthmuscingulate', 'Cingulate', 8, -46, 14],
  ['lateraloccipital', 'Occipital', 32, -86, 2], ['lateralorbitofrontal', 'Frontal', 26, 34, -14], ['lingual', 'Occipital', 14, -68, -4],
  ['medialorbitofrontal', 'Frontal', 6, 40, -16], ['middletemporal', 'Temporal', 58, -26, -12], ['parahippocampal', 'Temporal', 24, -30, -16],
  ['paracentral', 'Frontal', 8, -28, 58], ['parsopercularis', 'Frontal', 48, 14, 14], ['parsorbitalis', 'Frontal', 44, 34, -8],
  ['parstriangularis', 'Frontal', 48, 28, 6], ['pericalcarine', 'Occipital', 12, -80, 6], ['postcentral', 'Parietal', 42, -26, 52],
  ['posteriorcingulate', 'Cingulate', 6, -22, 36], ['precentral', 'Frontal', 38, -10, 52], ['precuneus', 'Parietal', 10, -58, 40],
  ['rostralanteriorcingulate', 'Cingulate', 6, 36, 6], ['rostralmiddlefrontal', 'Frontal', 34, 44, 20], ['superiorfrontal', 'Frontal', 14, 28, 50],
  ['superiorparietal', 'Parietal', 24, -60, 56], ['superiortemporal', 'Temporal', 56, -14, -2], ['supramarginal', 'Parietal', 54, -38, 32],
  ['frontalpole', 'Frontal', 10, 62, -6], ['temporalpole', 'Temporal', 36, 12, -34], ['transversetemporal', 'Temporal', 46, -22, 10],
  ['insula', 'Insula', 36, 2, 4],
];
export const DK_LOBES = ['Frontal', 'Parietal', 'Temporal', 'Occipital', 'Cingulate', 'Insula'];

/**
 * Synthetic 68-node structural graph on Desikan–Killiany labels (DIGITAL_TWIN_ARCHITECTURE Exp. C: "synthetic/benchmark
 * cortical structural graph based on Desikan–Killiany parcellation labels"). Weights follow an exponential distance rule
 * with a same-lobe bonus, log-normal jitter and strong homotopic links, then the weakest edges are pruned.
 */
export function syntheticConnectome68(seed: number, density = 0.25): GeneratedGraph {
  const n = 68;
  const rng = new Rng(seed ^ 0x3c6ef372);
  const labels: string[] = [], positions = new Float64Array(n * 3), groups = new Int32Array(n);
  for (let h = 0; h < 2; h++) {
    for (let r = 0; r < 34; r++) {
      const [name, lobe, x, y, z] = DK[r]!;
      const i = h * 34 + r;
      labels.push(`${h === 0 ? 'L' : 'R'} ${name}`);
      positions[i * 3] = h === 0 ? -x : x; positions[i * 3 + 1] = y; positions[i * 3 + 2] = z;
      groups[i] = DK_LOBES.indexOf(lobe);
    }
  }
  const dist = new Float64Array(n * n), w = new Float64Array(n * n);
  const cand: { i: number; j: number; v: number }[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = Math.hypot(positions[i * 3]! - positions[j * 3]!, positions[i * 3 + 1]! - positions[j * 3 + 1]!, positions[i * 3 + 2]! - positions[j * 3 + 2]!);
      dist[i * n + j] = d; dist[j * n + i] = d;
      const sameHemi = (i < 34) === (j < 34);
      const homotopic = j === i + 34;
      let v = Math.exp(-d / 28) * (groups[i] === groups[j] && sameHemi ? 1.8 : 1) * Math.exp(0.5 * rng.normal());
      if (!sameHemi && !homotopic) v *= 0.25;
      if (homotopic) v = 0.6 * Math.exp(0.25 * rng.normal());
      cand.push({ i, j, v });
    }
  }
  cand.sort((a, b) => b.v - a.v);
  const keep = Math.round(density * (n * (n - 1)) / 2);
  for (let k = 0; k < keep; k++) { const c = cand[k]!; w[c.i * n + c.j] = c.v; w[c.j * n + c.i] = c.v; }
  // Guarantee connectedness: attach any isolated node to its nearest neighbour.
  for (let i = 0; i < n; i++) {
    let deg = 0;
    for (let j = 0; j < n; j++) deg += w[i * n + j]! > 0 ? 1 : 0;
    if (deg === 0) {
      let best = -1, bd = Infinity;
      for (let j = 0; j < n; j++) if (j !== i && dist[i * n + j]! < bd) { bd = dist[i * n + j]!; best = j; }
      if (best >= 0) { w[i * n + best] = 0.05; w[best * n + i] = 0.05; }
    }
  }
  return {
    n, weights: w, labels, positions, groups, groupNames: DK_LOBES, distances: dist, provenance: 'SYNTHETIC_TOPOLOGY',
    description: 'Synthetic 68-node graph on Desikan–Killiany labels: exponential distance rule, lobe bonus, homotopic links (not a measured connectome; schematic coordinates)',
  };
}

/** Symmetric normalization W̃ = D^{-1/2} W D^{-1/2} (largest eigenvalue 1 for a connected graph). */
export function normalizeAdjacency(w: Float64Array, n: number): Float64Array {
  const d = new Float64Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < n; j++) s += w[i * n + j]!; d[i] = s > 0 ? 1 / Math.sqrt(s) : 0; }
  const out = new Float64Array(n * n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) out[i * n + j] = d[i]! * w[i * n + j]! * d[j]!;
  return out;
}
