import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { EntityRef } from '../../components/ui/EntityRef';
import { MathFormula } from '../../components/ui/MathFormula';
import { ProvenanceBadge } from '../../components/ui/ProvenanceBadge';
import { loadRegistry } from '../../data/registry';
import type { MolecularEntity } from '../../data/types';
import { useSelectionStore } from '../../stores/selectionStore';

const StudioCSynaptic = lazy(() => import('../../studios/StudioCSynaptic').then((m) => ({ default: m.StudioCSynaptic })));

const NT_SYSTEMS = [
  { id: 'MOL-NT-GLUTAMATE', name: 'Glutamate', role: 'Primary fast excitatory transmitter', receptors: ['MOL-REC-AMPAR', 'MOL-REC-NMDAR', 'MOL-REC-KAINATE', 'MOL-REC-MGLUR1-5'], clearance: 'MOL-TRANS-EAAT2' },
  { id: 'MOL-NT-GABA', name: 'GABA', role: 'Primary fast & slow inhibitory transmitter', receptors: ['MOL-REC-GABAA', 'MOL-REC-GABAB'], clearance: 'MOL-TRANS-GAT1' },
  { id: 'MOL-NT-DOPAMINE', name: 'Dopamine', role: 'Reward prediction error, motor & executive gain', receptors: ['MOL-REC-DRD1', 'MOL-REC-DRD2'], clearance: 'MOL-TRANS-MONOAMINE' },
  { id: 'MOL-NT-SEROTONIN', name: 'Serotonin (5-HT)', role: 'Affective, arousal & sensory gain modulation', receptors: ['MOL-REC-5HT1A-2A', 'MOL-REC-5HT3'], clearance: 'MOL-TRANS-MONOAMINE' },
  { id: 'MOL-NT-ACETYLCHOLINE', name: 'Acetylcholine (ACh)', role: 'Attention, cortical plasticity & neuromuscular junction', receptors: ['MOL-REC-NACHR-A7', 'MOL-REC-MUSCARINIC-M1'], clearance: 'MOL-VES-ACHE' },
  { id: 'MOL-NT-NOREPINEPHRINE', name: 'Norepinephrine', role: 'LC arousal, vigilance & signal-to-noise modulation', receptors: ['MOL-REC-ADRENERGIC-B1'], clearance: 'MOL-TRANS-MONOAMINE' },
  { id: 'MOL-NT-HISTAMINE', name: 'Histamine', role: 'Tuberomammillary wakefulness stabilization', receptors: ['MOL-REC-MOR-OREXIN'], clearance: 'MOL-TRANS-MONOAMINE' },
  { id: 'MOL-PEP-ENDORPHIN-ENK', name: 'Neuropeptides (Orexin / Opioids / BDNF)', role: 'Slow neuromodulation, nociception & trophic plasticity', receptors: ['MOL-PEP-OREXIN', 'MOL-PEP-BDNF'], clearance: 'MOL-VES-SNARE' },
];

