// Catalog linking each registry analysis method (ANALYTIC-001 … 026) to the kernel functions that implement it and
// to the Analytics workbench where it is used. Verified against analysis-methods.json by the unit tests.

export type AnalyticsWorkspace = 'signals' | 'spikes' | 'networks' | 'stats';

export interface AnalyticMethodImpl {
  id: string;
  workspace: AnalyticsWorkspace;
  module: string;
  functions: string[];
}

const m = (id: string, workspace: AnalyticsWorkspace, module: string, ...functions: string[]): [string, AnalyticMethodImpl] => [id, { id, workspace, module, functions }];

export const ANALYTIC_METHODS: Readonly<Record<string, AnalyticMethodImpl>> = Object.fromEntries([
  m('ANALYTIC-001', 'signals', 'filters', 'designButterworth', 'filtfilt', 'butterworthFilter', 'frequencyResponse'),
  m('ANALYTIC-002', 'signals', 'filters', 'designFir', 'firFilter'),
  m('ANALYTIC-003', 'signals', 'fft', 'fftInPlace', 'amplitudeSpectrum'),
  m('ANALYTIC-004', 'signals', 'fft', 'welchPsd', 'bandPower', 'peakFrequency'),
  m('ANALYTIC-005', 'signals', 'spectral', 'stft'),
  m('ANALYTIC-006', 'signals', 'spectral', 'morletTransform'),
  m('ANALYTIC-007', 'signals', 'spectral', 'erpAverage'),
  m('ANALYTIC-008', 'signals', 'filters', 'commonAverageReference', 'demean', 'detrendLinear', 'zscore', 'detectArtifacts'),
  m('ANALYTIC-009', 'spikes', 'spikes', 'groupSpikes', 'firingRates', 'populationRate'),
  m('ANALYTIC-010', 'spikes', 'spikes', 'isiAnalysis'),
  m('ANALYTIC-011', 'spikes', 'spikes', 'fanoFactor', 'fanoCurve'),
  m('ANALYTIC-012', 'spikes', 'spikes', 'psth'),
  m('ANALYTIC-013', 'spikes', 'spikes', 'spikeTriggeredAverage'),
  m('ANALYTIC-014', 'spikes', 'spikes', 'crossCorrelogram'),
  m('ANALYTIC-015', 'spikes', 'spikes', 'synchronyChi', 'binnedRates', 'phaseLockingValue', 'coherence'),
  m('ANALYTIC-016', 'networks', 'graph', 'degreeMetrics'),
  m('ANALYTIC-017', 'networks', 'graph', 'clusteringCoefficient', 'betweennessCentrality', 'participationCoefficient'),
  m('ANALYTIC-018', 'networks', 'graph', 'distanceMatrix', 'pathMetrics', 'localEfficiency', 'smallWorldness'),
  m('ANALYTIC-019', 'networks', 'graph', 'modularityQ', 'louvain', 'lesionOrder', 'lesionCurve'),
  m('ANALYTIC-020', 'stats', 'stats', 'describe', 'empiricalCdf', 'histogram', 'fitDistribution'),
  m('ANALYTIC-021', 'stats', 'stats', 'pearson', 'spearman', 'correlationMatrix'),
  m('ANALYTIC-022', 'stats', 'stats', 'polynomialRegression'),
  m('ANALYTIC-023', 'stats', 'stats', 'bootstrapCI'),
  m('ANALYTIC-024', 'stats', 'stats', 'welchTTest', 'mannWhitneyU', 'permutationTest', 'benjaminiHochberg'),
  m('ANALYTIC-025', 'stats', 'stats', 'nelderMead', 'fitCurve', 'sensitivityIndex'),
  m('ANALYTIC-026', 'stats', 'stats', 'informationCriteria', 'akaikeWeights'),
]);
