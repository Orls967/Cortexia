import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CurvePlot } from '../../components/charts/CurvePlot';
import { EntityRef } from '../../components/ui/EntityRef';
import { ProvenanceBadge } from '../../components/ui/ProvenanceBadge';
import { loadRegistry } from '../../data/registry';
import type { MechanismEntity } from '../../data/types';
import { configWith } from '../../kernels/core/config';
import { getModel } from '../../kernels/models';
import { useSelectionStore } from '../../stores/selectionStore';

const StudioCSynaptic = lazy(() => import('../../studios/StudioCSynaptic').then((m) => ({ default: m.StudioCSynaptic })));

export function SynapticPage() {
  const { entityId } = useParams();
  const [mechanisms, setMechanisms] = useState<MechanismEntity[]>([]);
  const [aPlus, setAPlus] = useState(0.01);
  const [aMinus, setAMinus] = useState(0.0105);
  const selectEntity = useSelectionStore((s) => s.selectEntity);

  useEffect(() => {
    loadRegistry('mechanisms').then(setMechanisms).catch(() => {});
  }, []);

  useEffect(() => {
    if (entityId) selectEntity(entityId, { openInspector: true, scale: 'L4' });
  }, [entityId, selectEntity]);

  const synapticMechs = useMemo(
    () => mechanisms.filter((m) => m.primaryScale === 'L4' || m.mechanismDomain.includes('SYNAPTIC') || m.mechanismDomain.includes('PLASTICITY')),
    [mechanisms],
  );

  // Live STDP window curve directly computed by MODEL-024
  const stdpWindow = useMemo(() => {
    const m = getModel('MODEL-024');
    const out = m.run(configWith(m, { params: { A_plus: aPlus, A_minus: aMinus } }));
    return out.curves.stdp_window ?? { x: new Float64Array(0), y: new Float64Array(0) };
  }, [aPlus, aMinus]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <span className="cx-badge tabular" style={{ color: 'var(--accent-ice-blue)' }}>MOD-05 · SYNAPTIC ARCHITECTURE & PLASTICITY</span>
          <h1 style={{ margin: '4px 0 2px', fontSize: 20 }}>Chemical & Electrical Synapses, Short-Term Plasticity, LTP/LTD & STDP</h1>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Link to="/lab/MODEL-016" className="cx-btn cx-btn-primary">Run Tsodyks–Markram STP</Link>
          <Link to="/lab/MODEL-024" className="cx-btn cx-btn-primary">Run Pair-Based STDP</Link>
        </div>
      </div>

      <Suspense fallback={<div className="cx-banner">Loading Studio C Synaptic Scene…</div>}>
        <StudioCSynaptic initialMode="chemical" height={410} />
      </Suspense>

      <div className="cx-grid-2">
        <div className="cx-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="cx-card-title">
            <span>Interactive Pair-Based STDP Window (MODEL-024)</span>
            <ProvenanceBadge status="THEORETICAL_MODEL" />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <span style={{ width: 90 }}>A₊ (LTP):</span>
            <input type="range" min={0.002} max={0.03} step={0.001} value={aPlus} onChange={(e) => setAPlus(Number(e.target.value))} style={{ flex: 1 }} />
            <span className="tabular">{aPlus.toFixed(3)}</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <span style={{ width: 90 }}>A₋ (LTD):</span>
            <input type="range" min={0.002} max={0.03} step={0.001} value={aMinus} onChange={(e) => setAMinus(Number(e.target.value))} style={{ flex: 1 }} />
            <span className="tabular">{aMinus.toFixed(3)}</span>
          </label>
          <CurvePlot
            title="Δw(Δt) STDP Window"
            xLabel="Δt = t_post − t_pre (ms)"
            yLabel="Δw / w_max"
            curves={[{ key: 'stdp', label: 'STDP Window', curve: stdpWindow }]}
            height={200}
          />
        </div>

        <div className="cx-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="cx-card-title">Synaptic & Plasticity Mechanisms Across Timescales ({synapticMechs.length})</div>
          <div style={{ maxHeight: 310, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {synapticMechs.map((m) => (
              <div key={m.id} style={{ background: '#0d1422', padding: 8, borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                  <EntityRef id={m.id} label={m.canonicalName} />
                  <span className="cx-badge tabular" style={{ fontSize: 10 }}>{m.timescaleRange}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{m.shortDefinition}</div>
                {m.associatedModelIds.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {m.associatedModelIds.map((mid) => (
                      <Link key={mid} to={`/lab/${mid}`} className="cx-btn" style={{ padding: '2px 7px', fontSize: 10 }}>
                        Sim: {mid}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
