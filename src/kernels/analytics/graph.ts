// ANALYTIC-016 … ANALYTIC-019: network-science metrics (NETWORK_MODELS §3; Rubinov & Sporns 2010).
// Matrices are dense row-major Float64Array with W[i*n + j] = weight of the edge j → i, so row sums are
// in-strengths and column sums are out-strengths. Any non-zero entry is an edge; the diagonal is ignored.
import { Rng } from '../core/prng';

export function isSymmetric(w: Float64Array, n: number, tol = 1e-12): boolean {
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (Math.abs(w[i * n + j]! - w[j * n + i]!) > tol) return false;
  return true;
}

/** Undirected view: W_sym = max(|W_ij|, |W_ji|) with a zero diagonal. */
export function symmetrize(w: Float64Array, n: number): Float64Array {
  const out = new Float64Array(n * n);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const v = Math.max(Math.abs(w[i * n + j]!), Math.abs(w[j * n + i]!));
    out[i * n + j] = v; out[j * n + i] = v;
  }
  return out;
}

/** Out-neighbour adjacency lists (u → v when W[v*n + u] ≠ 0). */
function outLists(w: Float64Array, n: number, alive?: Uint8Array): Int32Array[] {
  const lists: number[][] = Array.from({ length: n }, () => []);
  for (let v = 0; v < n; v++) {
    if (alive && !alive[v]) continue;
    for (let u = 0; u < n; u++) if (u !== v && w[v * n + u] !== 0 && (!alive || alive[u])) lists[u]!.push(v);
  }
  return lists.map((l) => Int32Array.from(l));
}

// ───────────────────────── ANALYTIC-016 degree, strength, density ─────────────────────────

export interface DegreeResult {
  directed: boolean;
  /** Undirected degree, or in-degree + out-degree for a directed graph. */
  degree: Float64Array;
  inDegree: Float64Array;
  outDegree: Float64Array;
  inStrength: Float64Array;
  outStrength: Float64Array;
  /** Number of edges (undirected) or arcs (directed). */
  edgeCount: number;
  /** Fraction of possible edges that exist. */
  density: number;
  meanDegree: number;
}

export function degreeMetrics(w: Float64Array, n: number): DegreeResult {
  const directed = !isSymmetric(w, n);
  const inDegree = new Float64Array(n), outDegree = new Float64Array(n), inStrength = new Float64Array(n), outStrength = new Float64Array(n);
  let arcs = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if (i === j) continue;
    const v = w[i * n + j]!;
    if (v === 0) continue;
    inDegree[i] = inDegree[i]! + 1; outDegree[j] = outDegree[j]! + 1;
    inStrength[i] = inStrength[i]! + v; outStrength[j] = outStrength[j]! + v;
    arcs++;
  }
  const degree = directed ? Float64Array.from(inDegree, (v, i) => v + outDegree[i]!) : Float64Array.from(inDegree);
  const edgeCount = directed ? arcs : arcs / 2;
  const possible = directed ? n * (n - 1) : (n * (n - 1)) / 2;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += degree[i]!;
  return { directed, degree, inDegree, outDegree, inStrength, outStrength, edgeCount, density: possible > 0 ? edgeCount / possible : 0, meanDegree: n ? sum / n : 0 };
}

// ───────────────────────── ANALYTIC-017 clustering, betweenness, participation ─────────────────────────

export interface ClusteringResult {
  /** C_i = 2 t_i / (k_i (k_i − 1)); 0 when k_i < 2. */
  local: Float64Array;
  triangles: Float64Array;
  /** Mean of the local coefficients over all N nodes (Watts–Strogatz definition). */
  mean: number;
  /** 3 × triangles / connected triples. */
  transitivity: number;
}

