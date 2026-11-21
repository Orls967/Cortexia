import { useEffect, useMemo, useState } from 'react';
import { MODEL_TRACKS } from '../../data/learningPath';
import { Link, useParams } from 'react-router-dom';
import { CurvePlot } from '../../components/charts/CurvePlot';
import { HeatmapCanvas } from '../../components/charts/HeatmapCanvas';
import { ModelOutputViews } from '../../components/charts/ModelOutputViews';
import { formatNum } from '../../components/charts/palette';
import { EntityRef } from '../../components/ui/EntityRef';
import { MathFormula } from '../../components/ui/MathFormula';
import { ProvenanceBadge } from '../../components/ui/ProvenanceBadge';
import { ScientificParameterControl } from '../../components/ui/ScientificParameterControl';
import { loadRegistryMap } from '../../data/registry';
import type { ModelEntity } from '../../data/types';
import { defaultConfig, hasBlockingIssue, validateConfig } from '../../kernels/core/config';
import { SOLVER_INFO, type SolverId, type StimulusKind } from '../../kernels/core/types';
import { linspaceValues, sweepableFields } from '../../kernels/experiments/run';
import { getModel, MODELS } from '../../kernels/models';
import { VALIDATION_CASES } from '../../kernels/validation/cases';
import { useLabStore } from '../../stores/labStore';
import { useSelectionStore } from '../../stores/selectionStore';

