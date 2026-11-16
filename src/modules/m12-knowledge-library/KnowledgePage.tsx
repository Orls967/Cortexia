import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EntityRef } from '../../components/ui/EntityRef';
import { MathFormula } from '../../components/ui/MathFormula';
import { ProvenanceBadge } from '../../components/ui/ProvenanceBadge';
import { loadExplanation, loadIndex, loadKnowledgeGraph, loadRegistry, loadRegistryMap, type EntityIndex, type KnowledgeGraph } from '../../data/registry';
import { resolveEntityRoute, searchEntities } from '../../data/routeResolver';
import type {
  DatasetEntity, EquationEntity, ExplanationRecord, ParameterEntity, ReferenceEntity, ValidationCaseEntity,
} from '../../data/types';
import { VALIDATION_CASES } from '../../kernels/validation/cases';
import { useLabStore } from '../../stores/labStore';
import { useSelectionStore } from '../../stores/selectionStore';

export function KnowledgePage({ section = 'browse' }: { section?: 'browse' | 'entity' | 'graph' | 'equations' | 'datasets' | 'validation' | 'references' }) {
  const params = useParams();
  const entityId = params.entityId ?? params.equationId ?? params.datasetId;

  const [index, setIndex] = useState<EntityIndex | null>(null);
  const [kg, setKg] = useState<KnowledgeGraph | null>(null);
  const [equations, setEquations] = useState<EquationEntity[]>([]);
  const [datasets, setDatasets] = useState<DatasetEntity[]>([]);
  const [references, setReferences] = useState<ReferenceEntity[]>([]);
  const [valCases, setValCases] = useState<ValidationCaseEntity[]>([]);
  const [paramMap, setParamMap] = useState<Map<string, ParameterEntity> | null>(null);
  const [refMap, setRefMap] = useState<Map<string, ReferenceEntity> | null>(null);
  const [eqMap, setEqMap] = useState<Map<string, EquationEntity> | null>(null);
  const [record, setRecord] = useState<ExplanationRecord | null>(null);

  const [query, setQuery] = useState('');
  const [prefixFilter, setPrefixFilter] = useState('ALL');
  const [kgOverrideId, setKgOverrideId] = useState<string | null>(null);
  const [relFilter, setRelFilter] = useState('ALL');
  const kgFocusId = kgOverrideId ?? entityId ?? 'ANAT-HIPPOCAMPUS';

  const validations = useLabStore((s) => s.validations);
  const runValidationCase = useLabStore((s) => s.runValidationCase);
  const jobStatus = useLabStore((s) => s.jobStatus);
  const selectEntity = useSelectionStore((s) => s.selectEntity);

  useEffect(() => {
    loadIndex().then(setIndex).catch(() => {});
    loadKnowledgeGraph().then(setKg).catch(() => {});
    loadRegistry('equations').then(setEquations).catch(() => {});
    loadRegistry('datasets').then(setDatasets).catch(() => {});
    loadRegistry('references').then(setReferences).catch(() => {});
    loadRegistry('validationCases').then(setValCases).catch(() => {});
    loadRegistryMap('parameters').then(setParamMap).catch(() => {});
    loadRegistryMap('references').then(setRefMap).catch(() => {});
    loadRegistryMap('equations').then(setEqMap).catch(() => {});
  }, []);

  useEffect(() => {
    if (section === 'entity' && entityId) {
      loadExplanation(entityId).then(setRecord).catch(() => setRecord(null));
    }
  }, [section, entityId]);

  const browseResults = useMemo(() => {
    if (!index) return [];
    const list = query ? searchEntities(index, query, 80) : index.list.slice(0, 80);
    return prefixFilter === 'ALL' ? list : list.filter((e) => e.id.startsWith(prefixFilter));
  }, [index, query, prefixFilter]);

  const kgNeighbors = useMemo(() => {
    if (!kg) return [];
    const ni = kg.indexOf.get(kgFocusId);
    if (ni === undefined) return [];
    const edges: { dir: 'out' | 'in'; rel: string; otherId: string; otherLabel: string; otherScale: string }[] = [];
    for (const ei of kg.out[ni] ?? []) {
      const e = kg.raw.edges[ei]!;
      const target = kg.raw.nodes[e[1]]!;
      const rel = kg.raw.relTypes[e[2]]!;
      if (relFilter === 'ALL' || rel === relFilter) edges.push({ dir: 'out', rel, otherId: target[0], otherLabel: target[1], otherScale: target[3] });
    }
    for (const ei of kg.inc[ni] ?? []) {
      const e = kg.raw.edges[ei]!;
      const src = kg.raw.nodes[e[0]]!;
      const rel = kg.raw.relTypes[e[2]]!;
      if (relFilter === 'ALL' || rel === relFilter) edges.push({ dir: 'in', rel, otherId: src[0], otherLabel: src[1], otherScale: src[3] });
    }
    return edges.slice(0, 32);
  }, [kg, kgFocusId, relFilter]);

  // Sub-navigation header
  const tabs = (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      <Link to="/knowledge" className={`cx-btn${section === 'browse' ? ' cx-btn-primary' : ''}`}>Encyclopedia Index</Link>
      <Link to="/knowledge/graph" className={`cx-btn${section === 'graph' ? ' cx-btn-primary' : ''}`}>Knowledge Graph (774 Nodes)</Link>
      <Link to="/knowledge/equations" className={`cx-btn${section === 'equations' ? ' cx-btn-primary' : ''}`}>Equations ({equations.length})</Link>
      <Link to="/knowledge/datasets" className={`cx-btn${section === 'datasets' ? ' cx-btn-primary' : ''}`}>Datasets ({datasets.length})</Link>
      <Link to="/knowledge/validation" className={`cx-btn${section === 'validation' ? ' cx-btn-primary' : ''}`}>Validation ({VALIDATION_CASES.length})</Link>
      <Link to="/knowledge/references" className={`cx-btn${section === 'references' ? ' cx-btn-primary' : ''}`}>References ({references.length})</Link>
    </div>
  );

  // TIER C: DEDICATED ENTITY PAGE (/knowledge/:entityId)
  if (section === 'entity' && entityId) {
    const idxEntry = index?.byId.get(entityId);
    const routes = resolveEntityRoute(entityId, record?.associatedModels);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 960 }}>
        {tabs}
        {record ? (
          <article className="cx-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                  <span className="cx-badge tabular">{record.id}</span>
                  <span className="cx-badge tabular">{record.primaryScale}</span>
                  <span className="cx-badge">{record.entityType}</span>
                  <ProvenanceBadge status={record.epistemicStatus} />
                </div>
                <h1 style={{ margin: 0, fontSize: 22 }}>{record.canonicalName}</h1>
                {record.aliases.length > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                    Also known as: {record.aliases.join(', ')}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {routes.explorePath && <Link to={routes.explorePath} className="cx-btn">Open in 3D Explore</Link>}
                {routes.labPath && <Link to={routes.labPath} className="cx-btn cx-btn-primary">Launch Simulator</Link>}
                <Link to={`/knowledge/graph/${encodeURIComponent(record.id)}`} className="cx-btn">Open in KG</Link>
              </div>
            </div>

            <div className="cx-banner cx-banner-cyan">{record.shortDefinition}</div>

            <section>
              <h2 style={{ fontSize: 15, margin: '0 0 6px' }}>Scientific Overview & Context</h2>
              <p style={{ margin: '0 0 8px' }}>{record.overview}</p>
              <p style={{ margin: '0 0 8px', color: 'var(--text-secondary)' }}>{record.biologicalContext}</p>
              {record.anatomicalContext && <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{record.anatomicalContext}</p>}
            </section>

            <section>
              <h2 style={{ fontSize: 15, margin: '0 0 6px' }}>Biological Mechanism & Functional Significance</h2>
              <p style={{ margin: '0 0 8px' }}>{record.detailedMechanism}</p>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{record.functionalSignificance}</p>
            </section>

            {record.equations && record.equations.length > 0 && (
              <section>
                <h2 style={{ fontSize: 15, margin: '0 0 6px' }}>Governing Equations</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {record.equations.map((eqId) => {
                    const eq = eqMap?.get(eqId);
                    return (
                      <div key={eqId} className="cx-card" style={{ background: '#090d16', padding: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong>{eq?.name ?? eqId}</strong>
                          <Link to={`/knowledge/equations/${encodeURIComponent(eqId)}`} className="cx-badge">{eqId}</Link>
                        </div>
                        {eq?.latex && <MathFormula latex={eq.latex} display />}
                        {eq?.description && <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>{eq.description}</p>}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {record.parameters && record.parameters.length > 0 && (
              <section>
                <h2 style={{ fontSize: 15, margin: '0 0 6px' }}>Parameters & Physical Units</h2>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-strong)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: 6 }}>ID</th>
                      <th style={{ padding: 6 }}>Parameter</th>
                      <th style={{ padding: 6 }}>Default</th>
                      <th style={{ padding: 6 }}>Range</th>
                      <th style={{ padding: 6 }}>Biological Meaning</th>
                    </tr>
                  </thead>
                  <tbody>
                    {record.parameters.map((pid) => {
                      const pr = paramMap?.get(pid);
                      return (
                        <tr key={pid} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td className="tabular" style={{ padding: 6 }}><EntityRef id={pid} /></td>
                          <td style={{ padding: 6 }}>{pr?.name ?? pid}</td>
                          <td className="tabular" style={{ padding: 6 }}>{pr ? `${pr.defaultValue} ${pr.unit}` : '—'}</td>
                          <td className="tabular" style={{ padding: 6 }}>{pr ? `[${pr.minValue}, ${pr.maxValue}]` : '—'}</td>
                          <td style={{ padding: 6, color: 'var(--text-secondary)' }}>{pr?.biologicalMeaning ?? '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
            )}

            <section>
              <h2 style={{ fontSize: 15, margin: '0 0 6px' }}>Knowledge Graph Relationships ({record.relationships.length})</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {record.relationships.map((r, i) => (
                  <Link key={`${r.targetId}-${i}`} to={resolveEntityRoute(r.targetId).knowledgePath} className="cx-entity-chip">
                    <span>{r.relationType}:</span>
                    <strong>{index?.byId.get(r.targetId)?.name ?? r.targetId}</strong>
                  </Link>
                ))}
              </div>
            </section>

            <section className="cx-banner cx-banner-amber">
              <strong>Assumptions & Limitations ({record.abstractionLevel}):</strong>
              <ul style={{ margin: '4px 0 0 16px', padding: 0, fontSize: 12 }}>
                {record.assumptions.map((a, i) => <li key={`a-${i}`}>{a}</li>)}
                {record.limitations.map((l, i) => <li key={`l-${i}`}>{l}</li>)}
              </ul>
            </section>

            <section>
              <h2 style={{ fontSize: 15, margin: '0 0 6px' }}>Scientific References</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {record.references.map((rid) => {
                  const ref = refMap?.get(rid);
                  return (
                    <div key={rid} className="cx-card" style={{ background: '#0d1422', padding: 9, fontSize: 12 }}>
                      <strong className="tabular">{rid}</strong> — {ref ? `${ref.authors} (${ref.year}). ${ref.title}. ${ref.venue}.` : 'Registry reference'}
                      {ref?.doi && (
                        <> · <a href={`https://doi.org/${ref.doi}`} target="_blank" rel="noreferrer">https://doi.org/{ref.doi}</a></>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </article>
        ) : (
          <div className="cx-card">
            <h1 style={{ margin: '0 0 6px', fontSize: 20 }}>{idxEntry?.name ?? entityId}</h1>
            <div className="cx-badge tabular" style={{ marginBottom: 8 }}>{entityId}</div>
            <p>{idxEntry?.shortDefinition ?? 'Detailed encyclopedia record not present for this auxiliary ID; see Inspector or Knowledge Graph.'}</p>
            <button type="button" className="cx-btn cx-btn-primary" onClick={() => selectEntity(entityId)}>
              Inspect in UCES Drawer
            </button>
          </div>
        )}
      </div>
    );
  }

  // KNOWLEDGE GRAPH EXPLORER (/knowledge/graph)
  if (section === 'graph') {
    const focusNode = kg?.raw.nodes[kg.indexOf.get(kgFocusId) ?? -1];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {tabs}
        <div className="cx-card" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontSize: 12 }}>
              Focus Entity ID:
              <input type="text" className="cx-input tabular" value={kgFocusId} onChange={(e) => setKgOverrideId(e.target.value)} style={{ marginLeft: 6, width: 210 }} />
            </label>
            <select className="cx-select" value={relFilter} onChange={(e) => setRelFilter(e.target.value)} aria-label="Filter relationship type">
              <option value="ALL">All Relation Types</option>
              {(kg?.raw.relTypes ?? []).map((rt) => <option key={rt} value={rt}>{rt}</option>)}
            </select>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Relationship semantics strictly preserved (Anatomical ≠ Functional ≠ Modeled ≠ Synthetic).
          </div>
        </div>

        <div className="cx-grid-2">
          <div className="cx-card">
            <div className="cx-card-title">
              <span>Local Knowledge Subgraph: {focusNode ? focusNode[1] : kgFocusId}</span>
              <span className="cx-badge tabular">{kgNeighbors.length} edges</span>
            </div>
            <svg viewBox="0 0 460 360" style={{ width: '100%', background: '#090d16', borderRadius: 6 }} role="img" aria-label="Knowledge graph neighborhood diagram">
              {kgNeighbors.slice(0, 14).map((nb, idx, arr) => {
                const ang = (idx / Math.max(1, arr.length)) * Math.PI * 2;
                const nx = 230 + Math.cos(ang) * 145;
                const ny = 180 + Math.sin(ang) * 135;
                return (
                  <g key={`${nb.otherId}-${idx}`} style={{ cursor: 'pointer' }} onClick={() => setKgOverrideId(nb.otherId)}>
                    <line x1={230} y1={180} x2={nx} y2={ny} stroke={nb.dir === 'out' ? '#38BDF8' : '#A855F7'} strokeWidth={1.3} strokeOpacity={0.65} />
                    <circle cx={nx} cy={ny} r={16} fill="#151e30" stroke={nb.dir === 'out' ? '#38BDF8' : '#A855F7'} strokeWidth={1.5} />
                    <text x={nx} y={ny + 3} textAnchor="middle" fill="#F1F5F9" fontSize={8}>{nb.otherScale}</text>
                    <text x={nx} y={ny + 26} textAnchor="middle" fill="#94A3B8" fontSize={8}>
                      {nb.otherLabel.slice(0, 22)}
                    </text>
                  </g>
                );
              })}
              <circle cx={230} cy={180} r={26} fill="#0284c7" stroke="#38BDF8" strokeWidth={2.5} />
              <text x={230} y={184} textAnchor="middle" fill="#fff" fontSize={9} fontWeight={700}>
                {(focusNode?.[1] ?? kgFocusId).slice(0, 14)}
              </text>
            </svg>
          </div>

          <div className="cx-card" style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 420, overflowY: 'auto' }}>
            <div className="cx-card-title">Typed Edges (Click to Traverse)</div>
            {kgNeighbors.map((nb, idx) => (
              <div key={`${nb.otherId}-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '6px 8px', background: '#0d1422', borderRadius: 6, fontSize: 12 }}>
                <div>
                  <span className="cx-badge tabular" style={{ fontSize: 10, marginRight: 6 }}>{nb.dir === 'out' ? '→' : '←'} {nb.rel}</span>
                  <button type="button" style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent-ice-blue)', fontWeight: 600 }} onClick={() => setKgOverrideId(nb.otherId)}>
                    {nb.otherLabel}
                  </button>
                </div>
                <Link to={resolveEntityRoute(nb.otherId).knowledgePath} className="cx-btn" style={{ padding: '2px 7px', fontSize: 10 }}>
                  Page
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // EQUATIONS REPOSITORY (/knowledge/equations)
  if (section === 'equations') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {tabs}
        <h1 style={{ margin: 0, fontSize: 20 }}>Mathematical Equations Repository ({equations.length})</h1>
        <div className="cx-grid-2">
          {equations.map((eq) => (
            <div key={eq.id} className="cx-card" style={{ borderColor: entityId === eq.id ? 'var(--accent-ice-blue)' : undefined, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>{eq.name}</strong>
                <EntityRef id={eq.id} />
              </div>
              <div style={{ background: '#090d16', padding: 8, borderRadius: 6, overflowX: 'auto' }}>
                <MathFormula latex={eq.latex} display />
              </div>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>{eq.description}</p>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {eq.relatedModelIds.map((mid) => <Link key={mid} to={`/lab/${mid}`} className="cx-btn" style={{ padding: '2px 7px', fontSize: 10 }}>{mid}</Link>)}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // DATASETS CATALOG (/knowledge/datasets)
  if (section === 'datasets') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {tabs}
        <h1 style={{ margin: 0, fontSize: 20 }}>Neuroscience Dataset Catalog & Provenance ({datasets.length})</h1>
        <div className="cx-banner cx-banner-amber">
          <strong>Dataset Honesty Notice:</strong> External repository entries (Allen Brain Atlas, NeuroMorpho, OpenNeuro, DANDI, EBRAINS, ModelDB) are catalog metadata with attribution and licenses. Synthetic in-browser benchmarks (<code>DSET-019</code>–<code>DSET-022</code>) are explicitly labeled synthetic and available in <Link to="/analytics/signals">Analytics</Link>.
        </div>
        <div className="cx-grid-auto">
          {datasets.map((d) => (
            <div key={d.id} className="cx-card" style={{ borderColor: entityId === d.id ? 'var(--accent-ice-blue)' : undefined, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                <EntityRef id={d.id} />
                <ProvenanceBadge status={d.provenanceType} />
              </div>
              <strong style={{ fontSize: 13 }}>{d.title}</strong>
              <div style={{ fontSize: 11, color: 'var(--accent-neural-cyan)' }}>
                {d.sourceRepository} · {d.format} · License: {d.license}
              </div>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>{d.description}</p>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Attribution: {d.attributionText}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // VALIDATION REPORTS (/knowledge/validation)
  if (section === 'validation') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {tabs}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <h1 style={{ margin: 0, fontSize: 20 }}>Executable Scientific & Numerical Validation Suite ({VALIDATION_CASES.length} Cases)</h1>
          <button
            type="button"
            className="cx-btn cx-btn-primary"
            disabled={jobStatus === 'RUNNING'}
            onClick={async () => {
              for (const vc of VALIDATION_CASES) await runValidationCase(vc.id);
            }}
          >
            Run All {VALIDATION_CASES.length} Benchmarks
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {VALIDATION_CASES.map((vc) => {
            const res = validations[vc.id];
            const meta = valCases.find((m) => m.id === vc.id);
            return (
              <div key={vc.id} className="cx-card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <span className="cx-badge tabular" style={{ marginRight: 6 }}>{vc.id}</span>
                    <strong>{vc.title}</strong>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {vc.reference} {meta ? `· Tolerance: ${meta.quantitativeTolerance}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {res && (
                      <span className={`cx-badge ${res.passed ? 'cx-banner-emerald' : 'cx-banner-rose'}`}>
                        {res.passed ? `PASSED (${res.elapsedMs.toFixed(0)} ms)` : 'FAILED'}
                      </span>
                    )}
                    <button type="button" className="cx-btn" disabled={jobStatus === 'RUNNING'} onClick={() => runValidationCase(vc.id)}>
                      Run
                    </button>
                  </div>
                </div>
                {res && (
                  <div className="tabular" style={{ fontSize: 11, background: '#0d1422', padding: 8, borderRadius: 6 }}>
                    {res.checks.map((c, idx) => (
                      <div key={idx}>{c.passed ? '✓' : '✗'} {c.label}: {c.measured} ({c.criterion})</div>
                    ))}
                    {res.discrepancy && <div className="cx-banner cx-banner-amber" style={{ marginTop: 6 }}>{res.discrepancy}</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // REFERENCES BIBLIOGRAPHY (/knowledge/references)
  if (section === 'references') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {tabs}
        <h1 style={{ margin: 0, fontSize: 20 }}>Verified Scientific References ({references.length})</h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {references.map((r) => (
            <div key={r.id} className="cx-card" style={{ padding: 11, display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ maxWidth: 760 }}>
                <span className="cx-badge tabular" style={{ marginRight: 6 }}>{r.id}</span>
                <strong>{r.authors} ({r.year})</strong> — {r.title}. <em>{r.venue}</em>.
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>{r.claimsSupported}</div>
              </div>
              {r.doi && (
                <a href={`https://doi.org/${r.doi}`} target="_blank" rel="noreferrer" className="cx-btn" style={{ alignSelf: 'center' }}>
                  DOI: {r.doi}
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // DEFAULT BROWSE / ENCYCLOPEDIA (/knowledge)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {tabs}
      <div>
        <span className="cx-badge tabular" style={{ color: 'var(--accent-ice-blue)' }}>MOD-12 · SCIENTIFIC KNOWLEDGE & RESEARCH LIBRARY</span>
        <h1 style={{ margin: '4px 0 6px', fontSize: 20 }}>Searchable Neuroscience Encyclopedia ({index?.list.length ?? 0} Indexed Entities)</h1>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          type="search"
          className="cx-input"
          placeholder="Search any anatomical region, cell, channel, equation, model, or reference…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: 1, minWidth: 220 }}
        />
        <select className="cx-select" value={prefixFilter} onChange={(e) => setPrefixFilter(e.target.value)} aria-label="Filter entity prefix">
          <option value="ALL">All Categories</option>
          <option value="ANAT-">Anatomy (ANAT-*)</option>
          <option value="CELL-">Cells (CELL-*)</option>
          <option value="MOL-">Molecular (MOL-*)</option>
          <option value="MECH-">Mechanisms (MECH-*)</option>
          <option value="CIRC-">Circuits (CIRC-*)</option>
          <option value="SYS-">Systems (SYS-*)</option>
          <option value="COG-">Cognition (COG-*)</option>
          <option value="MODEL-">Models (MODEL-*)</option>
          <option value="EQ-">Equations (EQ-*)</option>
          <option value="ANALYTIC-">Analytics (ANALYTIC-*)</option>
          <option value="DSET-">Datasets (DSET-*)</option>
          <option value="REF-">References (REF-*)</option>
        </select>
      </div>

      <div className="cx-grid-auto">
        {browseResults.map((item) => (
          <div key={item.id} className="cx-card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
              <span className="cx-badge tabular" style={{ fontSize: 10 }}>{item.id}</span>
              <span className="cx-badge tabular" style={{ fontSize: 10 }}>{item.scale}</span>
            </div>
            <Link to={resolveEntityRoute(item.id).knowledgePath} style={{ fontWeight: 600, fontSize: 14 }}>
              {item.name}
            </Link>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>{item.shortDefinition}</p>
            <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
              <button type="button" className="cx-btn" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => selectEntity(item.id)}>
                Inspect
              </button>
              <Link to={resolveEntityRoute(item.id).knowledgePath} className="cx-btn cx-btn-primary" style={{ fontSize: 11, padding: '3px 8px' }}>
                Full Page
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