/** Binary undirected clustering (EQ-082). Directed input is symmetrized first. */
export function clusteringCoefficient(w: Float64Array, n: number): ClusteringResult {
  const a = isSymmetric(w, n) ? w : symmetrize(w, n);
  const nb = outLists(a, n);
  const local = new Float64Array(n), triangles = new Float64Array(n);
  let sum = 0, triples = 0, triSum = 0;
  for (let i = 0; i < n; i++) {
    const l = nb[i]!, k = l.length;
    if (k < 2) continue;
    let t = 0;
    for (let p = 0; p < k; p++) for (let q = p + 1; q < k; q++) if (a[l[p]! * n + l[q]!] !== 0) t++;
    triangles[i] = t;
    local[i] = (2 * t) / (k * (k - 1));
    sum += local[i]!; triples += (k * (k - 1)) / 2; triSum += t;
  }
  return { local, triangles, mean: n ? sum / n : 0, transitivity: triples > 0 ? triSum / triples : 0 };
}

/**
 * All-pairs shortest path lengths d[s*n + t] from s to t (Infinity when unreachable).
 * Unweighted: hop count by breadth-first search. Weighted: Dijkstra with edge length 1 / W.
 */
export function distanceMatrix(w: Float64Array, n: number, weighted = false, alive?: Uint8Array): Float64Array {
  const d = new Float64Array(n * n).fill(Infinity);
  const nb = outLists(w, n, alive);
  if (!weighted) {
    const queue = new Int32Array(n);
    for (let s = 0; s < n; s++) {
      if (alive && !alive[s]) continue;
      const row = s * n;
      d[row + s] = 0;
      let head = 0, tail = 0;
      queue[tail++] = s;
      while (head < tail) {
        const u = queue[head++]!;
        const du = d[row + u]! + 1;
        const l = nb[u]!;
        for (let q = 0; q < l.length; q++) { const v = l[q]!; if (d[row + v] === Infinity) { d[row + v] = du; queue[tail++] = v; } }
      }
    }
    return d;
  }
  const done = new Uint8Array(n);
  for (let s = 0; s < n; s++) {
    if (alive && !alive[s]) continue;
    const row = s * n;
    done.fill(0);
    d[row + s] = 0;
    for (;;) {
      let u = -1, best = Infinity;
      for (let i = 0; i < n; i++) if (!done[i] && d[row + i]! < best) { best = d[row + i]!; u = i; }
      if (u < 0) break;
      done[u] = 1;
      const l = nb[u]!;
      for (let q = 0; q < l.length; q++) {
        const v = l[q]!;
        const alt = best + 1 / Math.abs(w[v * n + u]!);
        if (alt < d[row + v]!) d[row + v] = alt;
      }
    }
  }
  return d;
}

export interface PathResult {
  /** Mean shortest path over reachable ordered pairs i ≠ j (EQ-083). */
  charPathLength: number;
  /** Mean of 1 / d_ij over all ordered pairs i ≠ j; unreachable pairs contribute 0. */
  globalEfficiency: number;
  diameter: number;
  /** Ordered pairs with no connecting path. A non-zero value means L is computed on a disconnected graph. */
  unreachablePairs: number;
}

/** Path statistics over all nodes, or over the nodes marked alive (pairs involving a removed node are excluded). */
export function pathMetrics(dist: Float64Array, n: number, alive?: Uint8Array): PathResult {
  let sum = 0, eff = 0, reach = 0, unreachable = 0, diameter = 0, m = 0;
  for (let i = 0; i < n; i++) {
    if (alive && !alive[i]) continue;
    m++;
    for (let j = 0; j < n; j++) {
      if (i === j || (alive && !alive[j])) continue;
      const v = dist[i * n + j]!;
      if (Number.isFinite(v)) { sum += v; eff += 1 / v; reach++; if (v > diameter) diameter = v; } else unreachable++;
    }
  }
  const pairs = m * (m - 1);
  return { charPathLength: reach ? sum / reach : NaN, globalEfficiency: pairs ? eff / pairs : 0, diameter, unreachablePairs: unreachable };
}