export function MolecularPage() {
  const { entityId } = useParams();
  const [molecules, setMolecules] = useState<MolecularEntity[]>([]);
  const [tab, setTab] = useState<'catalog' | 'nernst' | 'transmitters' | 'studio'>('catalog');
  const [category, setCategory] = useState('ALL');
  const [query, setQuery] = useState('');

  // Interactive Nernst / GHK parameters
  const [tempC, setTempC] = useState(37);
  const [kIn, setKIn] = useState(140);
  const [kOut, setKOut] = useState(4.0);
  const [naIn, setNaIn] = useState(12);
  const [naOut, setNaOut] = useState(145);
  const [clIn, setClIn] = useState(8);
  const [clOut, setClOut] = useState(120);
  const [caIn, setCaIn] = useState(0.0001);
  const [caOut, setCaOut] = useState(1.5);
  const [pNaRel, setPNaRel] = useState(0.04);
  const [pClRel, setPClRel] = useState(0.45);

  const selectEntity = useSelectionStore((s) => s.selectEntity);

  useEffect(() => {
    loadRegistry('molecules').then(setMolecules).catch(() => {});
  }, []);

  useEffect(() => {
    if (entityId) selectEntity(entityId, { openInspector: true, scale: 'L1' });
  }, [entityId, selectEntity]);

  const categories = useMemo(() => ['ALL', ...new Set(molecules.map((m) => m.molecularCategory))], [molecules]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return molecules.filter((m) => {
      if (category !== 'ALL' && m.molecularCategory !== category) return false;
      if (!q) return true;
      return m.canonicalName.toLowerCase().includes(q) || m.id.toLowerCase().includes(q) || m.geneOrSubunitSymbols.some((g) => g.toLowerCase().includes(q));
    });
  }, [molecules, category, query]);

  // Nernst & GHK calculations (RT/F in mV)
  const rtfMv = (8.31446 * (tempC + 273.15) / 96485.33) * 1000;
  const eK = rtfMv * Math.log(kOut / kIn);
  const eNa = rtfMv * Math.log(naOut / naIn);
  const eCl = -rtfMv * Math.log(clOut / clIn);
  const eCa = (rtfMv / 2) * Math.log(caOut / caIn);
  const ghkNum = 1 * kOut + pNaRel * naOut + pClRel * clIn;
  const ghkDen = 1 * kIn + pNaRel * naIn + pClRel * clOut;
  const vGhk = rtfMv * Math.log(ghkNum / ghkDen);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <span className="cx-badge tabular" style={{ color: 'var(--accent-ice-blue)' }}>MOD-04 · MOLECULAR & NEUROCHEMICAL SYSTEMS</span>
          <h1 style={{ margin: '4px 0 2px', fontSize: 20 }}>Ion Channels, Receptors, Equilibrium Potentials & Transmitters</h1>
        </div>
        <ProvenanceBadge status="ESTABLISHED" text="Non-Clinical Mechanistic Biophysics" />
      </div>

      <div className="cx-banner cx-banner-amber">
        <strong>Educational Scope Notice:</strong> Molecular mechanisms, receptor pharmacology, and ionic equilibria are presented strictly for educational and computational biophysics; no clinical or prescribing guidance is provided.
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {([
          ['catalog', '1. Ion Channels & Receptors (65)'],
          ['nernst', '2. Nernst & GHK Equilibrium Calculator'],
          ['transmitters', '3. Eight Neurotransmitter Systems'],
          ['studio', '4. Studio C Channel & Receptor Cutaway'],
        ] as const).map(([k, lbl]) => (
          <button key={k} type="button" className={`cx-btn${tab === k ? ' cx-btn-primary' : ''}`} onClick={() => setTab(k)}>
            {lbl}
          </button>
        ))}
      </div>

      {tab === 'catalog' && (
        <div className="cx-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input type="search" className="cx-input" placeholder="Search channel, receptor, gene symbol…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
            <select className="cx-select" value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="cx-grid-auto">
            {filtered.map((m) => (
              <div key={m.id} className="cx-card" style={{ background: '#0d1422', padding: 11, display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                  <EntityRef id={m.id} label={m.canonicalName} />
                  {m.reversalPotentialMv !== null && m.reversalPotentialMv !== undefined && (
                    <span className="cx-badge tabular" style={{ fontSize: 10 }}>E={m.reversalPotentialMv} mV</span>
                  )}
                </div>
                <div className="tabular" style={{ fontSize: 11, color: 'var(--accent-neural-cyan)' }}>
                  {m.molecularCategory} {m.geneOrSubunitSymbols.length ? `· ${m.geneOrSubunitSymbols.join(', ')}` : ''}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{m.biophysicalMechanism}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'nernst' && (
        <div className="cx-grid-2">
          <div className="cx-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="cx-card-title">Ionic Concentrations & Permeabilities</div>
            <MathFormula display latex="E_{\text{ion}} = \frac{RT}{zF}\ln\frac{[\text{ion}]_o}{[\text{ion}]_i}, \qquad V_m = \frac{RT}{F}\ln\frac{P_K[K^+]_o + P_{Na}[Na^+]_o + P_{Cl}[Cl^-]_i}{P_K[K^+]_i + P_{Na}[Na^+]_i + P_{Cl}[Cl^-]_o}" />
            {[
              ['Temperature (°C)', tempC, 2, 42, 0.5, setTempC],
              ['[K⁺] inside (mM)', kIn, 80, 180, 1, setKIn],
              ['[K⁺] outside (mM)', kOut, 1, 20, 0.5, setKOut],
              ['[Na⁺] inside (mM)', naIn, 2, 40, 1, setNaIn],
              ['[Na⁺] outside (mM)', naOut, 80, 180, 1, setNaOut],
              ['[Cl⁻] inside (mM)', clIn, 2, 40, 0.5, setClIn],
              ['[Cl⁻] outside (mM)', clOut, 80, 150, 1, setClOut],
              ['[Ca²⁺] inside (mM)', caIn, 0.00005, 0.01, 0.00005, setCaIn],
              ['[Ca²⁺] outside (mM)', caOut, 0.5, 4, 0.1, setCaOut],
              ['Relative P_Na / P_K', pNaRel, 0.01, 20, 0.02, setPNaRel],
              ['Relative P_Cl / P_K', pClRel, 0, 2, 0.05, setPClRel],
            ].map(([label, val, mn, mx, st, setter]) => (
              <label key={String(label)} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <span style={{ width: 155 }}>{String(label)}</span>
                <input type="range" min={Number(mn)} max={Number(mx)} step={Number(st)} value={Number(val)} onChange={(e) => (setter as (v: number) => void)(Number(e.target.value))} style={{ flex: 1 }} />
                <span className="tabular" style={{ width: 65, textAlign: 'right' }}>{Number(val).toPrecision(3)}</span>
              </label>
            ))}
          </div>

          <div className="cx-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="cx-card-title">Computed Equilibrium & Resting Potentials</div>
            {[
              { label: 'GHK Resting Membrane Potential V_m', val: vGhk, id: 'MECH-001', color: '#38BDF8' },
              { label: 'Potassium Nernst E_K', val: eK, id: 'MOL-CH-KV1-1', color: '#A855F7' },
              { label: 'Sodium Nernst E_Na', val: eNa, id: 'MOL-CH-NAV1-1', color: '#F59E0B' },
              { label: 'Chloride Nernst E_Cl', val: eCl, id: 'MOL-REC-GABAA', color: '#10B981' },
              { label: 'Calcium Nernst E_Ca', val: eCa, id: 'MOL-CH-CAV2-1', color: '#FB7185' },
            ].map((row) => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#0d1422', borderRadius: 6, borderLeft: `3px solid ${row.color}` }}>
                <EntityRef id={row.id} label={row.label} />
                <span className="tabular" style={{ fontSize: 18, fontWeight: 700, color: row.color }}>
                  {row.val.toFixed(2)} mV
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'transmitters' && (
        <div className="cx-grid-2">
          {NT_SYSTEMS.map((nt) => (
            <div key={nt.id} className="cx-card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <EntityRef id={nt.id} label={nt.name} />
                <EntityRef id={nt.clearance} label={`Clearance: ${nt.clearance}`} />
              </div>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>{nt.role}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {nt.receptors.map((r) => <EntityRef key={r} id={r} />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'studio' && (
        <Suspense fallback={<div className="cx-banner">Loading Studio C…</div>}>
          <StudioCSynaptic initialMode="channels" height={450} />
        </Suspense>
      )}
    </div>
  );
}