export function ComputationalLabPage() {
  const { modelId: routeModelId } = useParams();
  const activeModelId = useLabStore((s) => s.activeModelId);
  const setActiveModel = useLabStore((s) => s.setActiveModel);
  const configs = useLabStore((s) => s.configs);
  const activePresetByModel = useLabStore((s) => s.activePresetByModel);
  const outputs = useLabStore((s) => s.outputs);
  const sweeps = useLabStore((s) => s.sweeps);
  const sweeps2D = useLabStore((s) => s.sweeps2D);
  const sensitivity = useLabStore((s) => s.sensitivity);
  const ensembles = useLabStore((s) => s.ensembles);
  const validations = useLabStore((s) => s.validations);
  const jobStatus = useLabStore((s) => s.jobStatus);
  const progress = useLabStore((s) => s.progress);
  const progressLabel = useLabStore((s) => s.progressLabel);
  const errorMessage = useLabStore((s) => s.errorMessage);
  const lastElapsedMs = useLabStore((s) => s.lastElapsedMs);

  const updateParam = useLabStore((s) => s.updateParam);
  const updateInitial = useLabStore((s) => s.updateInitial);
  const updateStimulus = useLabStore((s) => s.updateStimulus);
  const updateRunOption = useLabStore((s) => s.updateRunOption);
  const applyPreset = useLabStore((s) => s.applyPreset);
  const resetModel = useLabStore((s) => s.resetModel);
  const runActiveModel = useLabStore((s) => s.runActiveModel);
  const runSweepJob = useLabStore((s) => s.runSweepJob);
  const runSweep2DJob = useLabStore((s) => s.runSweep2DJob);
  const runSensitivityJob = useLabStore((s) => s.runSensitivityJob);
  const runEnsembleJob = useLabStore((s) => s.runEnsembleJob);
  const runValidationCase = useLabStore((s) => s.runValidationCase);
  const cancelActiveJob = useLabStore((s) => s.cancelActiveJob);

  const selectEntity = useSelectionStore((s) => s.selectEntity);

  const [modelRegistry, setModelRegistry] = useState<Map<string, ModelEntity> | null>(null);
  const [catalogFilter, setCatalogFilter] = useState('');
  const [expTab, setExpTab] = useState<'single' | 'sweep' | 'sweep2d' | 'sensitivity' | 'ensemble'>('single');
  const [sweepDrafts, setSweepDrafts] = useState<Record<string, { paramKey?: string; from?: number; to?: number; steps?: number; metricKey?: string; yKey?: string }>>({});

  useEffect(() => {
    loadRegistryMap('models').then(setModelRegistry).catch(() => {});
  }, []);

  useEffect(() => {
    if (routeModelId && MODELS.some((m) => m.id === routeModelId)) {
      setActiveModel(routeModelId);
    }
  }, [routeModelId, setActiveModel]);

  const model = useMemo(() => getModel(activeModelId), [activeModelId]);
  const regMeta = modelRegistry?.get(model.id);
  const config = configs[model.id] ?? defaultConfig(model);
  const issues = useMemo(() => validateConfig(model, config), [model, config]);
  const blocked = hasBlockingIssue(issues);

  const sweepFields = useMemo(() => sweepableFields(model), [model]);
  const output = outputs[model.id];
  const sweepResult = sweeps[model.id];
  const sweep2DResult = sweeps2D[model.id];
  const sensResult = sensitivity[model.id];
  const ensResult = ensembles[model.id];
  const modelValCases = useMemo(() => VALIDATION_CASES.filter((v) => v.modelIds.includes(model.id)), [model]);

  const draft = sweepDrafts[model.id] ?? {};
  const defaultField = sweepFields.find((x) => x.key === model.sweep?.paramKey) ?? sweepFields[0];
  const sweepParamKey = draft.paramKey ?? defaultField?.key ?? '';
  const sweepFrom = draft.from ?? model.sweep?.from ?? defaultField?.min ?? 0;
  const sweepTo = draft.to ?? model.sweep?.to ?? defaultField?.max ?? 1;
  const sweepSteps = draft.steps ?? model.sweep?.steps ?? 8;
  const sweepMetricKey = draft.metricKey ?? model.sweep?.metricKey ?? model.metrics[0]?.key ?? '';
  const sweep2YKey = draft.yKey ?? sweepFields[1]?.key ?? sweepFields[0]?.key ?? '';

  const setDraft = (patch: Partial<typeof draft>) =>
    setSweepDrafts((prev) => ({ ...prev, [model.id]: { ...(prev[model.id] ?? {}), ...patch } }));

  // Auto-run default configuration on first visit to a model if no output exists yet
  useEffect(() => {
    if (!outputs[model.id] && jobStatus === 'IDLE') {
      void runActiveModel(model.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.id]);

  const filteredCatalog = useMemo(() => {
    const q = catalogFilter.trim().toLowerCase();
    return MODELS.filter((m) => {
      const fam = modelRegistry?.get(m.id)?.modelFamilyName ?? '';
      return !q || m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q) || fam.toLowerCase().includes(q);
    });
  }, [catalogFilter, modelRegistry]);

  const exportCsv = () => {
    if (!output) return;
    const keys = Object.keys(output.series);
    if (output.t.length > 0 && keys.length > 0) {
      const header = [`time_${model.timeUnit ?? 'ms'}`, ...keys].join(',');
      const lines = [header];
      for (let i = 0; i < output.t.length; i++) {
        lines.push([output.t[i], ...keys.map((k) => output.series[k]![i])].join(','));
      }
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${model.id}-simulation.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const jsonBlob = new Blob([JSON.stringify({ modelId: model.id, config, metrics: output.metrics, notes: output.notes }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(jsonBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${model.id}-results.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const paramGroups = useMemo(() => {
    const groups = new Map<string, typeof model.params>();
    for (const p of model.params) {
      const g = p.group ?? 'Parameters';
      const arr = groups.get(g) ?? [];
      arr.push(p);
      groups.set(g, arr);
    }
    return [...groups.entries()];
  }, [model]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header + Action Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="cx-badge tabular" style={{ color: 'var(--accent-ice-blue)' }}>MOD-08 · COMPUTATIONAL NEUROSCIENCE LAB</span>
            <span className="cx-badge tabular">{model.id}</span>
            {regMeta && <span className="cx-badge">{regMeta.modelFamilyName}</span>}
            <ProvenanceBadge status="THEORETICAL_MODEL" />
          </div>
          <h1 style={{ margin: '4px 0 0', fontSize: 20 }}>{model.name}</h1>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            className="cx-btn cx-btn-primary"
            disabled={blocked || jobStatus === 'RUNNING'}
            onClick={() => runActiveModel(model.id)}
          >
            {jobStatus === 'RUNNING' ? `Running (${Math.round(progress * 100)}%)…` : '▶ Run Simulation'}
          </button>
          {jobStatus === 'RUNNING' && (
            <button type="button" className="cx-btn cx-btn-danger" onClick={cancelActiveJob}>Cancel</button>
          )}
          <button type="button" className="cx-btn" onClick={() => resetModel(model.id)}>Reset Defaults</button>
          <button type="button" className="cx-btn" disabled={!output} onClick={exportCsv}>Export Results</button>
          <EntityRef id={model.id} label="Inspect Model" />
          <Link to="/lab/digital-twin/EXP-040" className="cx-btn">5-Tier Digital Twin →</Link>
        </div>
      </div>

      {/* Model Catalog + 5-Panel Workspace */}
      <div className="cx-split">
        {/* Left Catalog Rail (28 Models) */}
        <div className="cx-card cx-split-side">
          <div className="cx-card-title">Model Catalog ({MODELS.length})</div>
          <input
            type="search"
            className="cx-input"
            placeholder="Filter 28 models or family…"
            value={catalogFilter}
            onChange={(e) => setCatalogFilter(e.target.value)}
            aria-label="Filter computational models"
          />
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(() => {
              const searching = catalogFilter.trim() !== '';
              const row = (m: (typeof MODELS)[number], start: boolean) => {
                const fam = modelRegistry?.get(m.id)?.modelFamilyName;
                const active = m.id === model.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    aria-current={active ? 'true' : undefined}
                    style={{ textAlign: 'left', padding: '7px 9px', borderRadius: 6, border: active ? '1px solid var(--accent-ice-blue)' : '1px solid transparent', background: active ? 'rgba(56,189,248,0.15)' : '#0d1422' }}
                    onClick={() => setActiveModel(m.id)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                      <strong style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.name}>{m.name}</strong>
                      {start ? <span className="cx-badge" style={{ fontSize: 9, flexShrink: 0, color: '#fde68a', borderColor: 'rgba(245,158,11,0.5)' }}>START</span> : <span className="tabular" style={{ fontSize: 10, color: 'var(--accent-ice-blue)', flexShrink: 0 }}>{m.id}</span>}
                    </div>
                    {fam && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{fam}</div>}
                  </button>
                );
              };
              if (searching) return filteredCatalog.length ? filteredCatalog.map((m) => row(m, false)) : <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 6 }}>No model matches this filter.</div>;
              return (
                <>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', padding: '2px 2px 6px' }}>
                    New here? Begin with <strong>Hodgkin–Huxley</strong>, the main model, then follow the groups in order. Each group's first model is marked START.
                  </div>
                  {MODEL_TRACKS.map((t) => (
                    <details key={t.id} open={t.models.includes(model.id) || t.id === 'neuron'} style={{ marginBottom: 4 }}>
                      <summary style={{ cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: '4px 2px' }}>
                        {t.title} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({t.models.length})</span>
                        <div style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-secondary)' }}>{t.blurb}</div>
                      </summary>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                        {t.models.map((id) => MODELS.find((m) => m.id === id)).filter((m): m is NonNullable<typeof m> => !!m).map((m) => row(m, m.id === t.start))}
                      </div>
                    </details>
                  ))}
                </>
              );
            })()}
          </div>
        </div>

        {/* Right 5-Panel Workspace */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {errorMessage && (
            <div className="cx-banner cx-banner-rose" role="alert">{errorMessage}</div>
          )}
          {issues.map((iss, i) => (
            <div key={i} className={`cx-banner ${iss.severity === 'error' ? 'cx-banner-rose' : 'cx-banner-amber'}`}>
              {iss.message}
            </div>
          ))}

          {/* Top Row: Panel 1 (Theory & Presets) + Panel 2 (Experiment Setup) */}
          <div className="cx-grid-2">
            {/* Panel 1: Model & Theory */}
            <div className="cx-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="cx-card-title">
                <span>Panel 1 · Model & Governing Equations</span>
                {regMeta && <span className="cx-badge tabular">{regMeta.primaryScale}</span>}
              </div>
              {regMeta && (
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>{regMeta.biologicalInterpretation}</p>
              )}
              <div style={{ background: '#090d16', padding: 10, borderRadius: 6, overflowX: 'auto' }}>
                {model.equations.map((eq, i) => (
                  <MathFormula key={i} latex={eq} display />
                ))}
              </div>
              {regMeta && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {regMeta.governingEquationIds.map((eqId) => <EntityRef key={eqId} id={eqId} />)}
                </div>
              )}

              {/* Presets */}
              <div style={{ marginTop: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                  Documented Presets ({model.presets.length})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {model.presets.map((pr) => {
                    const isAct = activePresetByModel[model.id] === pr.id;
                    return (
                      <button
                        key={pr.id}
                        type="button"
                        className={`cx-btn${isAct ? ' cx-btn-primary' : ''}`}
                        style={{ fontSize: 11, padding: '4px 8px' }}
                        title={pr.description}
                        onClick={() => applyPreset(model.id, pr.id)}
                      >
                        {pr.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Panel 2: Experiment Setup */}
            <div className="cx-card" style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 540, overflowY: 'auto' }}>
              <div className="cx-card-title">
                <span>Panel 2 · Parameters, Stimulus & Solver</span>
                <span className="tabular" style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 400 }}>
                  {lastElapsedMs !== null ? `Last run: ${lastElapsedMs.toFixed(0)} ms` : ''}
                </span>
              </div>

              {/* Solver, dt, Duration, Seed */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, background: '#0d1422', padding: 8, borderRadius: 6 }}>
                <label style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  Numerical Solver
                  <select className="cx-select" value={config.solver} onChange={(e) => updateRunOption(model.id, { solver: e.target.value as SolverId })}>
                    {model.solvers.map((s) => (
                      <option key={s} value={s}>{SOLVER_INFO[s].name} ({SOLVER_INFO[s].order})</option>
                    ))}
                  </select>
                </label>
                <label style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  Time step dt ({model.timeUnit ?? 'ms'})
                  <input type="number" className="cx-input tabular" step={model.minDtMs} min={model.minDtMs} value={config.dtMs} onChange={(e) => updateRunOption(model.id, { dtMs: Number(e.target.value) })} />
                </label>
                <label style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  Duration ({model.timeUnit ?? 'ms'})
                  <input type="number" className="cx-input tabular" min={1} max={model.maxDurationMs} value={config.durationMs} onChange={(e) => updateRunOption(model.id, { durationMs: Number(e.target.value) })} />
                </label>
                <label style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  PRNG Seed
                  <input type="number" className="cx-input tabular" step={1} value={config.seed} onChange={(e) => updateRunOption(model.id, { seed: Math.round(Number(e.target.value)) })} />
                </label>
              </div>

              {/* Stimulus Builder */}
              {model.stimulus && (
                <div style={{ background: '#0d1422', padding: 8, borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-ice-blue)' }}>
                    Stimulus: {model.stimulus.label} ({model.stimulus.unit})
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
                    <label style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      Waveform
                      <select className="cx-select" value={config.stimulus.kind} onChange={(e) => updateStimulus(model.id, { kind: e.target.value as StimulusKind })}>
                        {model.stimulus.kinds.map((k) => <option key={k} value={k}>{k}</option>)}
                      </select>
                    </label>
                    <label style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      Amplitude ({model.stimulus.unit})
                      <input type="number" className="cx-input tabular" value={config.stimulus.amplitude} onChange={(e) => updateStimulus(model.id, { amplitude: Number(e.target.value) })} />
                    </label>
                    <label style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      Start ({model.timeUnit ?? 'ms'})
                      <input type="number" className="cx-input tabular" value={config.stimulus.startMs} onChange={(e) => updateStimulus(model.id, { startMs: Number(e.target.value) })} />
                    </label>
                  </div>
                </div>
              )}

              {/* Grouped Model Parameters */}
              {paramGroups.map(([grp, specs]) => (
                <div key={grp}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: 4 }}>{grp}</div>
                  {specs.map((spec) => (
                    <ScientificParameterControl
                      key={spec.key}
                      spec={spec}
                      modelId={model.id}
                      value={config.params[spec.key] ?? spec.default}
                      onChange={(val) => updateParam(model.id, spec.key, val)}
                    />
                  ))}
                </div>
              ))}

              {/* Initial Conditions */}
              {model.initial.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: 6 }}>
                    Initial Conditions
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 6, marginTop: 4 }}>
                    {model.initial.map((ic) => (
                      <label key={ic.key} style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {ic.label} ({ic.unit || 'a.u.'})
                        <input
                          type="number"
                          className="cx-input tabular"
                          value={config.initial[ic.key] ?? ic.default}
                          onChange={(e) => updateInitial(model.id, ic.key, Number(e.target.value))}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Panel 3: Experiment Drivers (Single / 1D Sweep / 2D Sweep / Sensitivity / Ensemble) */}
          <div className="cx-card">
            <div className="cx-card-title">
              <span>Panel 3 · Experiment Mode & Multi-Run Workflows</span>
              {jobStatus === 'RUNNING' && <span className="tabular" style={{ fontSize: 12, color: 'var(--accent-ice-blue)' }}>{progressLabel} ({Math.round(progress * 100)}%)</span>}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {([
                ['single', 'Single Simulation'],
                ['sweep', '1D Parameter Sweep'],
                ['sweep2d', '2D Parameter Grid'],
                ['sensitivity', 'OAT Sensitivity (±5%)'],
                ['ensemble', 'Stochastic Ensemble'],
              ] as const).map(([k, lbl]) => (
                <button key={k} type="button" className={`cx-btn${expTab === k ? ' cx-btn-primary' : ''}`} onClick={() => setExpTab(k)}>
                  {lbl}
                </button>
              ))}
            </div>

            {expTab === 'sweep' && sweepFields.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <label style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    Sweep Parameter
                    <select className="cx-select" value={sweepParamKey} onChange={(e) => {
                      const f = sweepFields.find((x) => x.key === e.target.value);
                      setDraft({ paramKey: e.target.value, ...(f ? { from: f.min, to: f.max } : {}) });
                    }}>
                      {sweepFields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                    </select>
                  </label>
                  <label style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    From
                    <input type="number" className="cx-input tabular" style={{ width: 85 }} value={sweepFrom} onChange={(e) => setDraft({ from: Number(e.target.value) })} />
                  </label>
                  <label style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    To
                    <input type="number" className="cx-input tabular" style={{ width: 85 }} value={sweepTo} onChange={(e) => setDraft({ to: Number(e.target.value) })} />
                  </label>
                  <label style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    Steps
                    <input type="number" className="cx-input tabular" style={{ width: 70 }} min={3} max={30} value={sweepSteps} onChange={(e) => setDraft({ steps: Math.max(3, Math.min(30, Number(e.target.value))) })} />
                  </label>
                  <label style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    Output Metric
                    <select className="cx-select" value={sweepMetricKey} onChange={(e) => setDraft({ metricKey: e.target.value })}>
                      {model.metrics.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="cx-btn cx-btn-primary"
                    disabled={jobStatus === 'RUNNING'}
                    onClick={() => runSweepJob(model.id, sweepParamKey, linspaceValues(sweepFrom, sweepTo, sweepSteps))}
                  >
                    Run Sweep
                  </button>
                </div>
                {sweepResult && sweepResult.metrics[sweepMetricKey] && (
                  <CurvePlot
                    title={`1D Sweep: ${sweepResult.paramKey} → ${sweepMetricKey}`}
                    xLabel={sweepResult.paramKey}
                    yLabel={sweepMetricKey}
                    curves={[{ key: 'sweep', label: sweepMetricKey, points: true, curve: { x: sweepResult.values, y: sweepResult.metrics[sweepMetricKey]! } }]}
                  />
                )}
              </div>
            )}

            {expTab === 'sweep2d' && sweepFields.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <label style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    X Parameter
                    <select className="cx-select" value={sweepParamKey} onChange={(e) => setDraft({ paramKey: e.target.value })}>
                      {sweepFields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                    </select>
                  </label>
                  <label style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    Y Parameter
                    <select className="cx-select" value={sweep2YKey} onChange={(e) => setDraft({ yKey: e.target.value })}>
                      {sweepFields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="cx-btn cx-btn-primary"
                    disabled={jobStatus === 'RUNNING'}
                    onClick={() => {
                      const fx = sweepFields.find((x) => x.key === sweepParamKey) ?? sweepFields[0]!;
                      const fy = sweepFields.find((x) => x.key === sweep2YKey) ?? sweepFields[0]!;
                      void runSweep2DJob(model.id, fx.key, linspaceValues(fx.min, fx.max, 5), fy.key, linspaceValues(fy.min, fy.max, 5), sweepMetricKey || model.metrics[0]?.key || '');
                    }}
                  >
                    Run 5×5 Grid Sweep
                  </button>
                </div>
                {sweep2DResult && (
                  <HeatmapCanvas
                    title={`2D Sweep: ${sweep2DResult.metricKey}`}
                    rows={sweep2DResult.y.length}
                    cols={sweep2DResult.x.length}
                    data={sweep2DResult.grid}
                    xLabel={sweep2DResult.keyX}
                    yLabel={sweep2DResult.keyY}
                    height={200}
                  />
                )}
              </div>
            )}

            {expTab === 'sensitivity' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select className="cx-select" value={sweepMetricKey} onChange={(e) => setDraft({ metricKey: e.target.value })}>
                    {model.metrics.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                  </select>
                  <button type="button" className="cx-btn cx-btn-primary" disabled={jobStatus === 'RUNNING'} onClick={() => runSensitivityJob(model.id, sweepMetricKey || model.metrics[0]?.key || '')}>
                    Compute Normalized OAT Sensitivity
                  </button>
                </div>
                {sensResult && (() => {
                  const sorted = [...sensResult.rows].sort((a, b) => Math.abs(b.index) - Math.abs(a.index));
                  const maxAbs = Math.max(0.01, ...sorted.map((r) => Math.abs(r.index)));
                  return (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-strong)', color: 'var(--text-secondary)' }}>
                            <th style={{ padding: 5 }}>Parameter</th>
                            <th style={{ padding: 5 }}>Base</th>
                            <th style={{ padding: 5 }}>−5%</th>
                            <th style={{ padding: 5 }}>+5%</th>
                            <th style={{ padding: 5 }}>Normalized Index S</th>
                            <th style={{ padding: 5, width: 140 }}>Magnitude</th>
                          </tr>
                        </thead>
                        <tbody className="tabular">
                          {sorted.map((r) => {
                            const pct = Math.min(100, (Math.abs(r.index) / maxAbs) * 100);
                            const pos = r.index >= 0;
                            return (
                              <tr key={r.key} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                <td style={{ padding: 5 }}>{r.label}</td>
                                <td style={{ padding: 5 }}>{formatNum(r.base)} {r.unit}</td>
                                <td style={{ padding: 5 }}>{formatNum(r.minus)}</td>
                                <td style={{ padding: 5 }}>{formatNum(r.plus)}</td>
                                <td style={{ padding: 5, color: pos ? 'var(--accent-ice-blue)' : 'var(--accent-indicator-amber)', fontWeight: 600 }}>{formatNum(r.index)}</td>
                                <td style={{ padding: 5 }}>
                                  <div style={{ width: '100%', height: 8, background: 'var(--bg-surface-sub)', borderRadius: 4, overflow: 'hidden' }}>
                                    <div style={{ width: `${pct}%`, height: '100%', background: pos ? 'var(--accent-ice-blue)' : 'var(--accent-indicator-amber)' }} />
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            )}

            {expTab === 'ensemble' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button type="button" className="cx-btn cx-btn-primary" disabled={jobStatus === 'RUNNING'} onClick={() => runEnsembleJob(model.id, [11, 22, 33, 44, 55])}>
                  Run 5-Seed Stochastic Ensemble
                </button>
                {ensResult && (
                  <div className="cx-grid-auto">
                    {model.metrics.map((m) => (
                      <div key={m.key} className="cx-card" style={{ background: '#0d1422', padding: 10 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{m.label}</div>
                        <div className="tabular" style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent-ice-blue)' }}>
                          {formatNum(ensResult.mean[m.key] ?? NaN)} ± {formatNum(ensResult.sd[m.key] ?? NaN)} {m.unit}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Panel 4: Results & Metrics */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {output && (
              <>
                {output.notes.length > 0 && (
                  <div className={`cx-banner ${output.status === 'DIVERGED' ? 'cx-banner-rose' : 'cx-banner-cyan'}`}>
                    {output.notes.map((n, i) => <div key={i}>{n}</div>)}
                  </div>
                )}

                <div className="cx-card">
                  <div className="cx-card-title">Panel 4 · Quantitative Metrics & Outputs</div>
                  <div className="cx-grid-auto">
                    {model.metrics.map((m) => {
                      const val = output.metrics[m.key];
                      return (
                        <div key={m.key} className="cx-card" style={{ background: '#0d1422', padding: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{m.label}</span>
                            {m.analyticId && <EntityRef id={m.analyticId} label="Def" />}
                          </div>
                          <div className="tabular" style={{ fontSize: 17, fontWeight: 700, color: 'var(--accent-ice-blue)', marginTop: 4 }}>
                            {val !== undefined ? formatNum(val) : '—'} {m.unit}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{m.description}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <ModelOutputViews
                  views={model.views}
                  output={output}
                  timeUnit={model.timeUnit ?? 'ms'}
                  onInspectSeries={() => selectEntity(model.id, { openInspector: true })}
                />
              </>
            )}
          </div>

          {/* Panel 5: Validation & Limitations */}
          <div className="cx-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="cx-card-title">Panel 5 · Executable Scientific Validation & Model Limitations</div>
            {modelValCases.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {modelValCases.map((vc) => {
                  const res = validations[vc.id];
                  return (
                    <div key={vc.id} style={{ background: '#0d1422', padding: 10, borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <div>
                          <strong style={{ fontSize: 13 }}>{vc.id}: {vc.title}</strong>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{vc.reference}</div>
                        </div>
                        <button type="button" className="cx-btn cx-btn-primary" disabled={jobStatus === 'RUNNING'} onClick={() => runValidationCase(vc.id)}>
                          {res ? 'Re-run Validation' : 'Run Validation'}
                        </button>
                      </div>
                      {res && (
                        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div className={`cx-badge ${res.passed ? 'cx-banner-emerald' : 'cx-banner-rose'}`} style={{ alignSelf: 'flex-start' }}>
                            {res.passed ? `PASSED (${res.elapsedMs.toFixed(0)} ms)` : 'FAILED'}
                          </div>
                          {res.checks.map((c, idx) => (
                            <div key={idx} className="tabular" style={{ fontSize: 11, display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', padding: '2px 0' }}>
                              <span>{c.passed ? '✓' : '✗'} {c.label}</span>
                              <span>{c.measured} ({c.criterion})</span>
                            </div>
                          ))}
                          {res.discrepancy && (
                            <div className="cx-banner cx-banner-amber" style={{ marginTop: 4 }}>{res.discrepancy}</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Covered by sibling family benchmark cases and deterministic kernel invariants.
              </div>
            )}

            <div className="cx-banner cx-banner-amber">
              <strong>Model Assumptions & Kernel Limitations:</strong>
              <ul style={{ margin: '4px 0 0 16px', padding: 0, fontSize: 12 }}>
                {model.kernelLimitations.map((l, i) => <li key={i}>{l}</li>)}
                {(regMeta?.limitations ?? []).map((l, i) => <li key={`r-${i}`}>{l}</li>)}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
