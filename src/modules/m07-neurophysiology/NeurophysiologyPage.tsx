import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { TraceCanvasPlot } from '../../components/charts/TraceCanvasPlot';
import { EntityRef } from '../../components/ui/EntityRef';
import { ProvenanceBadge } from '../../components/ui/ProvenanceBadge';
import { loadRegistry } from '../../data/registry';
import type { MechanismEntity } from '../../data/types';
import { configWith } from '../../kernels/core/config';
import { getModel } from '../../kernels/models';
import { useSelectionStore } from '../../stores/selectionStore';

const AP_STAGES = [
  { id: 'MECH-001', stage: '1. Resting Potential (~−65 mV)', detail: 'K⁺ leak channels and Na⁺/K⁺-ATPase maintain polarized baseline with inward Na⁺ driving force.' },
  { id: 'MECH-002', stage: '2. Depolarization & NaV Activation', detail: 'Threshold (~−55 mV) triggers regenerative opening of fast m³ NaV gates.' },
  { id: 'MECH-002', stage: '3. Overshoot (~+35 mV) & NaV Inactivation', detail: 'Peak approaches E_Na; h gates inactivate Na⁺ current while delayed KV n⁴ gates open.' },
  { id: 'MECH-002', stage: '4. Repolarization & After-Hyperpolarization', detail: 'Persistent K⁺ efflux drives V_m toward E_K (below resting potential).' },
  { id: 'MECH-003', stage: '5. Absolute & Relative Refractory Period', detail: 'Inactivated NaV channels prevent re-excitation until h recovers and KV conductance decays.' },
];

const BANDS = [
  { band: 'Delta (δ · 0.5–4 Hz)', mechId: 'MECH-044', role: 'Slow thalamocortical / cortical up-down synchronization during NREM sleep.' },
  { band: 'Theta (θ · 4–8 Hz)', mechId: 'MECH-045', role: 'Hippocampal-entorhinal spatial navigation, sequence ordering & phase-amplitude coupling.' },
  { band: 'Alpha (α · 8–12 Hz)', mechId: 'MECH-044', role: 'Thalamocortical-reticular idling rhythm, sensory gating & visual cortex alpha.' },
  { band: 'Beta (β · 13–30 Hz)', mechId: 'MECH-046', role: 'Sensorimotor cortical-basal ganglia status quo maintenance.' },
  { band: 'Gamma (γ · 30–80 Hz)', mechId: 'MECH-043', role: 'Local Pyramidal–PV+ Interneuron Network Gamma (PING) temporal binding.' },
];