/**
 * Node betweenness centrality by Brandes' algorithm (EQ-084), normalized by (N − 1)(N − 2) so that the centre of a
 * star graph scores 1. Weighted mode uses edge length 1 / W.
 */
export function betweennessCentrality(w: Float64Array, n: number, weighted = false, alive?: Uint8Array): Float64Array {
  const cb = new Float64Array(n);
  if (n < 3) return cb;
  const nb = outLists(w, n, alive);
  const sigma = new Float64Array(n), dist = new Float64Array(n), delta = new Float64Array(n);
  const order = new Int32Array(n), pred = new Int32Array(n * n), predCount = new Int32Array(n), queue = new Int32Array(n);
  const done = new Uint8Array(n);
  for (let s = 0; s < n; s++) {
    if (alive && !alive[s]) continue;
    sigma.fill(0); dist.fill(Infinity); delta.fill(0); predCount.fill(0);
    sigma[s] = 1; dist[s] = 0;
    let count = 0;
    if (!weighted) {
      let head = 0, tail = 0;
      queue[tail++] = s;
      while (head < tail) {
        const u = queue[head++]!;
        order[count++] = u;
        const l = nb[u]!;
        for (let q = 0; q < l.length; q++) {
          const v = l[q]!;
          if (dist[v] === Infinity) { dist[v] = dist[u]! + 1; queue[tail++] = v; }
          if (dist[v] === dist[u]! + 1) { sigma[v] = sigma[v]! + sigma[u]!; pred[v * n + predCount[v]!] = u; predCount[v] = predCount[v]! + 1; }
        }
      }
    } else {
      done.fill(0);
      for (;;) {
        let u = -1, best = Infinity;
        for (let i = 0; i < n; i++) if (!done[i] && dist[i]! < best) { best = dist[i]!; u = i; }
        if (u < 0) break;
        done[u] = 1;
        order[count++] = u;
        const l = nb[u]!;
        for (let q = 0; q < l.length; q++) {
          const v = l[q]!;
          if (done[v]) continue;
          const alt = best + 1 / Math.abs(w[v * n + u]!);
          const tol = 1e-12 * Math.max(1, alt);
          if (alt < dist[v]! - tol) { dist[v] = alt; sigma[v] = sigma[u]!; pred[v * n] = u; predCount[v] = 1; }
          else if (Math.abs(alt - dist[v]!) <= tol) { sigma[v] = sigma[v]! + sigma[u]!; pred[v * n + predCount[v]!] = u; predCount[v] = predCount[v]! + 1; }
        }
      }
    }
    for (let k = count - 1; k >= 0; k--) {
      const v = order[k]!;
      const coeff = (1 + delta[v]!) / sigma[v]!;
      for (let q = 0; q < predCount[v]!; q++) { const u = pred[v * n + q]!; delta[u] = delta[u]! + sigma[u]! * coeff; }
      if (v !== s) cb[v] = cb[v]! + delta[v]!;
    }
  }
  const norm = (n - 1) * (n - 2);
  for (let i = 0; i < n; i++) cb[i] = cb[i]! / norm;
  return cb;
}

/** Participation coefficient P_i = 1 − Σ_c (k_i(c) / k_i)²: 0 for a node confined to one module. */
export function participationCoefficient(w: Float64Array, n: number, communities: ArrayLike<number>): Float64Array {
  const a = isSymmetric(w, n) ? w : symmetrize(w, n);
  let nc = 0;
  for (let i = 0; i < n; i++) nc = Math.max(nc, communities[i]! + 1);
  const out = new Float64Array(n), per = new Float64Array(nc);
  for (let i = 0; i < n; i++) {
    per.fill(0);
    let k = 0;
    for (let j = 0; j < n; j++) { const v = i === j ? 0 : Math.abs(a[i * n + j]!); if (v !== 0) { per[communities[j]!] = per[communities[j]!]! + v; k += v; } }
    if (k === 0) continue;
    let s = 0;
    for (let c = 0; c < nc; c++) s += (per[c]! / k) ** 2;
    out[i] = 1 - s;
  }
  return out;
}

