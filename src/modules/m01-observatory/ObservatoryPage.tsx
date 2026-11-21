import { lazy, Suspense, useEffect, useState } from 'react';
import { GUIDED_PATH } from '../../data/learningPath';
import { Link } from 'react-router-dom';
import { EntityRef } from '../../components/ui/EntityRef';
import { ProvenanceBadge } from '../../components/ui/ProvenanceBadge';
import { loadManifest, loadRegistry, type Manifest } from '../../data/registry';
import { SCALES, SCALE_INFO, type SystemEntity } from '../../data/types';
import { useSelectionStore } from '../../stores/selectionStore';

const StudioABrain = lazy(() => import('../../studios/StudioABrain').then((m) => ({ default: m.StudioABrain })));

const MODULE_CARDS = [
  { id: 'MOD-01', title: 'CORTEXIA Observatory', scale: 'L1–L9', to: '/explore/observatory', summary: 'Multi-scale command overview, 9-scale navigator & system discovery.' },
  { id: 'MOD-02', title: 'Neuroanatomy Atlas', scale: 'L6–L7', to: '/explore/anatomy', summary: 'Interactive 3D Studio A, TNA hierarchy, MNI slicing & tract connections.' },
  { id: 'MOD-03', title: 'Cellular Neuroscience', scale: 'L2–L3', to: '/explore/cellular', summary: 'Studio B neuron & glia morphologies, saltatory conduction & cell comparison.' },
  { id: 'MOD-04', title: 'Molecular & Neurochemical', scale: 'L1–L2', to: '/explore/molecular', summary: 'Ion channels, receptors, Nernst/GHK calculator & 8 neurotransmitter systems.' },
  { id: 'MOD-05', title: 'Synaptic & Plasticity', scale: 'L4', to: '/explore/synapses', summary: 'Studio C cleft mechanics, STF/STD, LTP/LTD, STDP & homeostatic scaling.' },
  { id: 'MOD-06', title: 'Circuits & Connectomics', scale: 'L5, L8', to: '/explore/circuits', summary: 'Studio D 3D graphs, adjacency matrices, small-world & provenance controls.' },
  { id: 'MOD-07', title: 'Neurophysiology & Dynamics', scale: 'L2–L6', to: '/explore/physiology', summary: 'Equivalent RC circuit, AP phase dynamics & oscillatory rhythm explorer.' },
  { id: 'MOD-08', title: 'Computational Lab (28 Models)', scale: 'L1–L8', to: '/lab', summary: '5-panel ODE/SNN simulator, sweeps, sensitivity, validation & Digital Twin.' },
  { id: 'MOD-09', title: 'Systems Neuroscience', scale: 'L7–L9', to: '/explore/systems', summary: '12 sensory, motor, autonomic, sleep & reward functional pathway maps.' },
  { id: 'MOD-10', title: 'Cognitive Neuroscience', scale: 'L8–L9', to: '/explore/cognition', summary: 'Distributed memory, attention, decision, language & consciousness frameworks.' },
  { id: 'MOD-11', title: 'Neural Signal Analytics', scale: 'L3–L8', to: '/analytics/signals', summary: 'Butterworth/FIR, Welch PSD, STFT, Morlet, ERP, spikes, graphs & CSV import.' },
  { id: 'MOD-12', title: 'Knowledge & Research Library', scale: 'L1–L9', to: '/knowledge', summary: '774-node Knowledge Graph, 616 UCES encyclopedia pages, equations & refs.' },
];

