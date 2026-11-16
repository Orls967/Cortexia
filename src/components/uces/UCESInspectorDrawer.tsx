import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  loadExplanation, loadIndex, loadRegistryMap,
  type EntityIndex,
} from '../../data/registry';
import { resolveEntityRoute } from '../../data/routeResolver';
import type {
  EquationEntity, ExperimentEntity, ExplanationRecord, ParameterEntity, ReferenceEntity,
} from '../../data/types';
import { useSelectionStore } from '../../stores/selectionStore';
import { EntityRef } from '../ui/EntityRef';
import { MathFormula } from '../ui/MathFormula';
import { ProvenanceBadge } from '../ui/ProvenanceBadge';

export function UCESInspectorDrawer() {
  const selectedId = useSelectionStore((s) => s.selectedEntityId);
  const inspectorOpen = useSelectionStore((s) => s.inspectorOpen);
  const setInspectorOpen = useSelectionStore((s) => s.setInspectorOpen);
  const selectEntity = useSelectionStore((s) => s.selectEntity);
  const recentIds = useSelectionStore((s) => s.recentEntityIds);

  const [loading, setLoading] = useState(false);
  const [loadedPair, setLoadedPair] = useState<{ id: string; rec: ExplanationRecord | null } | null>(null);
  const [index, setIndex] = useState<EntityIndex | null>(null);
  const [eqMap, setEqMap] = useState<Map<string, EquationEntity> | null>(null);
  const [paramMap, setParamMap] = useState<Map<string, ParameterEntity> | null>(null);
  const [refMap, setRefMap] = useState<Map<string, ReferenceEntity> | null>(null);
  const [expMap, setExpMap] = useState<Map<string, ExperimentEntity> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      loadIndex(),
      loadRegistryMap('equations'),
      loadRegistryMap('parameters'),
      loadRegistryMap('references'),
      loadRegistryMap('experiments'),
    ])
      .then(([idx, eqs, params, refs, exps]) => {
        setIndex(idx);
        setEqMap(eqs);
        setParamMap(params);
        setRefMap(refs);
        setExpMap(exps);
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    Promise.resolve().then(() => {
      if (active) { setLoading(true); setLoadError(null); }
    });
    loadExplanation(selectedId)
      .then((rec) => {
        if (active) {
          setLoadedPair({ id: selectedId, rec });
          setLoading(false);
        }
      })
      .catch((e) => {
        if (active) {
          setLoadError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        }
      });
    return () => { active = false; };
  }, [selectedId]);

  const record = selectedId && loadedPair?.id === selectedId ? loadedPair.rec : null;

  if (!inspectorOpen) return null;

  const idxEntry = selectedId ? index?.byId.get(selectedId) : undefined;
  const routes = selectedId ? resolveEntityRoute(selectedId, record?.associatedModels) : null;
  const expEntry = selectedId?.startsWith('EXP-') ? expMap?.get(selectedId) : undefined;
  const refEntry = selectedId?.startsWith('REF-') ? refMap?.get(selectedId) : undefined;

  return (
    <aside
      className="cx-inspector-dock"
      aria-label="Universal Contextual Explanation Inspector"
      aria-live="polite"
      data-testid="uces-inspector"
    >
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          background: '#11192b',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--accent-ice-blue)', fontWeight: 700 }}>
            UCES Scientific Inspector
          </div>
          <div className="tabular" style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {selectedId ?? 'No entity selected'}
          </div>
        </div>
        <button
          type="button"
          className="cx-btn"
          style={{ padding: '4px 8px' }}
          aria-label="Close UCES Inspector"
          onClick={() => setInspectorOpen(false)}
        >
          ✕
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {!selectedId && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="cx-banner cx-banner-cyan">
              Click any 3D brain structure, neuron compartment, receptor, circuit node, equation, parameter, or chart element to inspect its complete scientific documentation.
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                Quick Inspect Entities
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {recentIds.map((id) => (
                  <EntityRef key={id} id={id} label={index?.byId.get(id)?.name ?? id} />
                ))}
              </div>
            </div>
          </div>
        )}

        {selectedId && loading && (
          <div className="cx-banner">Loading registry documentation for {selectedId}…</div>
        )}

        {selectedId && loadError && (
          <div className="cx-banner cx-banner-rose">Error loading explanation: {loadError}</div>
        )}

        {selectedId && !loading && !record && !expEntry && !refEntry && (
          <div className="cx-banner cx-banner-amber" role="status">
            <strong>ERR_EXPLANATION_INCOMPLETE:</strong> Entity <code>{selectedId}</code>
            {idxEntry ? ` (${idxEntry.name})` : ''} does not have a complete 12-section UCES explanation record in the Phase 0 coverage registry. Missing content is intentionally not fabricated.
            {idxEntry && <p style={{ margin: '6px 0 0' }}>{idxEntry.shortDefinition}</p>}
          </div>
        )}

        {selectedId && !loading && expEntry && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>{expEntry.title}</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <span className="cx-badge tabular">{expEntry.id}</span>
              <span className="cx-badge tabular">{expEntry.primaryScale}</span>
              <ProvenanceBadge status="THEORETICAL_MODEL" />
            </div>
            <p style={{ margin: 0, fontSize: 13 }}>{expEntry.hypothesis}</p>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              <div>Solver: <code className="tabular">{expEntry.solverId}</code> · dt = {expEntry.dtMs} ms · T = {expEntry.durationMs} ms · seed = {expEntry.randomSeed}</div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <EntityRef id={expEntry.modelId} label={`Model: ${expEntry.modelId}`} />
              {expEntry.references.map((r) => <EntityRef key={r} id={r} />)}
            </div>
          </div>
        )}

        {selectedId && !loading && refEntry && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>{refEntry.title}</h3>
            <div className="cx-badge tabular">{refEntry.id} · {refEntry.year}</div>
            <p style={{ margin: 0, fontSize: 13 }}><strong>Authors:</strong> {refEntry.authors}</p>
            <p style={{ margin: 0, fontSize: 13 }}><strong>Venue:</strong> {refEntry.venue}</p>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>{refEntry.claimsSupported}</p>
            {refEntry.doi && (
              <a href={`https://doi.org/${refEntry.doi}`} target="_blank" rel="noreferrer" className="cx-btn">
                Open DOI: {refEntry.doi}
              </a>
            )}
          </div>
        )}

        {record && !loading && (
          <>
            {record.explanationCompleteness !== 'COMPLETE' && (
              <div className="cx-banner cx-banner-amber">
                ERR_EXPLANATION_INCOMPLETE ({record.explanationCompleteness}) — review gaps below.
              </div>
            )}

            {/* 1. Name, Aliases & ID Badge */}
            <section>
              <h2 style={{ margin: '0 0 6px', fontSize: 17, lineHeight: 1.3 }}>{record.canonicalName}</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 6 }}>
                <span className="cx-badge tabular">{record.id}</span>
                <span className="cx-badge tabular">{record.primaryScale}</span>
                <span className="cx-badge">{record.entityType}</span>
                <ProvenanceBadge status={record.epistemicStatus} />
              </div>
              {record.aliases.length > 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  <strong>Aliases:</strong> {record.aliases.join(', ')}
                </div>
              )}
            </section>

            {/* 2. Short Definition & Overview */}
            <section className="cx-card" style={{ padding: 10 }}>
              <SectionTitle>2. Definition & Overview</SectionTitle>
              <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 500 }}>{record.shortDefinition}</p>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>{record.overview}</p>
            </section>

            {/* 3. Biological Role & Functional Significance */}
            <section>
              <SectionTitle>3. Biological Role & Functional Significance</SectionTitle>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>{record.functionalSignificance}</p>
            </section>

            {/* 4. Anatomical / Biological Context */}
            <section>
              <SectionTitle>4. Biological & Anatomical Context</SectionTitle>
              <p style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--text-secondary)' }}>{record.biologicalContext}</p>
              {record.anatomicalContext && (
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>{record.anatomicalContext}</p>
              )}
            </section>

            {/* 5. Detailed Mechanism */}
            <section>
              <SectionTitle>5. Detailed Mechanism</SectionTitle>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>{record.detailedMechanism}</p>
            </section>

            {/* 6. Related Entities */}
            <section>
              <SectionTitle>6. Related Entities & Knowledge Links</SectionTitle>
              {record.relationships.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No direct relationships recorded in registry.</div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {record.relationships.slice(0, 14).map((rel, i) => (
                    <EntityRef
                      key={`${rel.targetId}-${i}`}
                      id={rel.targetId}
                      label={`${rel.relationType.toLowerCase().replace(/_/g, ' ')}: ${index?.byId.get(rel.targetId)?.name ?? rel.targetId}`}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* 7. Governing Equations */}
            <section>
              <SectionTitle>7. Governing Equations</SectionTitle>
              {!record.equations || record.equations.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Not directly governed by a standalone ODE at this scale — see linked models.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {record.equations.map((eqId) => {
                    const eq = eqMap?.get(eqId);
                    return (
                      <div key={eqId} className="cx-card" style={{ padding: 8, background: '#0e1526' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 600 }}>{eq?.name ?? eqId}</span>
                          <EntityRef id={eqId} label={eqId} />
                        </div>
                        {eq?.latex && <MathFormula latex={eq.latex} display />}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* 8. Parameters & Physical Units */}
            <section>
              <SectionTitle>8. Parameters & Physical Units</SectionTitle>
              {!record.parameters || record.parameters.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  No standalone parameters bound directly to this entity.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {record.parameters.slice(0, 8).map((pid) => {
                    const pr = paramMap?.get(pid);
                    return (
                      <div key={pid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '3px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                        <span>{pr ? `${pr.name} (${pr.symbol})` : pid}</span>
                        <span className="tabular" style={{ color: 'var(--accent-ice-blue)' }}>
                          {pr ? `${pr.defaultValue} ${pr.unit}` : pid}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* 9. Associated Computational Models & Experiments */}
            <section>
              <SectionTitle>9. Associated Models & Experiments</SectionTitle>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(record.associatedModels ?? []).map((mid) => (
                  <Link key={mid} to={`/lab/${encodeURIComponent(mid)}?context=${encodeURIComponent(record.id)}`} className="cx-btn cx-btn-primary">
                    Launch {mid}
                  </Link>
                ))}
                {(record.associatedExperiments ?? []).map((eid) => (
                  <EntityRef key={eid} id={eid} label={eid} />
                ))}
                {!(record.associatedModels?.length) && !(record.associatedExperiments?.length) && (
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No computational models directly linked.</span>
                )}
              </div>
            </section>

            {/* 10. Associated 3D Assets & Datasets */}
            <section>
              <SectionTitle>10. 3D Visualizations & Datasets</SectionTitle>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(record.associatedAssets ?? []).map((aid) => (
                  <span key={aid} className="cx-badge tabular">{aid}</span>
                ))}
                {(record.associatedDatasets ?? []).map((did) => (
                  <Link key={did} to={`/knowledge/datasets/${encodeURIComponent(did)}`} className="cx-entity-chip">
                    {did}
                  </Link>
                ))}
                {!(record.associatedAssets?.length) && !(record.associatedDatasets?.length) && (
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No directly mapped asset or dataset entries.</span>
                )}
              </div>
            </section>

            {/* 11. Scientific References */}
            <section>
              <SectionTitle>11. Verified Scientific References</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {record.references.map((rid) => {
                  const r = refMap?.get(rid);
                  return (
                    <div key={rid} style={{ fontSize: 11, color: 'var(--text-secondary)', padding: '4px 6px', background: '#0e1526', borderRadius: 4 }}>
                      <button
                        type="button"
                        style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent-ice-blue)', fontWeight: 600, fontSize: 11 }}
                        onClick={() => selectEntity(rid)}
                      >
                        {rid}
                      </button>
                      {r ? ` — ${r.authors} (${r.year}). ${r.title}. ${r.venue}.` : ''}
                      {r?.doi && (
                        <>
                          {' '}
                          <a href={`https://doi.org/${r.doi}`} target="_blank" rel="noreferrer">DOI</a>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* 12. Assumptions & Limitations */}
            <section className="cx-banner cx-banner-amber">
              <SectionTitle>12. Assumptions, Abstraction & Limitations</SectionTitle>
              <div style={{ fontSize: 11, marginBottom: 4 }}><strong>Abstraction:</strong> {record.abstractionLevel}</div>
              <ul style={{ margin: '4px 0 4px 16px', padding: 0, fontSize: 11 }}>
                {record.assumptions.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
              <ul style={{ margin: '4px 0 0 16px', padding: 0, fontSize: 11 }}>
                {record.limitations.map((l, i) => <li key={i}>{l}</li>)}
              </ul>
            </section>
          </>
        )}
      </div>

      {selectedId && routes && (
        <div
          style={{
            padding: '10px 14px',
            borderTop: '1px solid var(--border-subtle)',
            background: '#11192b',
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <Link to={routes.knowledgePath} className="cx-btn cx-btn-primary" style={{ flex: 1 }}>
            Open Full Scientific Page
          </Link>
          {routes.explorePath && (
            <Link to={routes.explorePath} className="cx-btn">
              Explore Studio
            </Link>
          )}
          {routes.labPath && (
            <Link to={routes.labPath} className="cx-btn">
              Open in Lab
            </Link>
          )}
        </div>
      )}
    </aside>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-primary)', marginBottom: 4 }}>
      {children}
    </div>
  );
}
