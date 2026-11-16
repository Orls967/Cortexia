import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EntityRef } from '../../components/ui/EntityRef';
import { ProvenanceBadge } from '../../components/ui/ProvenanceBadge';
import { loadRegistry } from '../../data/registry';
import type { SystemEntity } from '../../data/types';
import { useSelectionStore } from '../../stores/selectionStore';

const StudioABrain = lazy(() => import('../../studios/StudioABrain').then((m) => ({ default: m.StudioABrain })));

export function SystemsPage() {
  const { systemId } = useParams();
  const [systems, setSystems] = useState<SystemEntity[]>([]);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const selectEntity = useSelectionStore((s) => s.selectEntity);
  const activeId = chosenId ?? systemId ?? 'SYS-VISUAL';

  useEffect(() => {
    loadRegistry('systems').then(setSystems).catch(() => {});
  }, []);

  useEffect(() => {
    if (systemId) selectEntity(systemId, { openInspector: true, scale: 'L9' });
  }, [systemId, selectEntity]);

  const active = useMemo(() => systems.find((s) => s.id === activeId) ?? systems[0], [systems, activeId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <span className="cx-badge tabular" style={{ color: 'var(--accent-ice-blue)' }}>MOD-09 · SYSTEMS NEUROSCIENCE</span>
          <h1 style={{ margin: '4px 0 2px', fontSize: 20 }}>Sensory, Motor, Autonomic, Sleep, Emotion & Reward Brain Systems</h1>
        </div>
        <ProvenanceBadge status="ESTABLISHED" text={`${systems.length} Integrated Systems`} />
      </div>

      {/* System Selector Pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {systems.map((sys) => (
          <button
            key={sys.id}
            type="button"
            className={`cx-btn${active?.id === sys.id ? ' cx-btn-primary' : ''}`}
            onClick={() => { setChosenId(sys.id); selectEntity(sys.id, { scale: sys.primaryScale }); }}
          >
            {sys.canonicalName}
          </button>
        ))}
      </div>

      {active && (
        <div className="cx-grid-2">
          <div className="cx-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="cx-card-title">
              <span>{active.canonicalName}</span>
              <span className="cx-badge tabular">{active.id} · {active.primaryScale}</span>
            </div>
            <p style={{ margin: 0, fontSize: 13 }}>{active.systemSummary}</p>

            {/* Relay Pathway Stage Chain */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                Anatomical Relay Pathway ({active.coreStructureIds.length} Structures)
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                {active.coreStructureIds.map((aid, idx) => (
                  <span key={aid} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <EntityRef id={aid} />
                    {idx < active.coreStructureIds.length - 1 && <span style={{ color: 'var(--accent-ice-blue)' }}>→</span>}
                  </span>
                ))}
              </div>
            </div>

            {active.circuitIds.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Circuits</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {active.circuitIds.map((cid) => <EntityRef key={cid} id={cid} />)}
                </div>
              </div>
            )}

            {active.mechanismIds.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Key Physiological Mechanisms</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {active.mechanismIds.map((mid) => <EntityRef key={mid} id={mid} />)}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {active.associatedModelIds.map((mid) => (
                <Link key={mid} to={`/lab/${mid}?context=${encodeURIComponent(active.id)}`} className="cx-btn cx-btn-primary">
                  Open {mid}
                </Link>
              ))}
              <Link to={`/knowledge/${encodeURIComponent(active.id)}`} className="cx-btn">Full Encyclopedia Page</Link>
            </div>
          </div>

          <Suspense fallback={<div className="cx-banner">Loading Studio A System Highlights…</div>}>
            <StudioABrain highlightIds={active.coreStructureIds} height={410} />
          </Suspense>
        </div>
      )}
    </div>
  );
}