/** Local efficiency: global efficiency of the subgraph formed by each node's neighbours (binary, undirected). */
export function localEfficiency(w: Float64Array, n: number): { local: Float64Array; mean: number } {
  const a = isSymmetric(w, n) ? w : symmetrize(w, n);
  const nb = outLists(a, n);
  const local = new Float64Array(n);
  const alive = new Uint8Array(n);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const l = nb[i]!, k = l.length;
    if (k < 2) continue;
    alive.fill(0);
    for (let q = 0; q < k; q++) alive[l[q]!] = 1;
    const d = distanceMatrix(a, n, false, alive);
    let e = 0;
    for (let p = 0; p < k; p++) for (let q = 0; q < k; q++) if (p !== q) { const v = d[l[p]! * n + l[q]!]!; if (Number.isFinite(v)) e += 1 / v; }
    local[i] = e / (k * (k - 1));
    sum += local[i]!;
  }
  return { local, mean: n ? sum / n : 0 };
}

// ───────────────────────── ANALYTIC-019 modularity, communities, robustness ─────────────────────────

/** Newman–Girvan modularity (EQ-085) of a given partition on the symmetrized weighted graph. */
export function modularityQ(w: Float64Array, n: number, communities: ArrayLike<number>, gamma = 1): number {
  const a = isSymmetric(w, n) ? w : symmetrize(w, n);
  let nc = 0;
  for (let i = 0; i < n; i++) nc = Math.max(nc, communities[i]! + 1);
  const inside = new Float64Array(nc), tot = new Float64Array(nc);
  let m2 = 0;
  for (let i = 0; i < n; i++) {
    const ci = communities[i]!;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const v = Math.abs(a[i * n + j]!);
      if (v === 0) continue;
      m2 += v; tot[ci] = tot[ci]! + v;
      if (communities[j] === ci) inside[ci] = inside[ci]! + v;
    }
  }
  if (m2 === 0) return 0;
  let q = 0;
  for (let c = 0; c < nc; c++) q += inside[c]! / m2 - gamma * (tot[c]! / m2) ** 2;
  return q;
}

export interface CommunityResult { communities: Int32Array; count: number; q: number }

/**
 * Louvain community detection (greedy modularity optimization with graph aggregation). The node visiting order is
 * drawn from the seeded PRNG, so a given seed always returns the same partition.
 */
