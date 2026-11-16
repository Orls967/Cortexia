import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { HeatmapCanvas } from '../../components/charts/HeatmapCanvas';
import { EntityRef } from '../../components/ui/EntityRef';
import { ProvenanceBadge } from '../../components/ui/ProvenanceBadge';
import { loadRegistry } from '../../data/registry';
import type { CircuitEntity } from '../../data/types';
import { smallWorldness, summarizeGraph } from '../../kernels/analytics/graph';
import { generateGraph, syntheticConnectome68 } from '../../kernels/models/graphs';
import { useSelectionStore } from '../../stores/selectionStore';

const StudioDNetwork = lazy(() => import('../../studios/StudioDNetwork').then((m) => ({ default: m.StudioDNetwork })));

export function ConnectomicsPage() {
  const { entityId } = useParams();
  const [circuits, setCircuits] = useState<CircuitEntity[]>([]);
  const [layer, setLayer] = useState<'dk68' | 'smallworld' | 'scalefree'>('dk68');
  const selectEntity = useSelectionStore((s) => s.selectEntity);

  useEffect(() => {
    loadRegistry('circuits').then(setCircuits).catch(() => {});
  }, []);

  useEffect(() => {
    if (entityId) selectEntity(entityId, { openInspector: true, scale: 'L5' });
  }, [entityId, selectEntity]);

  const activeGraph = useMemo(() => {
    if (layer === 'dk68') return syntheticConnectome68(42, 0.25);
    if (layer === 'smallworld') return generateGraph(2, 48, 42);
    return generateGraph(4, 48, 42);
  }, [layer]);

  const metrics = useMemo(() => {
    const s = summarizeGraph(activeGraph.weights, activeGraph.n, 1);
    const sw = smallWorldness(activeGraph.weights, activeGraph.n, 1, 8);
    return { ...s, sigma: sw.sigma };
  }, [activeGraph]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <span className="cx-badge tabular" style={{ color: 'var(--accent-ice-blue)' }}>MOD-06 · NEURAL CIRCUITS & CONNECTOMICS</span>
          <h1 style={{ margin: '4px 0 2px', fontSize: 20 }}>Microcircuits, Structural/Functional Graphs & Connectome Topology</h1>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <ProvenanceBadge status="SYNTHETIC_TOPOLOGY" text="Synthetic Topology (Distinguished from Empirical SC)" />
          <Link to="/lab/MODEL-028" className="cx-btn cx-btn-primary">Open MODEL-028 Lab</Link>
        </div>
      </div>

      <div className="cx-banner cx-banner-amber">
        <strong>Provenance Distinction:</strong> In-browser 3D graphs and matrices below are <strong>synthetic simulation topologies</strong> (<code>SYNTHETIC_TOPOLOGY</code>); empirical human tractography or individual fMRI/EEG functional connectivity is never fabricated.
      </div>

      {/* Graph Topology Layer Selector */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button type="button" className={`cx-btn${layer === 'dk68' ? ' cx-btn-primary' : ''}`} onClick={() => setLayer('dk68')}>
          68-Region DK Synthetic Connectome (L8)
        </button>
        <button type="button" className={`cx-btn${layer === 'smallworld' ? ' cx-btn-primary' : ''}`} onClick={() => setLayer('smallworld')}>
          Watts–Strogatz Small-World (N=48)
        </button>
        <button type="button" className={`cx-btn${layer === 'scalefree' ? ' cx-btn-primary' : ''}`} onClick={() => setLayer('scalefree')}>
          Barabási–Albert Scale-Free Hubs (N=48)
        </button>
      </div>

      {/* Graph Metrics Row */}
      <div className="cx-grid-auto">
        {[
          ['Nodes / Edges', `${metrics.nodes} / ${metrics.edges}`],
          ['Density', metrics.density.toFixed(3)],
          ['Mean Clustering C', metrics.clustering.toFixed(3)],
          ['Path Length L', metrics.pathLength.toFixed(3)],
          ['Global Efficiency', metrics.globalEfficiency.toFixed(3)],
          ['Modularity Q (Louvain)', `${metrics.modularity.toFixed(3)} (${metrics.communities} mod)`],
          ['Small-World σ', Number.isFinite(metrics.sigma) ? metrics.sigma.toFixed(2) : '—'],
        ].map(([k, v]) => (
          <div key={String(k)} className="cx-card" style={{ padding: 10 }}>
            <div className="tabular" style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent-ice-blue)' }}>{v}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{k}</div>
          </div>
        ))}
      </div>

      <div className="cx-grid-2">
        <Suspense fallback={<div className="cx-banner">Loading Studio D Network…</div>}>
          <StudioDNetwork mode="connectome68" height={380} />
        </Suspense>
        <HeatmapCanvas
          title={`Adjacency Matrix (${activeGraph.n}×${activeGraph.n})`}
          rows={activeGraph.n}
          cols={activeGraph.n}
          data={activeGraph.weights}
          xLabel="Source Node"
          yLabel="Target Node"
          {...(activeGraph.labels ? { rowLabels: activeGraph.labels, colLabels: activeGraph.labels } : {})}
          height={380}
        />
      </div>

      {/* Circuits & Pathways Registry */}
      <div className="cx-card">
        <div className="cx-card-title">Canonical Neural Circuits & Pathways ({circuits.length})</div>
        <div className="cx-grid-auto">
          {circuits.map((c) => (
            <div key={c.id} className="cx-card" style={{ background: '#0d1422', padding: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                <EntityRef id={c.id} label={c.canonicalName} />
              </div>
              <ProvenanceBadge status={c.connectivityProvenance} />
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.functionalSummary}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {c.orderedNodeIds.slice(0, 6).map((nid) => <EntityRef key={nid} id={nid} />)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
