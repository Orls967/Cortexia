// VAL-GRAPH-001: graph metrics against canonical toy graphs with exact theoretical values (NETWORK_MODELS §3, AC-MOD-009).
import { describe, expect, it } from 'vitest';
import {
  betweennessCentrality, clusteringCoefficient, connectedComponents, degreeMetrics, degreePreservingRewire, distanceMatrix,
  lesionCurve, lesionOrder, localEfficiency, louvain, modularityQ, participationCoefficient, pathMetrics, smallWorldness,
} from '../../src/kernels/analytics/graph';
import { Rng } from '../../src/kernels/core/prng';
import { completeGraph, ringLattice, starGraph, twoCliques, wattsStrogatz } from '../../src/kernels/models/graphs';

const path5 = () => {
  const n = 5, w = new Float64Array(n * n);
  for (let i = 0; i + 1 < n; i++) { w[i * n + i + 1] = 1; w[(i + 1) * n + i] = 1; }
  return w;
};

describe('VAL-GRAPH-001 complete graph K10', () => {
  const n = 10, w = completeGraph(n);
  it('has clustering 1, path length 1 and efficiency 1', () => {
    expect(clusteringCoefficient(w, n).mean).toBe(1);
    const p = pathMetrics(distanceMatrix(w, n), n);
    expect(p.charPathLength).toBe(1);
    expect(p.globalEfficiency).toBe(1);
    expect(p.unreachablePairs).toBe(0);
  });
  it('has density 1, degree 9 and zero betweenness', () => {
    const d = degreeMetrics(w, n);
    expect(d.directed).toBe(false);
    expect(d.density).toBe(1);
    expect(d.edgeCount).toBe(45);
    expect(Array.from(d.degree)).toEqual(Array(10).fill(9));
    expect(Math.max(...betweennessCentrality(w, n))).toBe(0);
  });
});

describe('VAL-GRAPH-001 ring lattice R(10,4)', () => {
  const n = 10, w = ringLattice(n, 4);
  it('matches the closed-form clustering 3(k-2)/(4(k-1)) = 0.5', () => {
    const c = clusteringCoefficient(w, n);
    for (const v of c.local) expect(v).toBeCloseTo(0.5, 12);
    expect(c.mean).toBeCloseTo(0.5, 12);
  });
  it('matches the exact path length 15/9 and efficiency 19/27', () => {
    const p = pathMetrics(distanceMatrix(w, n), n);
    expect(p.charPathLength).toBeCloseTo(15 / 9, 12);
    expect(p.globalEfficiency).toBeCloseTo((4 + 2 + 1 / 3) / 9, 12);
    expect(p.diameter).toBe(3);
  });
  it('gives every node betweenness 1/12', () => {
    for (const b of betweennessCentrality(w, n)) expect(b).toBeCloseTo(1 / 12, 12);
  });
});

describe('VAL-GRAPH-001 two-clique modular graph', () => {
  const n = 10, w = twoCliques(n);
  const truth = Int32Array.from({ length: n }, (_, i) => (i < 5 ? 0 : 1));
  it('has modularity 2(10/21 - 1/4) = 0.45238 for the planted partition', () => {
    expect(modularityQ(w, n, truth)).toBeCloseTo(2 * (10 / 21 - 0.25), 12);
    expect(modularityQ(w, n, truth)).toBeGreaterThan(0.35);
  });
  it('is recovered exactly by Louvain for every seed tried', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const r = louvain(w, n, seed);
      expect(r.count).toBe(2);
      expect(r.q).toBeCloseTo(2 * (10 / 21 - 0.25), 12);
      for (let i = 0; i < n; i++) expect(r.communities[i] === r.communities[0]).toBe(i < 5);
    }
  });
  it('gives the two bridge nodes the highest betweenness and non-zero participation', () => {
    const b = betweennessCentrality(w, n);
    expect(b[4]).toBeCloseTo(5 / 9, 12); // 4 x 5 cross pairs (bridge node excluded as endpoint) x 2 directions / 72
    expect(b[5]).toBeCloseTo(b[4]!, 12);
    expect(b[0]).toBe(0);
    const p = participationCoefficient(w, n, truth);
    expect(p[4]).toBeCloseTo(1 - (4 / 5) ** 2 - (1 / 5) ** 2, 12);
    expect(p[0]).toBe(0);
  });
});