export function louvain(w: Float64Array, n: number, seed = 1, gamma = 1): CommunityResult {
  const rng = new Rng(seed ^ 0x2545f491);
  let cn = n;
  let cw = new Float64Array(n * n);
  const sym = isSymmetric(w, n) ? w : symmetrize(w, n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) cw[i * n + j] = i === j ? 0 : Math.abs(sym[i * n + j]!);
  const membership = Int32Array.from({ length: n }, (_, i) => i);
  let m2 = 0;
  for (let i = 0; i < cw.length; i++) m2 += cw[i]!;
  if (m2 === 0) return { communities: membership, count: n, q: 0 };
  for (let level = 0; level < 32; level++) {
    const comm = Int32Array.from({ length: cn }, (_, i) => i);
    const k = new Float64Array(cn), tot = new Float64Array(cn), kin = new Float64Array(cn);
    for (let i = 0; i < cn; i++) { let s = 0; for (let j = 0; j < cn; j++) s += cw[i * cn + j]!; k[i] = s; tot[i] = s; }
    const order = Int32Array.from({ length: cn }, (_, i) => i);
    for (let i = cn - 1; i > 0; i--) { const j = rng.int(i + 1); const t = order[i]!; order[i] = order[j]!; order[j] = t; }
    let improved = false;
    for (let pass = 0; pass < 100; pass++) {
      let moved = false;
      for (let o = 0; o < cn; o++) {
        const i = order[o]!, ci = comm[i]!;
        kin.fill(0);
        for (let j = 0; j < cn; j++) if (j !== i) { const v = cw[i * cn + j]!; if (v !== 0) kin[comm[j]!] = kin[comm[j]!]! + v; }
        tot[ci] = tot[ci]! - k[i]!;
        let best = ci, bestGain = kin[ci]! - (gamma * tot[ci]! * k[i]!) / m2;
        for (let j = 0; j < cn; j++) {
          if (j === i || cw[i * cn + j] === 0) continue;
          const c = comm[j]!;
          if (c === best) continue;
          const gain = kin[c]! - (gamma * tot[c]! * k[i]!) / m2;
          if (gain > bestGain + 1e-12) { best = c; bestGain = gain; }
        }
        tot[best] = tot[best]! + k[i]!;
        if (best !== ci) { comm[i] = best; moved = true; improved = true; }
      }
      if (!moved) break;
    }
    if (!improved) break;
    // Relabel communities and aggregate the graph: nodes of a community become one super-node.
    const relabel = new Int32Array(cn).fill(-1);
    let nc = 0;
    for (let i = 0; i < cn; i++) { const c = comm[i]!; if (relabel[c] === -1) relabel[c] = nc++; }
    const next = new Float64Array(nc * nc);
    for (let i = 0; i < cn; i++) {
      const a = relabel[comm[i]!]!;
      for (let j = 0; j < cn; j++) { const v = cw[i * cn + j]!; if (v !== 0) { const b = relabel[comm[j]!]!; next[a * nc + b] = next[a * nc + b]! + v; } }
    }
    for (let v = 0; v < n; v++) membership[v] = relabel[comm[membership[v]!]!]!;
    if (nc === cn) break;
    cn = nc; cw = next;
  }
  // Compact labels in order of first appearance.
  const map = new Map<number, number>();
  for (let v = 0; v < n; v++) { const c = membership[v]!; if (!map.has(c)) map.set(c, map.size); membership[v] = map.get(c)!; }
  return { communities: membership, count: map.size, q: modularityQ(w, n, membership, gamma) };
}

export interface ComponentResult { labels: Int32Array; sizes: number[]; largest: number; count: number }

/** Weakly connected components of the nodes marked alive (all nodes by default). */
export function connectedComponents(w: Float64Array, n: number, alive?: Uint8Array): ComponentResult {
  const labels = new Int32Array(n).fill(-1);
  const sizes: number[] = [];
  const stack = new Int32Array(n);
  for (let s = 0; s < n; s++) {
    if (labels[s] !== -1 || (alive && !alive[s])) continue;
    const id = sizes.length;
    let top = 0, size = 0;
    stack[top++] = s; labels[s] = id;
    while (top > 0) {
      const u = stack[--top]!;
      size++;
      for (let v = 0; v < n; v++) {
        if (labels[v] !== -1 || (alive && !alive[v]) || v === u) continue;
        if (w[u * n + v] !== 0 || w[v * n + u] !== 0) { labels[v] = id; stack[top++] = v; }
      }
    }
    sizes.push(size);
  }
  let largest = 0;
  for (const s of sizes) if (s > largest) largest = s;
  return { labels, sizes, largest, count: sizes.length };
}

/** Returns a copy of W with every edge of the listed nodes removed. */
export function removeNodes(w: Float64Array, n: number, removed: ArrayLike<number>): Float64Array {
  const out = Float64Array.from(w);
  for (let q = 0; q < removed.length; q++) {
    const r = removed[q]!;
    for (let j = 0; j < n; j++) { out[r * n + j] = 0; out[j * n + r] = 0; }
  }
  return out;
}

export type LesionStrategy = 'random' | 'degree' | 'betweenness';

/**
 * Node removal order for a lesion experiment. Targeted strategies remove the current highest-ranked node and, when
 * `adaptive` is set, recompute the ranking after every removal.
 */
