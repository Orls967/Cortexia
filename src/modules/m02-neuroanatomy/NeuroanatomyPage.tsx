import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EntityRef } from '../../components/ui/EntityRef';
import { ProvenanceBadge } from '../../components/ui/ProvenanceBadge';
import { loadRegistry } from '../../data/registry';
import type { AnatomicalEntity } from '../../data/types';
import { useSelectionStore } from '../../stores/selectionStore';

const StudioABrain = lazy(() => import('../../studios/StudioABrain').then((m) => ({ default: m.StudioABrain })));

export function NeuroanatomyPage() {
  const { entityId } = useParams();
  const [items, setItems] = useState<AnatomicalEntity[]>([]);
  const [filter, setFilter] = useState('');
  const [division, setDivision] = useState('ALL');
  const selectedId = useSelectionStore((s) => s.selectedEntityId);
  const selectEntity = useSelectionStore((s) => s.selectEntity);

  useEffect(() => {
    loadRegistry('anatomy').then(setItems).catch(() => {});
  }, []);

  useEffect(() => {
    if (entityId) selectEntity(entityId, { openInspector: true, scale: 'L7' });
  }, [entityId, selectEntity]);

  const divisions = useMemo(() => ['ALL', ...new Set(items.map((i) => i.division))], [items]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return items.filter((i) => {
      if (division !== 'ALL' && i.division !== division) return false;
      if (!q) return true;
      return (
        i.canonicalName.toLowerCase().includes(q) ||
        i.id.toLowerCase().includes(q) ||
        (i.tnaLatinName?.toLowerCase().includes(q) ?? false) ||
        i.aliases.some((a) => a.toLowerCase().includes(q))
      );
    });
  }, [items, filter, division]);

  const active = useMemo(
    () => items.find((i) => i.id === (selectedId ?? entityId)) ?? items.find((i) => i.id === 'ANAT-HIPPOCAMPUS') ?? items[0],
    [items, selectedId, entityId],
  );

  const childrenOfActive = useMemo(
    () => (active ? items.filter((i) => i.parentId === active.id) : []),
    [items, active],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <span className="cx-badge tabular" style={{ color: 'var(--accent-ice-blue)' }}>MOD-02 · NEUROANATOMY ATLAS</span>
          <h1 style={{ margin: '4px 0 2px', fontSize: 20 }}>Interactive Multi-Scale Neuroanatomy & Studio A</h1>
        </div>
        <ProvenanceBadge status="ATLAS_DERIVED" text="TNA Nomenclature + Procedural MNI Approximation" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 310px) minmax(0, 1fr)', gap: 14 }}>
        {/* TNA Hierarchy Browser */}
        <div className="cx-card" style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 740, overflow: 'hidden' }}>
          <div className="cx-card-title">Anatomical Hierarchy ({filtered.length} / {items.length})</div>
          <input
            type="search"
            className="cx-input"
            placeholder="Filter structures or TNA Latin…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filter anatomical structures"
          />
          <select className="cx-select" value={division} onChange={(e) => setDivision(e.target.value)} aria-label="Filter anatomical division">
            {divisions.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
            {filtered.map((item) => {
              const isSel = active?.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  style={{
                    textAlign: 'left',
                    padding: '6px 8px',
                    borderRadius: 6,
                    border: isSel ? '1px solid var(--accent-ice-blue)' : '1px solid transparent',
                    background: isSel ? 'rgba(56,189,248,0.14)' : '#0d1422',
                  }}
                  onClick={() => selectEntity(item.id, { scale: item.primaryScale })}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontSize: 12, fontWeight: 600 }}>
                    <span>{item.canonicalName}</span>
                    <span className="tabular" style={{ fontSize: 10, color: 'var(--text-muted)' }}>{item.primaryScale}</span>
                  </div>
                  {item.tnaLatinName && (
                    <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--text-secondary)' }}>{item.tnaLatinName}</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Center Studio A + Selected Structure Metadata */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Suspense fallback={<div className="cx-banner">Loading Whole Brain Studio A…</div>}>
            <StudioABrain height={430} />
          </Suspense>

          {active && (
            <div className="cx-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 17 }}>{active.canonicalName}</h2>
                  {active.tnaLatinName && (
                    <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--text-secondary)' }}>TNA: {active.tnaLatinName}</div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span className="cx-badge tabular">{active.id}</span>
                  <span className="cx-badge tabular">{active.primaryScale}</span>
                  {active.mniCentroidMm && (
                    <span className="cx-badge tabular">MNI: ({active.mniCentroidMm.join(', ')}) mm</span>
                  )}
                  <Link to={`/knowledge/${encodeURIComponent(active.id)}`} className="cx-btn cx-btn-primary">Full Knowledge Page</Link>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 13 }}>{active.shortDefinition}</p>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>{active.biologicalRole}</p>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 12 }}>
                {active.parentId && (
                  <div>
                    <strong>Parent:</strong> <EntityRef id={active.parentId} />
                  </div>
                )}
                {childrenOfActive.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                    <strong>Subregions:</strong>
                    {childrenOfActive.map((c) => <EntityRef key={c.id} id={c.id} label={c.canonicalName} />)}
                  </div>
                )}
              </div>

              {active.connectedStructureIds.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', fontSize: 12 }}>
                  <strong>Connected Structures:</strong>
                  {active.connectedStructureIds.map((cid) => <EntityRef key={cid} id={cid} />)}
                </div>
              )}

              {active.associatedModelIds.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontSize: 12 }}>
                  <strong>Associated Models:</strong>
                  {active.associatedModelIds.map((mid) => (
                    <Link key={mid} to={`/lab/${mid}?context=${encodeURIComponent(active.id)}`} className="cx-btn">
                      Open {mid}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