describe('other canonical graphs', () => {
  it('star graph: centre betweenness 1, clustering 0, L = 1.8', () => {
    const n = 10, w = starGraph(n);
    const b = betweennessCentrality(w, n);
    expect(b[0]).toBeCloseTo(1, 12);
    expect(b[1]).toBe(0);
    expect(clusteringCoefficient(w, n).mean).toBe(0);
    expect(pathMetrics(distanceMatrix(w, n), n).charPathLength).toBeCloseTo(1.8, 12);
  });
  it('path graph: exact betweenness 0, 1/2, 2/3, 1/2, 0', () => {
    const b = betweennessCentrality(path5(), 5);
    expect(Array.from(b).map((v) => +v.toFixed(10))).toEqual([0, 0.5, +(2 / 3).toFixed(10), 0.5, 0]);
  });
  it('weighted shortest paths use length 1/W', () => {
    const n = 3, w = new Float64Array(9);
    const set = (i: number, j: number, v: number) => { w[i * n + j] = v; w[j * n + i] = v; };
    set(0, 1, 1); set(1, 2, 1); set(0, 2, 0.25);
    const d = distanceMatrix(w, n, true);
    expect(d[0 * n + 2]).toBe(2); // via node 1, not the direct edge of length 4
    expect(betweennessCentrality(w, n, true)[1]).toBeCloseTo(1, 12);
    expect(betweennessCentrality(w, n, false)[1]).toBe(0);
  });
  it('directed graphs report in/out strength from rows/columns', () => {
    const n = 3, w = new Float64Array(9);
    w[1 * n + 0] = 2; // edge 0 -> 1 with weight 2
    w[2 * n + 1] = 3; // edge 1 -> 2 with weight 3
    const d = degreeMetrics(w, n);
    expect(d.directed).toBe(true);
    expect(Array.from(d.inStrength)).toEqual([0, 2, 3]);
    expect(Array.from(d.outStrength)).toEqual([2, 3, 0]);
    expect(d.density).toBeCloseTo(2 / 6, 12);
    const dist = distanceMatrix(w, n);
    expect(dist[0 * n + 2]).toBe(2);
    expect(dist[2 * n + 0]).toBe(Infinity);
  });
  it('local efficiency is 1 on a complete graph and 0 on a star', () => {
    expect(localEfficiency(completeGraph(6), 6).mean).toBeCloseTo(1, 12);
    expect(localEfficiency(starGraph(6), 6).mean).toBe(0);
  });
});

describe('null models, small-worldness and robustness', () => {
  it('Maslov-Sneppen rewiring preserves every node degree and the edge count', () => {
    const n = 40, w = wattsStrogatz(n, 6, 0.1, new Rng(7));
    const r = degreePreservingRewire(w, n, new Rng(11));
    expect(Array.from(degreeMetrics(r, n).degree)).toEqual(Array.from(degreeMetrics(w, n).degree));
    let changed = 0;
    for (let i = 0; i < w.length; i++) if ((w[i] !== 0) !== (r[i] !== 0)) changed++;
    expect(changed).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) expect(r[i * n + i]).toBe(0);
  });
  it('a Watts-Strogatz graph is small-world (sigma > 1) and its null model is not', () => {
    const n = 100, w = wattsStrogatz(n, 6, 0.1, new Rng(3));
    const sw = smallWorldness(w, n, 1, 20);
    expect(sw.nullCount).toBeGreaterThan(10);
    expect(sw.clustering).toBeGreaterThan(3 * sw.clusteringRand);
    expect(sw.sigma).toBeGreaterThan(2);
  });
  it('targeted hub removal destroys a star graph; random removal is reproducible', () => {
    const n = 20, w = starGraph(n);
    const targeted = lesionOrder(w, n, 'degree');
    expect(targeted[0]).toBe(0);
    const c = lesionCurve(w, n, targeted, [0, 0.05, 0.5]);
    expect(c.lcc[0]).toBe(1);
    expect(c.efficiency[0]).toBe(1);
    expect(c.lcc[1]).toBeCloseTo(1 / n, 12);
    expect(c.efficiency[1]).toBe(0);
    expect(Array.from(lesionOrder(w, n, 'random', 5))).toEqual(Array.from(lesionOrder(w, n, 'random', 5)));
    expect(lesionOrder(w, n, 'betweenness')[0]).toBe(0);
  });
  it('connected components count isolated nodes', () => {
    const n = 6, w = new Float64Array(36);
    w[0 * n + 1] = 1; w[1 * n + 0] = 1; w[2 * n + 3] = 1; w[3 * n + 2] = 1; w[3 * n + 4] = 1; w[4 * n + 3] = 1;
    const c = connectedComponents(w, n);
    expect(c.count).toBe(3);
    expect(c.largest).toBe(3);
  });
});