export function lesionOrder(w: Float64Array, n: number, strategy: LesionStrategy, seed = 1, adaptive = true): Int32Array {
  const order = new Int32Array(n);
  if (strategy === 'random') {
    const rng = new Rng(seed ^ 0x1b873593);
    for (let i = 0; i < n; i++) order[i] = i;
    for (let i = n - 1; i > 0; i--) { const j = rng.int(i + 1); const t = order[i]!; order[i] = order[j]!; order[j] = t; }
    return order;
  }
  const a = isSymmetric(w, n) ? w : symmetrize(w, n);
  const alive = new Uint8Array(n).fill(1);
  const score = (): Float64Array => {
    if (strategy === 'betweenness') return betweennessCentrality(a, n, false, alive);
    const s = new Float64Array(n);
    for (let i = 0; i < n; i++) { if (!alive[i]) continue; let k = 0; for (let j = 0; j < n; j++) if (alive[j] && j !== i && a[i * n + j] !== 0) k += Math.abs(a[i * n + j]!); s[i] = k; }
    return s;
  };
  let sc = score();
  for (let step = 0; step < n; step++) {
    if (adaptive && step > 0) sc = score();
    let best = -1, bv = -Infinity;
    for (let i = 0; i < n; i++) if (alive[i] && sc[i]! > bv) { bv = sc[i]!; best = i; }
    order[step] = best;
    alive[best] = 0;
  }
  return order;
}

export interface LesionCurve {
  fraction: Float64Array;
  /** Largest connected component as a fraction of the original node count. */
  lcc: Float64Array;
  /** Global efficiency among the surviving nodes, relative to the intact graph. */
  efficiency: Float64Array;
}

export function lesionCurve(w: Float64Array, n: number, order: ArrayLike<number>, fractions: ArrayLike<number>, weighted = false): LesionCurve {
  const a = isSymmetric(w, n) ? w : symmetrize(w, n);
  const alive = new Uint8Array(n);
  const e0 = pathMetrics(distanceMatrix(a, n, weighted), n).globalEfficiency;
  const m = fractions.length;
  const out: LesionCurve = { fraction: Float64Array.from(fractions), lcc: new Float64Array(m), efficiency: new Float64Array(m) };
  for (let q = 0; q < m; q++) {
    const removed = Math.min(n, Math.round(fractions[q]! * n));
    alive.fill(1);
    for (let r = 0; r < removed; r++) alive[order[r]!] = 0;
    out.lcc[q] = connectedComponents(a, n, alive).largest / n;
    out.efficiency[q] = e0 > 0 ? pathMetrics(distanceMatrix(a, n, weighted, alive), n, alive).globalEfficiency / e0 : 0;
  }
  return out;
}

// ───────────────────────── ANALYTIC-018 small-worldness ─────────────────────────

/**
 * Maslov–Sneppen degree-preserving randomization of an undirected graph: repeatedly picks two edges (a–b, c–d) and
 * rewires them to (a–d, c–b) when that creates neither a self-loop nor a duplicate edge. Edge weights move with the edges.
 */
export function degreePreservingRewire(w: Float64Array, n: number, rng: Rng, swapsPerEdge = 10): Float64Array {
  const out = isSymmetric(w, n) ? Float64Array.from(w) : symmetrize(w, n);
  const ea: number[] = [], eb: number[] = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (out[i * n + j] !== 0) { ea.push(i); eb.push(j); }
  const m = ea.length;
  if (m < 2) return out;
  for (let it = 0; it < swapsPerEdge * m; it++) {
    const p = rng.int(m), q = rng.int(m);
    if (p === q) continue;
    let a = ea[p]!, b = eb[p]!;
    const c = ea[q]!, d = eb[q]!;
    if (rng.next() < 0.5) { const t = a; a = b; b = t; }
    if (a === d || c === b || a === c || b === d) continue;
    if (out[a * n + d] !== 0 || out[c * n + b] !== 0) continue;
    const wab = out[a * n + b]!, wcd = out[c * n + d]!;
    out[a * n + b] = 0; out[b * n + a] = 0; out[c * n + d] = 0; out[d * n + c] = 0;
    out[a * n + d] = wab; out[d * n + a] = wab; out[c * n + b] = wcd; out[b * n + c] = wcd;
    ea[p] = a; eb[p] = d; ea[q] = c; eb[q] = b;
  }
  return out;
}

