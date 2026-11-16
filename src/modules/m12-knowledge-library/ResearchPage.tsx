import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TraceCanvasPlot } from '../../components/charts/TraceCanvasPlot';
import { formatNum } from '../../components/charts/palette';
import { EntityRef } from '../../components/ui/EntityRef';
import { ProvenanceBadge } from '../../components/ui/ProvenanceBadge';
import { useLabStore } from '../../stores/labStore';
import { getCachedRunOutput, useResearchStore } from '../../stores/researchStore';

export function ResearchPage({ tab = 'runs' }: { tab?: 'runs' | 'notebook' }) {
  const runs = useResearchStore((s) => s.runs);
  const compareRunIds = useResearchStore((s) => s.compareRunIds);
  const notebooks = useResearchStore((s) => s.notebooks);
  const activeNotebookId = useResearchStore((s) => s.activeNotebookId);

  const toggleCompareRun = useResearchStore((s) => s.toggleCompareRun);
  const deleteRun = useResearchStore((s) => s.deleteRun);
  const setActiveNotebook = useResearchStore((s) => s.setActiveNotebook);
  const updateNotebook = useResearchStore((s) => s.updateNotebook);
  const createNotebook = useResearchStore((s) => s.createNotebook);
  const exportBundleJson = useResearchStore((s) => s.exportBundleJson);
  const importBundleJson = useResearchStore((s) => s.importBundleJson);

  const loadRunConfig = useLabStore((s) => s.loadRunConfig);
  const runActiveModel = useLabStore((s) => s.runActiveModel);
  const navigate = useNavigate();

  const [newTitle, setNewTitle] = useState('');
  const [importMsg, setImportMsg] = useState<string | null>(null);

  const activeNb = notebooks.find((n) => n.id === activeNotebookId) ?? notebooks[0];
  const comparedRuns = runs.filter((r) => compareRunIds.includes(r.runId));

  const downloadBundle = () => {
    const json = exportBundleJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cortexia-research-bundle-${new Date().toISOString().slice(0, 10)}.cortexia.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Overlay traces if cached outputs share a series key
  const overlayChart = (() => {
    if (comparedRuns.length < 2) return null;
    const outs = comparedRuns.map((r) => ({ run: r, out: getCachedRunOutput(r.runId) })).filter((x) => x.out && x.out.t.length > 1);
    if (outs.length < 2) return null;
    const firstKey = Object.keys(outs[0]!.out!.series)[0];
    if (!firstKey) return null;
    const series = outs
      .filter((x) => x.out!.series[firstKey])
      .map((x, idx) => ({
        key: x.run.runId,
        label: `${x.run.modelId} (${x.run.runId.slice(-4)})`,
        data: x.out!.series[firstKey]!,
        dashed: idx % 2 === 1,
      }));
    if (series.length < 2) return null;
    return <TraceCanvasPlot title={`Multi-Run Overlay (${firstKey})`} x={outs[0]!.out!.t} yLabel={firstKey} series={series} height={210} />;
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <span className="cx-badge tabular" style={{ color: 'var(--accent-ice-blue)' }}>ENV-05 · RESEARCH & REPRODUCIBILITY WORKSPACE</span>
          <h1 style={{ margin: '4px 0 2px', fontSize: 20 }}>Experiment History, Multi-Run Comparison, Notebooks & Reproducible Manifests</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" className="cx-btn cx-btn-primary" onClick={downloadBundle}>
            Export .cortexia.json Bundle
          </button>
          <label className="cx-btn" style={{ cursor: 'pointer' }}>
            Import Bundle
            <input
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                file.text().then((txt) => {
                  try {
                    const res = importBundleJson(txt);
                    setImportMsg(`Imported ${res.importedRuns} runs and ${res.importedNotebooks} notebooks.`);
                  } catch (err) {
                    setImportMsg(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
                  }
                }).catch(() => {});
              }}
            />
          </label>
        </div>
      </div>

      {importMsg && <div className="cx-banner cx-banner-cyan">{importMsg}</div>}

      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" className={`cx-btn${tab === 'runs' ? ' cx-btn-primary' : ''}`} onClick={() => navigate('/research')}>
          Experiment Runs & Comparison ({runs.length})
        </button>
        <button type="button" className={`cx-btn${tab === 'notebook' ? ' cx-btn-primary' : ''}`} onClick={() => navigate('/research/notebook')}>
          Research Notebooks ({notebooks.length})
        </button>
      </div>

      {tab === 'runs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {runs.length === 0 ? (
            <div className="cx-banner cx-banner-cyan">
              No experiment runs recorded yet in this session. Execute any model in the Computational Neuroscience Lab to capture deterministic manifests, seeds, and metrics automatically.
            </div>
          ) : (
            <div className="cx-card" style={{ overflowX: 'auto' }}>
              <div className="cx-card-title">Recorded Deterministic Runs (Click Reproduce to re-execute exact config + seed)</div>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-strong)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: 6 }}>Compare</th>
                    <th style={{ padding: 6 }}>Run ID</th>
                    <th style={{ padding: 6 }}>Model</th>
                    <th style={{ padding: 6 }}>Solver / dt / Seed</th>
                    <th style={{ padding: 6 }}>Status</th>
                    <th style={{ padding: 6 }}>Key Metrics</th>
                    <th style={{ padding: 6 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.runId} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: 6 }}>
                        <input type="checkbox" checked={compareRunIds.includes(r.runId)} onChange={() => toggleCompareRun(r.runId)} aria-label={`Compare ${r.runId}`} />
                      </td>
                      <td className="tabular" style={{ padding: 6 }}>{r.runId}</td>
                      <td style={{ padding: 6 }}>
                        <EntityRef id={r.modelId} label={`${r.modelId}: ${r.modelName}`} />
                      </td>
                      <td className="tabular" style={{ padding: 6, fontSize: 11 }}>
                        {r.config.solver} · dt={r.config.dtMs} · seed={r.config.seed}
                      </td>
                      <td style={{ padding: 6 }}>
                        <ProvenanceBadge status={r.status === 'COMPLETED' ? 'ESTABLISHED' : 'SYNTHETIC_ILLUSTRATIVE'} text={r.status} />
                      </td>
                      <td className="tabular" style={{ padding: 6, fontSize: 11 }}>
                        {Object.entries(r.metrics).slice(0, 3).map(([k, v]) => `${k}=${formatNum(v)}`).join(' · ')}
                      </td>
                      <td style={{ padding: 6, display: 'flex', gap: 4 }}>
                        <button
                          type="button"
                          className="cx-btn cx-btn-primary"
                          style={{ padding: '3px 8px', fontSize: 11 }}
                          onClick={() => {
                            loadRunConfig(r.modelId, r.config);
                            navigate(`/lab/${r.modelId}`);
                            void runActiveModel(r.modelId);
                          }}
                        >
                          Reproduce
                        </button>
                        <button type="button" className="cx-btn cx-btn-danger" style={{ padding: '3px 7px', fontSize: 11 }} onClick={() => deleteRun(r.runId)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {overlayChart}

          {comparedRuns.length > 0 && (
            <div className="cx-card" style={{ overflowX: 'auto' }}>
              <div className="cx-card-title">Side-by-Side Comparison ({comparedRuns.length} selected)</div>
              <div className="cx-grid-auto">
                {comparedRuns.map((r) => (
                  <div key={r.runId} className="cx-card" style={{ background: '#0d1422', padding: 10 }}>
                    <strong className="tabular" style={{ color: 'var(--accent-ice-blue)' }}>{r.runId}</strong>
                    <div style={{ fontSize: 12 }}>{r.modelName}</div>
                    <div className="tabular" style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                      {Object.entries(r.metrics).map(([k, v]) => (
                        <div key={k}>{k}: {formatNum(v)}</div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'notebook' && activeNb && (
        <div className="cx-grid-2">
          <div className="cx-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="cx-card-title">Notebooks</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input type="text" className="cx-input" placeholder="New notebook title…" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} style={{ flex: 1 }} />
              <button type="button" className="cx-btn cx-btn-primary" onClick={() => { createNotebook(newTitle); setNewTitle(''); }}>Create</button>
            </div>
            {notebooks.map((nb) => (
              <button
                key={nb.id}
                type="button"
                className={`cx-btn${nb.id === activeNb.id ? ' cx-btn-primary' : ''}`}
                style={{ justifyContent: 'space-between' }}
                onClick={() => setActiveNotebook(nb.id)}
              >
                <span>{nb.title}</span>
                <span className="tabular" style={{ fontSize: 10 }}>{nb.updatedAt.slice(0, 10)}</span>
              </button>
            ))}
          </div>

          <div className="cx-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              type="text"
              className="cx-input"
              value={activeNb.title}
              onChange={(e) => updateNotebook(activeNb.id, { title: e.target.value })}
              aria-label="Notebook title"
            />
            <textarea
              className="cx-input tabular"
              rows={14}
              value={activeNb.content}
              onChange={(e) => updateNotebook(activeNb.id, { content: e.target.value })}
              aria-label="Research notebook markdown content"
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {activeNb.linkedEntityIds.map((eid) => <EntityRef key={eid} id={eid} />)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