export function NeurophysiologyPage() {
  const { entityId } = useParams();
  const [mechanisms, setMechanisms] = useState<MechanismEntity[]>([]);
  const [apStage, setApStage] = useState(0);
  const [stimAmp, setStimAmp] = useState(10);
  const selectEntity = useSelectionStore((s) => s.selectEntity);

  useEffect(() => {
    loadRegistry('mechanisms').then(setMechanisms).catch(() => {});
  }, []);

  useEffect(() => {
    if (entityId) selectEntity(entityId, { openInspector: true, scale: 'L2' });
  }, [entityId, selectEntity]);

  const hhOut = useMemo(() => {
    const m = getModel('MODEL-001');
    return m.run(configWith(m, { durationMs: 60, stimulus: { kind: 'step', amplitude: stimAmp, startMs: 8, durationMs: 40 } }));
  }, [stimAmp]);

  const physioMechs = useMemo(
    () => mechanisms.filter((m) => m.primaryScale === 'L2' || m.primaryScale === 'L3' || m.primaryScale === 'L5' || m.primaryScale === 'L6'),
    [mechanisms],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <span className="cx-badge tabular" style={{ color: 'var(--accent-ice-blue)' }}>MOD-07 · NEUROPHYSIOLOGY & NEURAL DYNAMICS</span>
          <h1 style={{ margin: '4px 0 2px', fontSize: 20 }}>Membrane Biophysics, Action Potentials, Integration & Oscillations</h1>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Link to="/lab/MODEL-001" className="cx-btn cx-btn-primary">Hodgkin–Huxley Lab</Link>
          <Link to="/lab/MODEL-010" className="cx-btn">Dendritic Cable Lab</Link>
          <Link to="/lab/MODEL-018" className="cx-btn">Jansen–Rit EEG Alpha</Link>
        </div>
      </div>

      <div className="cx-grid-2">
        {/* Equivalent Circuit SVG */}
        <div className="cx-card">
          <div className="cx-card-title">
            <span>Interactive Membrane Equivalent Circuit</span>
            <ProvenanceBadge status="ESTABLISHED" />
          </div>
          <svg viewBox="0 0 420 200" style={{ width: '100%', background: '#090d16', borderRadius: 6 }} role="img" aria-label="RC Membrane Equivalent Circuit">
            {/* Top & Bottom Rails */}
            <line x1={30} y1={30} x2={390} y2={30} stroke="#38BDF8" strokeWidth={2} />
            <line x1={30} y1={170} x2={390} y2={170} stroke="#94A3B8" strokeWidth={2} />
            <text x={210} y={20} textAnchor="middle" fill="#94A3B8" fontSize={11}>Extracellular (0 mV ref)</text>
            <text x={210} y={190} textAnchor="middle" fill="#38BDF8" fontSize={11}>Intracellular V_m(t)</text>

            {/* C_m */}
            <g style={{ cursor: 'pointer' }} onClick={() => selectEntity('MECH-001')}>
              <line x1={70} y1={30} x2={70} y2={88} stroke="#CBD5E1" strokeWidth={2} />
              <line x1={52} y1={88} x2={88} y2={88} stroke="#38BDF8" strokeWidth={3} />
              <line x1={52} y1={104} x2={88} y2={104} stroke="#38BDF8" strokeWidth={3} />
              <line x1={70} y1={104} x2={70} y2={170} stroke="#CBD5E1" strokeWidth={2} />
              <rect x={48} y={122} width={44} height={20} rx={4} fill="#090d16" stroke="#334155" strokeWidth={1} />
              <text x={70} y={136} textAnchor="middle" fill="#F1F5F9" fontSize={11} fontWeight={600}>C_m</text>
            </g>

            {/* g_Na */}
            <g style={{ cursor: 'pointer' }} onClick={() => selectEntity('MOL-CH-NAV1-1')}>
              <line x1={165} y1={30} x2={165} y2={62} stroke="#CBD5E1" strokeWidth={2} />
              <rect x={148} y={62} width={34} height={42} rx={4} fill="#1e293b" stroke="#F59E0B" strokeWidth={2} />
              <text x={165} y={87} textAnchor="middle" fill="#F59E0B" fontSize={11}>g_Na</text>
              <line x1={165} y1={104} x2={165} y2={170} stroke="#CBD5E1" strokeWidth={2} />
              <rect x={139} y={131} width={52} height={19} rx={4} fill="#090d16" stroke="#F59E0B" strokeOpacity={0.5} strokeWidth={1} />
              <text x={165} y={144} textAnchor="middle" fill="#fcd34d" fontSize={10}>+50 mV</text>
            </g>

            {/* g_K */}
            <g style={{ cursor: 'pointer' }} onClick={() => selectEntity('MOL-CH-KV1-1')}>
              <line x1={260} y1={30} x2={260} y2={62} stroke="#CBD5E1" strokeWidth={2} />
              <rect x={243} y={62} width={34} height={42} rx={4} fill="#1e293b" stroke="#A855F7" strokeWidth={2} />
              <text x={260} y={87} textAnchor="middle" fill="#A855F7" fontSize={11}>g_K</text>
              <line x1={260} y1={104} x2={260} y2={170} stroke="#CBD5E1" strokeWidth={2} />
              <rect x={234} y={131} width={52} height={19} rx={4} fill="#090d16" stroke="#A855F7" strokeOpacity={0.5} strokeWidth={1} />
              <text x={260} y={144} textAnchor="middle" fill="#d8b4fe" fontSize={10}>−77 mV</text>
            </g>

            {/* g_L */}
            <g style={{ cursor: 'pointer' }} onClick={() => selectEntity('MOL-CH-K2P-LEAK')}>
              <line x1={350} y1={30} x2={350} y2={62} stroke="#CBD5E1" strokeWidth={2} />
              <rect x={333} y={62} width={34} height={42} rx={4} fill="#1e293b" stroke="#10B981" strokeWidth={2} />
              <text x={350} y={87} textAnchor="middle" fill="#10B981" fontSize={11}>g_L</text>
              <line x1={350} y1={104} x2={350} y2={170} stroke="#CBD5E1" strokeWidth={2} />
              <rect x={324} y={131} width={52} height={19} rx={4} fill="#090d16" stroke="#10B981" strokeOpacity={0.5} strokeWidth={1} />
              <text x={350} y={144} textAnchor="middle" fill="#6ee7b7" fontSize={10}>−54 mV</text>
            </g>
          </svg>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {AP_STAGES.map((st, idx) => (
              <button key={st.stage} type="button" className={`cx-btn${apStage === idx ? ' cx-btn-primary' : ''}`} style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => { setApStage(idx); selectEntity(st.id, { openInspector: false }); }}>
                {st.stage}
              </button>
            ))}
          </div>
          <div className="cx-banner cx-banner-cyan" style={{ marginTop: 8 }}>
            {AP_STAGES[apStage]!.detail} <EntityRef id={AP_STAGES[apStage]!.id} label="Inspect Mechanism" />
          </div>
        </div>

        {/* Live HH Action Potential Response */}
        <div className="cx-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="cx-card-title">
            <span>Live Hodgkin–Huxley Conductance & Voltage Dynamics</span>
            <label style={{ fontSize: 12, fontWeight: 400, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              I_stim:
              <input type="range" min={0} max={25} step={1} value={stimAmp} onChange={(e) => setStimAmp(Number(e.target.value))} />
              <span className="tabular">{stimAmp} µA/cm²</span>
            </label>
          </div>
          <TraceCanvasPlot
            title="Membrane Potential V(t)"
            x={hhOut.t}
            yLabel="mV"
            series={[{ key: 'V', label: 'V(t)', unit: 'mV', data: hhOut.series.V! }]}
            thresholdY={-55}
            height={175}
          />
          <TraceCanvasPlot
            title="Gating Variables m, h, n"
            x={hhOut.t}
            yLabel="open fraction"
            series={[
              { key: 'm', label: 'm (Na⁺ act.)', data: hhOut.series.m! },
              { key: 'h', label: 'h (Na⁺ inact.)', data: hhOut.series.h! },
              { key: 'n', label: 'n (K⁺ act.)', data: hhOut.series.n!, dashed: true },
            ]}
            height={155}
          />
        </div>
      </div>

      {/* Neural Oscillation Bands */}
      <div className="cx-card">
        <div className="cx-card-title">Neural Oscillation Bands & Dynamical Regimes</div>
        <div className="cx-grid-auto">
          {BANDS.map((b) => (
            <div key={b.band} className="cx-card" style={{ background: '#0d1422', padding: 10 }}>
              <EntityRef id={b.mechId} label={b.band} />
              <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>{b.role}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Physiological Mechanisms Catalog */}
      <div className="cx-card">
        <div className="cx-card-title">Physiological Mechanisms ({physioMechs.length})</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {physioMechs.map((m) => (
            <EntityRef key={m.id} id={m.id} label={m.canonicalName} />
          ))}
        </div>
      </div>
    </div>
  );
}
