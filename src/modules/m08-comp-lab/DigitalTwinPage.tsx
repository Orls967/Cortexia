import { lazy, Suspense, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ModelOutputViews } from '../../components/charts/ModelOutputViews';
import { formatNum } from '../../components/charts/palette';
import { EntityRef } from '../../components/ui/EntityRef';
import { ProvenanceBadge } from '../../components/ui/ProvenanceBadge';
import { ScientificParameterControl } from '../../components/ui/ScientificParameterControl';
import { getTwin, TWINS } from '../../kernels/twin/pipelines';
import { useLabStore } from '../../stores/labStore';

const StudioDNetwork = lazy(() => import('../../studios/StudioDNetwork').then((m) => ({ default: m.StudioDNetwork })));

export function DigitalTwinPage() {
  const { experimentId } = useParams();
  const navigate = useNavigate();
  const activeExpId = experimentId && TWINS.some((t) => t.id === experimentId) ? experimentId : 'EXP-040';
  const [paramState, setParamState] = useState<Record<string, Record<string, number>>>({});
  const [seed, setSeed] = useState(42);
  const [viewCondition, setViewCondition] = useState<'baseline' | 'intervention'>('intervention');

  const twinResults = useLabStore((s) => s.twinResults);
  const runTwinExperiment = useLabStore((s) => s.runTwinExperiment);
  const jobStatus = useLabStore((s) => s.jobStatus);
  const progress = useLabStore((s) => s.progress);
  const progressLabel = useLabStore((s) => s.progressLabel);
  const cancelActiveJob = useLabStore((s) => s.cancelActiveJob);

  const twin = useMemo(() => getTwin(activeExpId), [activeExpId]);
  const params = useMemo(
    () => ({
      ...Object.fromEntries(twin.params.map((p) => [p.key, p.default])),
      ...(paramState[twin.id] ?? {}),
    }),
    [twin, paramState],
  );
  const result = twinResults[twin.id];

  // Extract last snapshot of EXP-042 activity matrix for 3D Studio D wave rendering
  const nodeActivity = useMemo(() => {
    if (twin.id !== 'EXP-042' || !result) return null;
    const mat = result.conditions[viewCondition].matrices.activity;
    if (!mat || mat.cols === 0) return null;
    const arr = new Float64Array(mat.rows);
    const col = mat.cols - 1;
    for (let r = 0; r < mat.rows; r++) arr[r] = mat.data[r * mat.cols + col]!;
    return arr;
  }, [twin.id, result, viewCondition]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="cx-badge tabular" style={{ color: 'var(--accent-ice-blue)' }}>MOD-08 · 5-TIER EDUCATIONAL BRAIN DIGITAL TWIN</span>
            <ProvenanceBadge status="SYNTHETIC_SIMULATION" />
          </div>
          <h1 style={{ margin: '4px 0 0', fontSize: 20 }}>{twin.id}: {twin.title}</h1>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="cx-btn cx-btn-primary"
            disabled={jobStatus === 'RUNNING'}
            onClick={() => runTwinExperiment(twin.id, params, seed)}
          >
            {jobStatus === 'RUNNING' ? `Running (${Math.round(progress * 100)}%)…` : '▶ Execute Cross-Scale Pipeline'}
          </button>
          {jobStatus === 'RUNNING' && (
            <button type="button" className="cx-btn cx-btn-danger" onClick={cancelActiveJob}>Cancel</button>
          )}
        </div>
      </div>

      {/* Terminology & Validity Boundary */}
      <div className="cx-banner cx-banner-amber">
        <strong>Digital Twin Scope & Boundary:</strong> {twin.anchorNote} <em>{twin.validationBoundary}</em>
      </div>

      {/* Experiment Selector Tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {TWINS.map((t) => (
          <button key={t.id} type="button" className={`cx-btn${t.id === twin.id ? ' cx-btn-primary' : ''}`} onClick={() => navigate(`/lab/digital-twin/${t.id}`)}>
            {t.id}: {t.title.split('→')[0]}
          </button>
        ))}
      </div>

      {/* 5-Tier Pipeline Diagram */}
      <div className="cx-card">
        <div className="cx-card-title">
          <span>Cross-Scale Coupling Stages (Mechanistic vs Conceptual Bridges)</span>
          {jobStatus === 'RUNNING' && <span className="tabular" style={{ fontSize: 11, color: 'var(--accent-ice-blue)' }}>{progressLabel}</span>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 }}>
          {(result?.stages ?? twin.stages.map((s) => ({ ...s, summary: '' }))).map((st) => (
            <div key={st.index} className="cx-card" style={{ background: '#0d1422', padding: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
                <span className="cx-badge tabular" style={{ fontSize: 10 }}>Stage {st.index} · {st.tier}</span>
                <span className="cx-badge" style={{ fontSize: 10, borderColor: st.coupling === 'MECHANISTIC' ? '#10B981' : '#F59E0B', color: st.coupling === 'MECHANISTIC' ? '#6ee7b7' : '#fde68a' }}>
                  {st.coupling}
                </span>
              </div>
              <strong style={{ fontSize: 13 }}>{st.title}</strong>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                <div><strong>In:</strong> {st.input}</div>
                <div><strong>Out:</strong> {st.output}</div>
              </div>
              {st.summary && (
                <div style={{ fontSize: 11, color: 'var(--accent-ice-blue)', borderTop: '1px solid var(--border-subtle)', paddingTop: 4 }}>
                  {st.summary}
                </div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {st.entityIds.slice(0, 4).map((eid) => <EntityRef key={eid} id={eid} />)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Configuration & Comparison */}
      <div className="cx-grid-2">
        <div className="cx-card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="cx-card-title">
            <span>Pipeline Parameters</span>
            <label style={{ fontSize: 11, fontWeight: 400, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              Seed:
              <input type="number" className="cx-input tabular" style={{ width: 70, padding: '2px 6px' }} value={seed} onChange={(e) => setSeed(Math.round(Number(e.target.value)))} />
            </label>
          </div>
          {twin.params.map((p) => (
            <ScientificParameterControl
              key={p.key}
              spec={p}
              modelId={twin.stages[0]?.modelIds[0] ?? 'MODEL-008'}
              value={params[p.key] ?? p.default}
              onChange={(val) => setParamState((prev) => ({ ...prev, [twin.id]: { ...(prev[twin.id] ?? {}), [p.key]: val } }))}
            />
          ))}
        </div>

        <div className="cx-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="cx-card-title">Baseline vs Intervention Metrics</div>
          {!result ? (
            <div className="cx-banner cx-banner-cyan">
              Click <strong>Execute Cross-Scale Pipeline</strong> above to run both baseline and intervention stages in the Web Worker and compare quantitative outputs.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-strong)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: 6 }}>Metric</th>
                    <th style={{ padding: 6 }}>Baseline</th>
                    <th style={{ padding: 6 }}>Intervention</th>
                    <th style={{ padding: 6 }}>Δ</th>
                  </tr>
                </thead>
                <tbody className="tabular">
                  {result.comparisons.map((c) => {
                    const delta = c.intervention - c.baseline;
                    return (
                      <tr key={c.key} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: 6 }}>
                          <div style={{ fontFamily: 'var(--font-sans)' }}>{c.label}</div>
                          {c.analyticId && <EntityRef id={c.analyticId} label={c.analyticId} />}
                        </td>
                        <td style={{ padding: 6 }}>{formatNum(c.baseline)} {c.unit}</td>
                        <td style={{ padding: 6, color: 'var(--accent-ice-blue)', fontWeight: 600 }}>{formatNum(c.intervention)} {c.unit}</td>
                        <td style={{ padding: 6, color: delta >= 0 ? '#6ee7b7' : '#fda4af' }}>
                          {delta >= 0 ? '+' : ''}{formatNum(delta)} {c.unit}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="cx-banner">
            <strong>Explicit Simplifications:</strong>
            <ul style={{ margin: '4px 0 0 16px', padding: 0, fontSize: 11 }}>
              {twin.limitations.map((l, i) => <li key={i}>{l}</li>)}
            </ul>
          </div>
        </div>
      </div>

      {/* Condition Plots + Optional Studio D 3D Wave View */}
      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <strong>Inspect Output Traces & Matrices for:</strong>
            <button type="button" className={`cx-btn${viewCondition === 'baseline' ? ' cx-btn-primary' : ''}`} onClick={() => setViewCondition('baseline')}>
              Baseline Condition
            </button>
            <button type="button" className={`cx-btn${viewCondition === 'intervention' ? ' cx-btn-primary' : ''}`} onClick={() => setViewCondition('intervention')}>
              Intervention Condition
            </button>
          </div>
          {twin.id === 'EXP-042' && (
            <Suspense fallback={<div className="cx-banner">Loading 3D Connectome Oscillations…</div>}>
              <StudioDNetwork mode="connectome68" nodeActivity={nodeActivity} height={360} />
            </Suspense>
          )}
          <ModelOutputViews views={twin.views} output={result.conditions[viewCondition]} />
        </div>
      )}
    </div>
  );
}
