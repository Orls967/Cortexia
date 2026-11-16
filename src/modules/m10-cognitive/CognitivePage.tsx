import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EntityRef } from '../../components/ui/EntityRef';
import { ProvenanceBadge } from '../../components/ui/ProvenanceBadge';
import { loadIndex, loadExplanation } from '../../data/registry';
import type { ExplanationRecord, IndexEntity } from '../../data/types';
import { useSelectionStore } from '../../stores/selectionStore';

export function CognitivePage() {
  const { conceptId } = useParams();
  const [concepts, setConcepts] = useState<IndexEntity[]>([]);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ExplanationRecord | null>(null);
  const selectEntity = useSelectionStore((s) => s.selectEntity);
  const activeId = chosenId ?? conceptId ?? 'COG-WORKING-MEMORY';

  useEffect(() => {
    loadIndex()
      .then((idx) => setConcepts(idx.list.filter((e) => e.id.startsWith('COG-'))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (conceptId) selectEntity(conceptId, { openInspector: true, scale: 'L9' });
  }, [conceptId, selectEntity]);

  useEffect(() => {
    loadExplanation(activeId).then(setDetail).catch(() => setDetail(null));
  }, [activeId]);

  const active = useMemo(() => concepts.find((c) => c.id === activeId) ?? concepts[0], [concepts, activeId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <span className="cx-badge tabular" style={{ color: 'var(--accent-ice-blue)' }}>MOD-10 · COGNITIVE NEUROSCIENCE</span>
          <h1 style={{ margin: '4px 0 2px', fontSize: 20 }}>Distributed Cognitive Networks, Memory, Control & Consciousness Theories</h1>
        </div>
        {active && <ProvenanceBadge status={active.epistemic} />}
      </div>

      {/* Mandatory Anti-Phrenology Scientific Guardrail */}
      <div className="cx-banner cx-banner-amber">
        <strong>Distributed Systems Principle:</strong> Cognitive functions emerge from dynamic, large-scale interactions across cortical and subcortical networks—never isolated single-region modules. Established neural correlates are explicitly distinguished below from active research hypotheses and theoretical frameworks (GNW, IIT, Predictive Processing).
      </div>

      <div className="cx-grid-auto">
        {concepts.map((c) => {
          const isAct = active?.id === c.id;
          return (
            <button
              key={c.id}
              type="button"
              className="cx-card"
              style={{
                textAlign: 'left',
                borderColor: isAct ? 'var(--accent-ice-blue)' : 'var(--border-subtle)',
                background: isAct ? 'rgba(56,189,248,0.12)' : 'var(--bg-panel-elevated)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
              onClick={() => { setChosenId(c.id); selectEntity(c.id, { scale: 'L9' }); }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: 6 }}>
                <strong style={{ fontSize: 13 }}>{c.name}</strong>
                <ProvenanceBadge status={c.epistemic} />
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.shortDefinition}</span>
            </button>
          );
        })}
      </div>

      {detail && (
        <div className="cx-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>{detail.canonicalName}</h2>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <ProvenanceBadge status={detail.epistemicStatus} />
              <Link to={`/knowledge/${encodeURIComponent(detail.id)}`} className="cx-btn cx-btn-primary">Full Knowledge Page</Link>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: 13 }}>{detail.overview}</p>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}><strong>Mechanistic & Systems Perspective:</strong> {detail.detailedMechanism}</p>

          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
              Participating Distributed Network Nodes & Mechanisms
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {detail.relationships.map((r, i) => <EntityRef key={`${r.targetId}-${i}`} id={r.targetId} />)}
            </div>
          </div>

          {detail.associatedModels && detail.associatedModels.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {detail.associatedModels.map((mid) => (
                <Link key={mid} to={`/lab/${mid}?context=${encodeURIComponent(detail.id)}`} className="cx-btn">
                  Simulate {mid}
                </Link>
              ))}
            </div>
          )}

          <div className="cx-banner">
            <strong>Open Research Questions & Limitations:</strong>
            <ul style={{ margin: '4px 0 0 16px', padding: 0, fontSize: 12 }}>
              {detail.limitations.map((l, i) => <li key={i}>{l}</li>)}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