export interface SmallWorldResult {
  clustering: number;
  pathLength: number;
  clusteringRand: number;
  pathLengthRand: number;
  /** σ_SW = (C / C_rand) / (L / L_rand); > 1 indicates small-world organization (EQ-086). */
  sigma: number;
  nullCount: number;
}

/** Small-worldness against `nullCount` Maslov–Sneppen null graphs (binary, undirected). */
export function smallWorldness(w: Float64Array, n: number, seed = 1, nullCount = 20): SmallWorldResult {
  const a = isSymmetric(w, n) ? w : symmetrize(w, n);
  const C = clusteringCoefficient(a, n).mean;
  const L = pathMetrics(distanceMatrix(a, n), n).charPathLength;
  const rng = new Rng(seed ^ 0x68bc21eb);
  let cSum = 0, lSum = 0, used = 0;
  for (let k = 0; k < nullCount; k++) {
    const r = degreePreservingRewire(a, n, rng);
    const lr = pathMetrics(distanceMatrix(r, n), n).charPathLength;
    if (!Number.isFinite(lr)) continue;
    cSum += clusteringCoefficient(r, n).mean; lSum += lr; used++;
  }
  const Cr = used ? cSum / used : NaN, Lr = used ? lSum / used : NaN;
  return { clustering: C, pathLength: L, clusteringRand: Cr, pathLengthRand: Lr, sigma: Cr > 0 && Lr > 0 && L > 0 ? C / Cr / (L / Lr) : NaN, nullCount: used };
}

/** Keeps the strongest edges of a symmetric matrix so that the requested fraction of possible edges remains. */
export function thresholdProportional(w: Float64Array, n: number, density: number): Float64Array {
  const edges: { i: number; j: number; v: number }[] = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const v = Math.max(Math.abs(w[i * n + j]!), Math.abs(w[j * n + i]!)); if (v > 0) edges.push({ i, j, v }); }
  edges.sort((p, q) => q.v - p.v);
  const keep = Math.min(edges.length, Math.round((density * n * (n - 1)) / 2));
  const out = new Float64Array(n * n);
  for (let k = 0; k < keep; k++) { const e = edges[k]!; out[e.i * n + e.j] = e.v; out[e.j * n + e.i] = e.v; }
  return out;
}

export interface GraphSummary {
  nodes: number;
  edges: number;
  density: number;
  meanDegree: number;
  clustering: number;
  pathLength: number;
  globalEfficiency: number;
  unreachablePairs: number;
  modularity: number;
  communities: number;
  maxBetweenness: number;
  hubNode: number;
}

/** One-call summary used by model kernels and the network inspector. */
export function summarizeGraph(w: Float64Array, n: number, seed = 1): GraphSummary & { betweenness: Float64Array; community: Int32Array; degree: Float64Array } {
  const a = isSymmetric(w, n) ? w : symmetrize(w, n);
  const deg = degreeMetrics(a, n);
  const path = pathMetrics(distanceMatrix(a, n), n);
  const bc = betweennessCentrality(a, n);
  const com = louvain(a, n, seed);
  let hub = 0;
  for (let i = 1; i < n; i++) if (bc[i]! > bc[hub]!) hub = i;
  return {
    nodes: n, edges: deg.edgeCount, density: deg.density, meanDegree: deg.meanDegree, clustering: clusteringCoefficient(a, n).mean,
    pathLength: path.charPathLength, globalEfficiency: path.globalEfficiency, unreachablePairs: path.unreachablePairs,
    modularity: com.q, communities: com.count, maxBetweenness: bc[hub] ?? 0, hubNode: hub, betweenness: bc, community: com.communities, degree: deg.degree,
  };
}
