import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CurvePlot } from '../../components/charts/CurvePlot';
import { HeatmapCanvas } from '../../components/charts/HeatmapCanvas';
import { formatNum } from '../../components/charts/palette';
import { RasterCanvasPlot } from '../../components/charts/RasterCanvasPlot';
import { TraceCanvasPlot } from '../../components/charts/TraceCanvasPlot';
import { EntityRef } from '../../components/ui/EntityRef';
import { ProvenanceBadge } from '../../components/ui/ProvenanceBadge';
import { CANONICAL_BANDS } from '../../kernels/analytics/fft';
import { getDatasetPayload, useAnalyticsStore } from '../../stores/analyticsStore';

export function AnalyticsPage() {
  const { workspace = 'signals' } = useParams();
  const datasets = useAnalyticsStore((s) => s.datasets);
  const activeDatasetId = useAnalyticsStore((s) => s.activeDatasetId);
  const activeChannelIdx = useAnalyticsStore((s) => s.activeChannelIdx);
  const signalResult = useAnalyticsStore((s) => s.signalResult);
  const erpResult = useAnalyticsStore((s) => s.erpResult);
  const spikeResult = useAnalyticsStore((s) => s.spikeResult);
  const networkResult = useAnalyticsStore((s) => s.networkResult);
  const statsResult = useAnalyticsStore((s) => s.statsResult);
  const jobStatus = useAnalyticsStore((s) => s.jobStatus);
  const errorMessage = useAnalyticsStore((s) => s.errorMessage);

  const selectDataset = useAnalyticsStore((s) => s.selectDataset);
  const importCsv = useAnalyticsStore((s) => s.importCsv);
  const runSignalSuite = useAnalyticsStore((s) => s.runSignalSuite);
  const runSpikeSuite = useAnalyticsStore((s) => s.runSpikeSuite);
  const runNetworkSuite = useAnalyticsStore((s) => s.runNetworkSuite);
  const runStatsSuite = useAnalyticsStore((s) => s.runStatsSuite);

  // Signal filter parameters
  const [filterMode, setFilterMode] = useState<'none' | 'lowpass' | 'highpass' | 'bandpass' | 'notch'>('bandpass');
  const [lowHz, setLowHz] = useState(1);
  const [highHz, setHighHz] = useState(60);
  const [useFir, setUseFir] = useState(false);
  const [windowKind, setWindowKind] = useState<'hann' | 'hamming' | 'rect'>('hann');
  const [waveletCycles, setWaveletCycles] = useState(7);

  // Spike parameters
  const [binMs, setBinMs] = useState(10);
  const [unitA, setUnitA] = useState(0);
  const [unitB, setUnitB] = useState(1);

  // CSV importer state
  const [csvText, setCsvText] = useState(
    'time_s,Ch1_alpha_beta,Ch2_theta\n' +
    Array.from({ length: 256 }, (_, i) => {
      const t = i / 128;
      return `${t.toFixed(4)},${(15 * Math.sin(2 * Math.PI * 10 * t) + 5 * Math.sin(2 * Math.PI * 22 * t)).toFixed(3)},${(12 * Math.sin(2 * Math.PI * 6 * t)).toFixed(3)}`;
    }).join('\n'),
  );
  const [csvName, setCsvName] = useState('sample_oscillation.csv');
  const [csvFs, setCsvFs] = useState(128);
  const [csvUnits, setCsvUnits] = useState('uV');
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Stats workbench state
  const [groupAStr, setGroupAStr] = useState('12.1, 14.3, 13.8, 15.2, 11.9, 14.7, 13.5, 16.0');
  const [groupBStr, setGroupBStr] = useState('8.4, 9.1, 7.9, 10.2, 8.8, 9.6, 7.5, 9.0');
  const [polyDeg, setPolyDeg] = useState(1);

  const tsDatasets = useMemo(() => datasets.filter((d) => d.kind === 'timeseries'), [datasets]);
  const activeTsMeta = useMemo(
    () => tsDatasets.find((d) => d.id === activeDatasetId) ?? tsDatasets[0],
    [tsDatasets, activeDatasetId],
  );
  const activeTsPayload = activeTsMeta ? getDatasetPayload(activeTsMeta.id) : undefined;
  const spikePayload = getDatasetPayload('DSET-020')?.spikes;
  const netPayload = getDatasetPayload('DSET-021')?.matrix;

  // Auto-run active workspace suite when first visited
  useEffect(() => {
    if (workspace === 'signals' && !signalResult && jobStatus === 'IDLE') {
      void runSignalSuite({ filterMode, lowHz, highHz, order: 4, useFir, demean: true, detrend: false, window: windowKind, welchSegLen: 512, stftWinLen: 256, waveletCycles });
    } else if (workspace === 'spikes' && !spikeResult && jobStatus === 'IDLE') {
      void runSpikeSuite({ binMs, unitA, unitB });
    } else if (workspace === 'networks' && !networkResult && jobStatus === 'IDLE') {
      void runNetworkSuite({ seed: 42, computeSmallWorld: true, computeLesion: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace]);

  const tsTime = useMemo(() => {
    if (!signalResult || !activeTsMeta) return new Float64Array(0);
    return Float64Array.from({ length: signalResult.filtered.length }, (_, i) => i / activeTsMeta.samplingRateHz);
  }, [signalResult, activeTsMeta]);

  const exportAnalysisJson = (name: string, obj: unknown) => {
    const blob = new Blob([JSON.stringify(obj, (_, v) => (ArrayBuffer.isView(v) ? Array.from(v as Float64Array) : v), 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <span className="cx-badge tabular" style={{ color: 'var(--accent-ice-blue)' }}>MOD-11 · NEURAL DATA & SIGNAL ANALYTICS</span>
          <h1 style={{ margin: '4px 0 2px', fontSize: 20 }}>Signal Processing, Spectral Wavelets, Spikes, Graph & Statistical Analytics</h1>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {activeTsMeta && <ProvenanceBadge status={activeTsMeta.provenance} />}
          <EntityRef id="ANALYTIC-004" label="Welch PSD Ref" />
          <EntityRef id="ANALYTIC-021" label="Correlation Ref" />
        </div>
      </div>

      {/* Mandatory Correlation != Causation Guardrail */}
      <div className="cx-banner cx-banner-amber">
        <strong>Scientific Interpretation Guardrail:</strong> Cross-correlation, coherence, phase-locking value (PLV), functional connectivity, and regression quantify statistical association only — <strong>correlation does not establish causal direction</strong>.
      </div>

      {errorMessage && <div className="cx-banner cx-banner-rose">{errorMessage}</div>}

      {/* Workspace Tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {([
          ['signals', 'A. Signals, Filters, PSD, Wavelets & ERP'],
          ['spikes', 'B. Spike Train Suite (Raster/ISI/PSTH/CCG/STA)'],
          ['networks', 'C. Graph & Connectome Metrics'],
          ['stats', 'D. Statistical Workbench'],
          ['import', 'E. CSV Dataset Importer'],
        ] as const).map(([k, lbl]) => (
          <Link key={k} to={`/analytics/${k}`} className={`cx-btn${workspace === k ? ' cx-btn-primary' : ''}`}>
            {lbl}
          </Link>
        ))}
      </div>

      {/* A. SIGNAL SUITE */}
      {workspace === 'signals' && activeTsMeta && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="cx-card" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' }}>
              <label style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 2 }}>
                Dataset
                <select className="cx-select" value={activeTsMeta.id} onChange={(e) => selectDataset(e.target.value, 0)}>
                  {tsDatasets.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
                </select>
              </label>
              <label style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 2 }}>
                Channel ({activeTsMeta.samplingRateHz} Hz, {activeTsMeta.units})
                <select className="cx-select" value={activeChannelIdx} onChange={(e) => selectDataset(activeTsMeta.id, Number(e.target.value))}>
                  {activeTsMeta.channelNames.map((ch, idx) => <option key={ch} value={idx}>{ch}</option>)}
                </select>
              </label>
              <label style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 2 }}>
                Filter
                <select className="cx-select" value={filterMode} onChange={(e) => setFilterMode(e.target.value as typeof filterMode)}>
                  <option value="none">None</option>
                  <option value="bandpass">Band-pass</option>
                  <option value="lowpass">Low-pass</option>
                  <option value="highpass">High-pass</option>
                  <option value="notch">Notch</option>
                </select>
              </label>
              <label style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 2 }}>
                Low (Hz)
                <input type="number" className="cx-input tabular" style={{ width: 65 }} value={lowHz} onChange={(e) => setLowHz(Number(e.target.value))} />
              </label>
              <label style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 2 }}>
                High (Hz)
                <input type="number" className="cx-input tabular" style={{ width: 65 }} value={highHz} onChange={(e) => setHighHz(Number(e.target.value))} />
              </label>
              <label style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 2 }}>
                Filter Type
                <select className="cx-select" value={useFir ? 'fir' : 'iir'} onChange={(e) => setUseFir(e.target.value === 'fir')}>
                  <option value="iir">Butterworth (filtfilt)</option>
                  <option value="fir">Windowed-Sinc FIR</option>
                </select>
              </label>
              <label style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 2 }}>
                Window
                <select className="cx-select" value={windowKind} onChange={(e) => setWindowKind(e.target.value as typeof windowKind)}>
                  <option value="hann">Hann</option>
                  <option value="hamming">Hamming</option>
                  <option value="rect">Rectangular</option>
                </select>
              </label>
              <label style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 2 }}>
                Morlet cycles
                <input type="number" className="cx-input tabular" style={{ width: 65 }} min={3} max={15} value={waveletCycles} onChange={(e) => setWaveletCycles(Number(e.target.value))} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                className="cx-btn cx-btn-primary"
                disabled={jobStatus === 'RUNNING'}
                onClick={() => runSignalSuite({ filterMode, lowHz, highHz, order: 4, useFir, demean: true, detrend: false, window: windowKind, welchSegLen: 512, stftWinLen: 256, waveletCycles })}
              >
                {jobStatus === 'RUNNING' ? 'Computing…' : 'Run Signal Analysis'}
              </button>
              {signalResult && (
                <button type="button" className="cx-btn" onClick={() => exportAnalysisJson(`${activeTsMeta.id}-signal-analysis`, { meta: activeTsMeta, peakHz: signalResult.peakHz, bandPowers: signalResult.bandPowers, stats: signalResult.stats })}>
                  Export JSON
                </button>
              )}
            </div>
          </div>

          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{activeTsMeta.notes}</div>

          {signalResult && (
            <>
              <div className="cx-grid-auto">
                <div className="cx-card" style={{ padding: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Dominant Spectral Peak</div>
                  <div className="tabular" style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-ice-blue)' }}>{signalResult.peakHz.toFixed(2)} Hz</div>
                </div>
                {signalResult.bandPowers.map((b) => (
                  <div key={b.key} className="cx-card" style={{ padding: 10 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{b.label}</div>
                    <div className="tabular" style={{ fontSize: 16, fontWeight: 700 }}>{formatNum(b.power)} {activeTsMeta.units}²</div>
                  </div>
                ))}
              </div>

              <TraceCanvasPlot
                title={`Multichannel & Filtered Signal — ${activeTsMeta.channelNames[activeChannelIdx] ?? 'Ch 1'}`}
                x={tsTime}
                xLabel="time (s)"
                yLabel={activeTsMeta.units}
                series={[
                  { key: 'filtered', label: 'Filtered', unit: activeTsMeta.units, data: signalResult.filtered },
                  ...(activeTsPayload?.channels?.[activeChannelIdx]
                    ? [{ key: 'raw', label: 'Raw', unit: activeTsMeta.units, data: activeTsPayload.channels[activeChannelIdx]!, dashed: true }]
                    : []),
                ]}
                height={210}
              />

              <div className="cx-grid-2">
                <CurvePlot
                  title="Welch Power Spectral Density (ANALYTIC-004)"
                  xLabel="frequency (Hz)"
                  yLabel={`${activeTsMeta.units}²/Hz`}
                  curves={[{ key: 'psd', label: 'Welch PSD', curve: { x: signalResult.psd.freq, y: signalResult.psd.power } }]}
                />
                <HeatmapCanvas
                  title="Complex Morlet Wavelet Scalogram (ANALYTIC-006)"
                  rows={signalResult.wavelet.rows}
                  cols={signalResult.wavelet.cols}
                  data={signalResult.wavelet.power}
                  xLabel="time →"
                  yLabel="frequency (Hz)"
                />
              </div>

              <div className="cx-grid-2">
                <HeatmapCanvas
                  title="STFT Spectrogram (ANALYTIC-005)"
                  rows={signalResult.stft.rows}
                  cols={signalResult.stft.cols}
                  data={signalResult.stft.power}
                  xLabel="window time →"
                  yLabel="frequency bin"
                />
                {erpResult ? (
                  <CurvePlot
                    title={`Event-Related Potential Average (n=${erpResult.trials} trials, ANALYTIC-007)`}
                    xLabel="time relative to trigger (ms)"
                    yLabel={activeTsMeta.units}
                    curves={[{ key: 'erp', label: 'Mean ERP', curve: { x: erpResult.time, y: erpResult.mean } }]}
                  />
                ) : (
                  <div className="cx-card">No event triggers attached to this dataset for ERP averaging.</div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* B. SPIKE TRAIN SUITE */}
      {workspace === 'spikes' && spikePayload && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="cx-card" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <ProvenanceBadge status="SYNTHETIC_BENCHMARK" />
              <label style={{ fontSize: 12 }}>Bin (ms): <input type="number" className="cx-input tabular" style={{ width: 65 }} min={2} max={50} value={binMs} onChange={(e) => setBinMs(Number(e.target.value))} /></label>
              <label style={{ fontSize: 12 }}>Unit A: <input type="number" className="cx-input tabular" style={{ width: 65 }} min={0} max={spikePayload.nNeurons - 1} value={unitA} onChange={(e) => setUnitA(Number(e.target.value))} /></label>
              <label style={{ fontSize: 12 }}>Unit B: <input type="number" className="cx-input tabular" style={{ width: 65 }} min={0} max={spikePayload.nNeurons - 1} value={unitB} onChange={(e) => setUnitB(Number(e.target.value))} /></label>
            </div>
            <button type="button" className="cx-btn cx-btn-primary" onClick={() => runSpikeSuite({ binMs, unitA, unitB })}>
              Recompute Spike Metrics
            </button>
          </div>

          <RasterCanvasPlot
            title="DSET-020 Balanced E/I Spiking Benchmark Raster"
            spikes={{ times: spikePayload.times, ids: spikePayload.ids, n: spikePayload.nNeurons }}
            height={210}
          />

          {spikeResult && (
            <>
              <div className="cx-grid-auto">
                {[
                  ['Mean ISI', `${formatNum(spikeResult.isi.mean)} ms`],
                  ['CV_ISI (ANALYTIC-010)', formatNum(spikeResult.isi.cv)],
                  ['Local CV₂', formatNum(spikeResult.isi.cv2)],
                  ['Fano Factor (ANALYTIC-011)', formatNum(spikeResult.fano.fano)],
                  ['Synchrony Index χ (ANALYTIC-015)', formatNum(spikeResult.synchronyChi)],
                  ['CCG Peak Lag (ANALYTIC-014)', `${formatNum(spikeResult.ccg.peakLagMs)} ms`],
                ].map(([k, v]) => (
                  <div key={String(k)} className="cx-card" style={{ padding: 10 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{k}</div>
                    <div className="tabular" style={{ fontSize: 17, fontWeight: 700, color: 'var(--accent-ice-blue)' }}>{v}</div>
                  </div>
                ))}
              </div>

              <div className="cx-grid-2">
                <TraceCanvasPlot
                  title="Gaussian-Smoothed Population Firing Rate (ANALYTIC-009)"
                  x={spikeResult.popRate.t}
                  xLabel="time (ms)"
                  yLabel="Hz"
                  series={[{ key: 'rate', label: 'Population Rate', unit: 'Hz', data: spikeResult.popRate.rate }]}
                />
                <CurvePlot
                  title="Inter-Spike Interval (ISI) Histogram"
                  xLabel="ISI (ms)"
                  yLabel="count"
                  curves={[{ key: 'isi', label: 'ISI counts', curve: { x: spikeResult.isi.histogram.centers, y: spikeResult.isi.histogram.counts } }]}
                />
                <CurvePlot
                  title={`PSTH (Unit ${unitA}, ANALYTIC-012)`}
                  xLabel="time from trigger (ms)"
                  yLabel="Hz"
                  curves={[{ key: 'psth', label: 'PSTH', curve: { x: spikeResult.psth.t, y: spikeResult.psth.rate } }]}
                />
                <CurvePlot
                  title={`Cross-Correlogram Units ${unitA} vs ${unitB} (ANALYTIC-014)`}
                  xLabel="lag (ms)"
                  yLabel="normalized coincidence"
                  curves={[{ key: 'ccg', label: 'CCG', curve: { x: spikeResult.ccg.lagMs, y: spikeResult.ccg.ccg } }]}
                />
              </div>
              {spikeResult.sta && (
                <CurvePlot
                  title={`Spike-Triggered Average (Unit ${unitA}, ANALYTIC-013)`}
                  xLabel="lag before spike (ms)"
                  yLabel="mean rate proxy"
                  curves={[{ key: 'sta', label: 'STA', curve: { x: spikeResult.sta.lagMs, y: spikeResult.sta.sta } }]}
                />
              )}
            </>
          )}
        </div>
      )}

      {/* C. NETWORK SUITE */}
      {workspace === 'networks' && netPayload && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="cx-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <ProvenanceBadge status="SYNTHETIC_BENCHMARK" text="DSET-021 Synthetic 68-Region Connectome" />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Louvain communities, Brandes betweenness, small-worldness σ & targeted vs random lesion robustness</span>
            </div>
            <button type="button" className="cx-btn cx-btn-primary" onClick={() => runNetworkSuite({ seed: 42, computeSmallWorld: true, computeLesion: true })}>
              Recompute Network Metrics
            </button>
          </div>

          {networkResult && (
            <>
              <div className="cx-grid-auto">
                {[
                  ['Nodes / Edges', `${networkResult.summary.nodes} / ${networkResult.summary.edges}`],
                  ['Mean Degree', networkResult.summary.meanDegree.toFixed(2)],
                  ['Clustering Coeff', networkResult.summary.clustering.toFixed(3)],
                  ['Path Length L', networkResult.summary.pathLength.toFixed(3)],
                  ['Global Efficiency', networkResult.summary.globalEfficiency.toFixed(3)],
                  ['Modularity Q', `${networkResult.summary.modularity.toFixed(3)} (${networkResult.summary.communities} mod)`],
                  ['Small-World σ', formatNum(networkResult.smallWorldSigma)],
                ].map(([k, v]) => (
                  <div key={String(k)} className="cx-card" style={{ padding: 10 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{k}</div>
                    <div className="tabular" style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent-ice-blue)' }}>{v}</div>
                  </div>
                ))}
              </div>
              <div className="cx-grid-2">
                <HeatmapCanvas
                  title="Structural Coupling Weight Matrix (68×68)"
                  rows={netPayload.n}
                  cols={netPayload.n}
                  data={netPayload.weights}
                  rowLabels={netPayload.labels}
                  colLabels={netPayload.labels}
                />
                {networkResult.lesion && (
                  <CurvePlot
                    title="Lesion Robustness: Global Efficiency (Random vs Hub-Targeted)"
                    xLabel="fraction of regions lesioned"
                    yLabel="E_glob(f) / E_glob(0)"
                    curves={[
                      { key: 'rand', label: 'Random removal', curve: { x: networkResult.lesion.fractions, y: networkResult.lesion.randomEff } },
                      { key: 'deg', label: 'Targeted (Strength)', curve: { x: networkResult.lesion.fractions, y: networkResult.lesion.degreeEff } },
                      { key: 'btw', label: 'Targeted (Betweenness)', dashed: true, curve: { x: networkResult.lesion.fractions, y: networkResult.lesion.betweennessEff } },
                    ]}
                  />
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* D. STATISTICAL WORKBENCH */}
      {workspace === 'stats' && (
        <div className="cx-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="cx-card-title">Statistical Workbench (Descriptive, Welch t, Mann–Whitney U, Permutation, Correlation, OLS)</div>
          <div className="cx-grid-2">
            <label style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
              Sample / Predictor X (comma-separated)
              <textarea className="cx-input tabular" rows={3} value={groupAStr} onChange={(e) => setGroupAStr(e.target.value)} />
            </label>
            <label style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
              Sample / Outcome Y (comma-separated)
              <textarea className="cx-input tabular" rows={3} value={groupBStr} onChange={(e) => setGroupBStr(e.target.value)} />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ fontSize: 12 }}>Polynomial Degree: <input type="number" className="cx-input tabular" style={{ width: 60 }} min={1} max={4} value={polyDeg} onChange={(e) => setPolyDeg(Number(e.target.value))} /></label>
            <button
              type="button"
              className="cx-btn cx-btn-primary"
              onClick={() => {
                const parseNums = (s: string) => Float64Array.from(s.split(/[,\s]+/).map(Number).filter(Number.isFinite));
                const x = parseNums(groupAStr);
                const y = parseNums(groupBStr);
                if (x.length >= 3) void runStatsSuite(x, y.length >= 3 ? y : undefined, polyDeg);
              }}
            >
              Compute Statistical Tests
            </button>
          </div>
          {statsResult && (
            <div className="cx-grid-2" style={{ fontSize: 12 }}>
              <div className="cx-card" style={{ background: '#0d1422' }}>
                <strong>Descriptive Summary</strong>
                <div className="tabular" style={{ marginTop: 6 }}>
                  <div>X: n={statsResult.statsX.n}, mean={formatNum(statsResult.statsX.mean)} ± {formatNum(statsResult.statsX.sd)}, median={formatNum(statsResult.statsX.median)}</div>
                  {statsResult.statsY && (
                    <div>Y: n={statsResult.statsY.n}, mean={formatNum(statsResult.statsY.mean)} ± {formatNum(statsResult.statsY.sd)}, median={formatNum(statsResult.statsY.median)}</div>
                  )}
                </div>
              </div>
              {statsResult.twoSample && (
                <div className="cx-card" style={{ background: '#0d1422' }}>
                  <strong>Two-Sample & Association Tests</strong>
                  <div className="tabular" style={{ marginTop: 6 }}>
                    <div>Welch t = {formatNum(statsResult.twoSample.t)} (p = {formatNum(statsResult.twoSample.p)}, Cohen d = {formatNum(statsResult.twoSample.cohenD)})</div>
                    <div>Mann–Whitney U p = {formatNum(statsResult.twoSample.mannWhitneyP)} · Permutation p = {formatNum(statsResult.twoSample.permutationP)}</div>
                    {statsResult.correlation && (
                      <div>Pearson r = {formatNum(statsResult.correlation.pearson.r)} (p={formatNum(statsResult.correlation.pearson.p)}) · Spearman ρ = {formatNum(statsResult.correlation.spearman.r)}</div>
                    )}
                    {statsResult.regression && (
                      <div>OLS R² = {formatNum(statsResult.regression.r2)} (adj R² = {formatNum(statsResult.regression.adjustedR2)})</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* E. CSV DATASET IMPORTER */}
      {workspace === 'import' && (
        <div className="cx-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="cx-card-title">CSV Time-Series Dataset Importer & Validator</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="file"
              accept=".csv,.tsv,.txt"
              aria-label="Upload CSV file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setCsvName(file.name);
                file.text().then(setCsvText).catch(() => {});
              }}
            />
            <label style={{ fontSize: 12 }}>Sampling Hz: <input type="number" className="cx-input tabular" style={{ width: 85 }} value={csvFs} onChange={(e) => setCsvFs(Number(e.target.value))} /></label>
            <label style={{ fontSize: 12 }}>Units: <input type="text" className="cx-input" style={{ width: 80 }} value={csvUnits} onChange={(e) => setCsvUnits(e.target.value)} /></label>
          </div>
          <textarea className="cx-input tabular" rows={7} value={csvText} onChange={(e) => setCsvText(e.target.value)} aria-label="CSV preview or paste area" />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              className="cx-btn cx-btn-primary"
              onClick={() => {
                const res = importCsv(csvText, csvName, csvFs, csvUnits);
                setImportStatus(res.ok ? `Imported ${res.meta!.title} (${res.meta!.sampleCount} samples). Switch to Signal Lab to analyze.` : `Error: ${res.error}`);
              }}
            >
              Validate & Import CSV
            </button>
            <Link to="/analytics/signals" className="cx-btn">Open in Signal Lab →</Link>
          </div>
          {importStatus && (
            <div className={`cx-banner ${importStatus.startsWith('Error') ? 'cx-banner-rose' : 'cx-banner-emerald'}`}>
              {importStatus}
            </div>
          )}
        </div>
      )}

      {/* Reference list of implemented methods */}
      <div className="cx-card">
        <div className="cx-card-title">Implemented Signal, Spike & Graph Analysis Kernels ({CANONICAL_BANDS.length} bands · 26 Methods)</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {Array.from({ length: 26 }, (_, i) => `ANALYTIC-${String(i + 1).padStart(3, '0')}`).map((id) => (
            <EntityRef key={id} id={id} />
          ))}
        </div>
      </div>
    </div>
  );
}
