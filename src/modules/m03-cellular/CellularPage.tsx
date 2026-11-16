import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EntityRef } from '../../components/ui/EntityRef';
import { ProvenanceBadge } from '../../components/ui/ProvenanceBadge';
import { loadRegistry } from '../../data/registry';
import type { CellularEntity } from '../../data/types';
import { useSelectionStore } from '../../stores/selectionStore';
import type { CellMorphologyId } from '../../studios/StudioBCellular';

const StudioBCellular = lazy(() => import('../../studios/StudioBCellular').then((m) => ({ default: m.StudioBCellular })));

const STUDIO_IDS = new Set<CellMorphologyId>([
  'CELL-PYRAMIDAL-L5', 'CELL-PYRAMIDAL-CA1', 'CELL-INTERNEURON-PV-BASKET', 'CELL-PURKINJE',
  'CELL-MOTOR-ALPHA', 'CELL-SENSORY-DRG', 'CELL-ASTROCYTE-PROTOPLASMIC', 'CELL-OLIGODENDROCYTE',
  'CELL-MICROGLIA', 'CELL-EPENDYMAL',
]);

export function CellularPage() {
  const { entityId } = useParams();
  const [cells, setCells] = useState<CellularEntity[]>([]);
  const [category, setCategory] = useState('ALL');
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [compareId, setCompareId] = useState<string>('CELL-INTERNEURON-PV-BASKET');
  const selectEntity = useSelectionStore((s) => s.selectEntity);
  const activeId = chosenId ?? entityId ?? 'CELL-PYRAMIDAL-L5';

  useEffect(() => {
    loadRegistry('cells').then(setCells).catch(() => {});
  }, []);

  useEffect(() => {
    if (entityId) selectEntity(entityId, { openInspector: true, scale: 'L3' });
  }, [entityId, selectEntity]);

  const categories = useMemo(() => ['ALL', ...new Set(cells.map((c) => c.cellCategory))], [cells]);
  const visible = useMemo(
    () => (category === 'ALL' ? cells : cells.filter((c) => c.cellCategory === category)),
    [cells, category],
  );

  const active = useMemo(() => cells.find((c) => c.id === activeId) ?? cells[0], [cells, activeId]);
  const compare = useMemo(() => cells.find((c) => c.id === compareId) ?? cells[1], [cells, compareId]);
  const studioCell: CellMorphologyId = STUDIO_IDS.has(activeId as CellMorphologyId)
    ? (activeId as CellMorphologyId)
    : 'CELL-PYRAMIDAL-L5';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <span className="cx-badge tabular" style={{ color: 'var(--accent-ice-blue)' }}>MOD-03 · CELLULAR NEUROSCIENCE</span>
          <h1 style={{ margin: '4px 0 2px', fontSize: 20 }}>Neuronal Morphologies, Glia & Subcellular Compartments</h1>
        </div>
        <ProvenanceBadge status="ESTABLISHED" text="30 Cellular Entities · Studio B" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 290px) minmax(0, 1fr)', gap: 14 }}>
        <div className="cx-card" style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 720, overflow: 'hidden' }}>
          <div className="cx-card-title">Cell Taxonomy ({visible.length})</div>
          <select className="cx-select" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter cell category">
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {visible.map((c) => (
              <button
                key={c.id}
                type="button"
                style={{
                  textAlign: 'left',
                  padding: '6px 8px',
                  borderRadius: 6,
                  border: active?.id === c.id ? '1px solid var(--accent-ice-blue)' : '1px solid transparent',
                  background: active?.id === c.id ? 'rgba(56,189,248,0.14)' : '#0d1422',
                }}
                onClick={() => { setChosenId(c.id); selectEntity(c.id, { scale: c.primaryScale }); }}
              >
                <div style={{ fontSize: 12, fontWeight: 600 }}>{c.canonicalName}</div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                  {c.cellCategory} {c.primaryNeurotransmitter ? `· ${c.primaryNeurotransmitter}` : ''}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Suspense fallback={<div className="cx-banner">Loading Cellular Studio B…</div>}>
            <StudioBCellular cellId={studioCell} onSelectCell={(id) => setChosenId(id)} height={400} />
          </Suspense>

          {active && (
            <div className="cx-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: 17 }}>{active.canonicalName}</h2>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span className="cx-badge tabular">{active.id}</span>
                  <Link to={`/knowledge/${encodeURIComponent(active.id)}`} className="cx-btn">Knowledge Page</Link>
                  <Link to={`/lab/${active.associatedModelIds[0] ?? 'MODEL-008'}?context=${encodeURIComponent(active.id)}`} className="cx-btn cx-btn-primary">
                    Launch Single-Cell Simulator
                  </Link>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 13 }}>{active.morphologySummary}</p>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>{active.physiologicalRole}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 12 }}>
                <strong>Markers:</strong>
                {active.characteristicMarkers.map((m) => <span key={m} className="cx-badge">{m}</span>)}
              </div>
              {active.locatedInIds.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', fontSize: 12 }}>
                  <strong>Anatomical Contexts:</strong>
                  {active.locatedInIds.map((lid) => <EntityRef key={lid} id={lid} />)}
                </div>
              )}
            </div>
          )}

          {/* Side-by-Side Cell Comparison */}
          {active && compare && (
            <div className="cx-card">
              <div className="cx-card-title">
                <span>Side-by-Side Cell Comparison</span>
                <select className="cx-select" value={compare.id} onChange={(e) => setCompareId(e.target.value)} aria-label="Select comparison cell">
                  {cells.map((c) => <option key={c.id} value={c.id}>{c.canonicalName}</option>)}
                </select>
              </div>
              <div className="cx-grid-2" style={{ fontSize: 12 }}>
                {[active, compare].map((c) => (
                  <div key={c.id} style={{ background: '#0d1422', padding: 10, borderRadius: 6 }}>
                    <strong style={{ color: 'var(--accent-ice-blue)' }}>{c.canonicalName}</strong>
                    <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{c.cellCategory} · NT: {c.primaryNeurotransmitter ?? 'None / Glial'}</div>
                    <p style={{ margin: '0 0 4px' }}>{c.morphologySummary}</p>
                    <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{c.physiologicalRole}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