export function ObservatoryPage() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [systems, setSystems] = useState<SystemEntity[]>([]);
  const [show3D, setShow3D] = useState(true);
  const [kernelCount, setKernelCount] = useState<number | null>(null);
  const activeScale = useSelectionStore((s) => s.activeScale);
  const setActiveScale = useSelectionStore((s) => s.setActiveScale);
  const recentEntityIds = useSelectionStore((s) => s.recentEntityIds);

  useEffect(() => {
    loadManifest().then(setManifest).catch(() => {});
    loadRegistry('systems').then(setSystems).catch(() => {});
    // The kernel catalog is counted after first paint so the model code does not delay the landing page.
    import('../../kernels/models').then((m) => setKernelCount(m.MODELS.length)).catch(() => {});
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Hero Observatory Header */}
      <section className="cx-card" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 14 }}>
        <div style={{ maxWidth: 900 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
            <span className="cx-badge tabular" style={{ color: 'var(--accent-ice-blue)', borderColor: 'rgba(56,189,248,0.45)' }}>
              MOD-01 · OBSERVATORY
            </span>
            <ProvenanceBadge status="ESTABLISHED" text="Scientific & Educational Platform" />
          </div>
          <h1 style={{ margin: '0 0 6px', fontSize: 22 }}>CORTEXIA — Multi-Scale Brain & Computational Neuroscience Observatory</h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13 }}>
            Explore the nervous system seamlessly from molecular ion channels (0.1 nm) to systems cognition, execute 28 deterministic mathematical models in Web Workers, and inspect every scientific element through the Universal Contextual Explanation System.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link to="/lab/MODEL-001" className="cx-btn cx-btn-primary">Start: simulate a neuron (Hodgkin–Huxley)</Link>
                    <Link to="/explore/anatomy" className="cx-btn">Or explore the brain in 3D</Link>
        </div>
      </section>

      {/* The main route through the platform */}
      <section className="cx-card" aria-labelledby="start-here">
        <div className="cx-card-title"><span id="start-here">Start here: a guided route in {GUIDED_PATH.length} steps</span><span className="cx-badge">Follow in order, or jump anywhere</span></div>
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 8 }} className="cx-steps">
          {GUIDED_PATH.map((st, i) => (
            <li key={st.to}>
              <Link to={st.to} className="cx-card" style={{ display: 'block', height: '100%', padding: 10, textDecoration: 'none', color: 'inherit', borderColor: i === 3 ? 'var(--accent-indicator-amber)' : undefined }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span className="cx-badge tabular" aria-hidden="true">{i + 1}</span>
                  <strong style={{ fontSize: 13 }}>{st.title}</strong>
                </div>
                {i === 3 && <span className="cx-badge" style={{ color: '#fde68a', marginBottom: 6, display: 'inline-block' }}>MAIN MODEL</span>}
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{st.why}</div>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {/* Platform Live Registry Telemetry */}
      {manifest && (
        <section className="cx-kpi-grid" aria-label="Registry Statistics">
          {[
            { label: 'Scientific Entities Indexed', value: manifest.counts.indexEntities },
            { label: 'UCES Complete Articles', value: manifest.counts.explanations },
            { label: 'Knowledge Graph Edges', value: manifest.counts.kgEdges },
            { label: 'Model Kernels / Registry Models', value: `${kernelCount ?? '…'} / ${manifest?.counts.models ?? '…'}` },
            { label: 'Executable Validation Cases', value: manifest.counts.validationCases },
          ].map((stat) => (
            <div key={stat.label} className="cx-card" style={{ padding: 12 }}>
              <div className="tabular" style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent-ice-blue)' }}>{stat.value}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{stat.label}</div>
            </div>
          ))}
        </section>
      )}

      {/* 9-Scale Concentric Navigator + 3D Whole Brain Preview */}
      <section className="cx-grid-2">
        <div className="cx-col">
        <div className="cx-card">
          <div className="cx-card-title">
            <span>Nine Biological Scales Navigator (L1–L9)</span>
            <span className="cx-badge tabular">{activeScale}: {SCALE_INFO[activeScale].name}</span>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
            <svg viewBox="0 0 220 220" style={{ width: 200, height: 200, flexShrink: 0 }} role="img" aria-label="Nine biological scales concentric navigator">
              {[...SCALES].reverse().map((sc, idx) => {
                const r = 100 - idx * 9.5;
                const active = sc === activeScale;
                return (
                  <g key={sc} style={{ cursor: 'pointer' }} onClick={() => setActiveScale(sc)}>
                    <circle
                      cx={110}
                      cy={110}
                      r={r}
                      fill={active ? 'rgba(56, 189, 248, 0.2)' : 'rgba(15, 23, 42, 0.55)'}
                      stroke={active ? '#38BDF8' : '#334155'}
                      strokeWidth={active ? 2 : 1}
                    />
                  </g>
                );
              })}
              <text x={110} y={108} textAnchor="middle" fill="#F1F5F9" fontSize={14} fontWeight={700}>{activeScale}</text>
              <text x={110} y={124} textAnchor="middle" fill="#38BDF8" fontSize={9}>{SCALE_INFO[activeScale].name}</text>
            </svg>

            <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {SCALES.map((sc) => (
                  <button
                    key={sc}
                    type="button"
                    className={`cx-btn${activeScale === sc ? ' cx-btn-primary' : ''}`}
                    style={{ padding: '3px 7px', fontSize: 11 }}
                    onClick={() => setActiveScale(sc)}
                  >
                    {sc}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{SCALE_INFO[activeScale].name}</div>
              <div className="tabular" style={{ fontSize: 11, color: 'var(--accent-neural-cyan)' }}>
                Spatial: {SCALE_INFO[activeScale].span} · Temporal: {SCALE_INFO[activeScale].time}
              </div>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>{SCALE_INFO[activeScale].scope}</p>
            </div>
          </div>
        </div>

        <div className="cx-card">
          <div className="cx-card-title">Featured Computational Models & Digital Twin</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {['MODEL-001', 'MODEL-008', 'MODEL-009', 'MODEL-016', 'MODEL-017', 'MODEL-018', 'MODEL-021', 'MODEL-024', 'MODEL-027', 'MODEL-028'].map((mid) => (
              <Link key={mid} to={`/lab/${mid}`} className="cx-btn">
                {mid}
              </Link>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            <Link to="/lab/digital-twin/EXP-040" className="cx-btn cx-btn-primary">Twin Exp A (Excitability → PING)</Link>
            <Link to="/lab/digital-twin/EXP-041" className="cx-btn cx-btn-primary">Twin Exp B (STDP → Recall)</Link>
            <Link to="/lab/digital-twin/EXP-042" className="cx-btn cx-btn-primary">Twin Exp C (Connectome PLV)</Link>
          </div>
        </div>

        <div className="cx-card">
          <div className="cx-card-title">Recently Inspected & Functional Systems</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Recently Inspected (Click to open UCES Inspector):</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
            {recentEntityIds.map((id) => <EntityRef key={id} id={id} />)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Functional Systems ({systems.length}):</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {systems.slice(0, 8).map((sys) => <EntityRef key={sys.id} id={sys.id} label={sys.canonicalName} />)}
          </div>
        </div>
        </div>

        <div className="cx-card">
          <div className="cx-card-title">
            <span>Interactive Whole-Brain Overview (Studio A)</span>
            <button type="button" className="cx-btn" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => setShow3D((s) => !s)}>
              {show3D ? 'Hide 3D' : 'Show 3D'}
            </button>
          </div>
          {show3D ? (
            <Suspense fallback={<div className="cx-banner">Loading 3D Brain Studio…</div>}>
              <StudioABrain height={590} compact />
            </Suspense>
          ) : (
            <div className="cx-banner">3D preview minimized. <Link to="/explore/anatomy">Open full Neuroanatomy Studio A →</Link></div>
          )}
        </div>
      </section>

      {/* All 12 Modules Discovery Grid */}
      <section>
        <h2 style={{ fontSize: 16, margin: '0 0 10px' }}>All Twelve CORTEXIA Modules (MOD-01 – MOD-12)</h2>
        <div className="cx-grid-auto">
          {MODULE_CARDS.map((m) => (
            <Link key={m.id} to={m.to} className="cx-card" style={{ display: 'flex', flexDirection: 'column', gap: 6, color: 'inherit', textDecoration: 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="cx-badge tabular" style={{ color: 'var(--accent-ice-blue)' }}>{m.id}</span>
                <span className="cx-badge tabular" style={{ fontSize: 10 }}>{m.scale}</span>
              </div>
              <strong style={{ fontSize: 14 }}>{m.title}</strong>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{m.summary}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
