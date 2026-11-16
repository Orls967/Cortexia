// Dedicated Web Worker for Module 11 signal processing, spectral/wavelet transforms, spike train analysis,
// graph topology/lesion suites and statistical testing.
/// <reference lib="webworker" />
import { amplitudeSpectrum, bandPower, CANONICAL_BANDS, peakFrequency, welchPsd } from '../kernels/analytics/fft';
import { butterworthFilter, demean, designFir, detrendLinear, firFilter } from '../kernels/analytics/filters';
import { clusteringCoefficient, lesionCurve, lesionOrder, smallWorldness, summarizeGraph } from '../kernels/analytics/graph';
import { erpAverage, morletTransform, stft } from '../kernels/analytics/spectral';
import { binnedRates, crossCorrelogram, fanoFactor, firingRates, groupSpikes, isiAnalysis, populationRate, psth, spikeTriggeredAverage, synchronyChi } from '../kernels/analytics/spikes';
import { describe, mannWhitneyU, pearson, permutationTest, polynomialRegression, spearman, welchTTest, type RegressionResult } from '../kernels/analytics/stats';
import { linspace } from '../kernels/core/record';
import { collectTransferables, type AnalyticsJob, type AnalyticsResultMap, type WorkerRequest, type WorkerResponse } from './protocol';

function post(msg: WorkerResponse<unknown>, transfer: Transferable[] = []): void {
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(msg, transfer);
}

export function executeAnalyticsJob(job: AnalyticsJob, onProgress?: (fraction: number, label?: string) => void): AnalyticsResultMap[keyof AnalyticsResultMap] {
  switch (job.kind) {
    case 'signalSuite': {
      let sig: Float64Array<ArrayBufferLike> = Float64Array.from(job.signal);
      if (job.demean) sig = demean(sig);
      if (job.detrend) sig = detrendLinear(sig);
      onProgress?.(0.15, 'Filtering signal');
      if (job.filterMode !== 'none') {
        const spec = job.filterMode === 'bandpass'
          ? { kind: 'bandpass' as const, f1: job.lowHz, f2: job.highHz, order: job.order }
          : { kind: job.filterMode, f1: job.filterMode === 'highpass' ? job.lowHz : job.highHz, order: job.order };
        sig = job.useFir ? firFilter(sig, designFir(spec, job.fs)) : butterworthFilter(sig, job.fs, spec);
      }
      onProgress?.(0.35, 'Computing FFT and Welch PSD');
      const spectrum = amplitudeSpectrum(sig, job.fs, job.window);
      const psd = welchPsd(sig, job.fs, job.welchSegLen, 0.5, job.window);
      onProgress?.(0.6, 'Computing STFT spectrogram');
      const stftRes = stft(sig, job.fs, job.stftWinLen, Math.max(1, Math.floor(job.stftWinLen / 4)), job.window, Math.min(100, job.fs / 2));
      onProgress?.(0.8, 'Computing Morlet wavelet scalogram');
      const dec = Math.max(1, Math.floor(sig.length / 600));
      const wavelet = morletTransform(sig, job.fs, job.waveletFreqs, job.waveletCycles, dec);
      const bandPowers = CANONICAL_BANDS.map((b) => ({ key: b.key, label: b.label, power: bandPower(psd, b.lo, Math.min(b.hi, job.fs / 2)) }));
      const peakHz = peakFrequency(psd, 0.5, job.fs / 2);
      const stats = describe(sig);
      onProgress?.(1, 'Done');
      return { filtered: Float64Array.from(sig), spectrum, psd, stft: stftRes, wavelet, bandPowers, peakHz, stats };
    }
    case 'erp': {
      return erpAverage(job.signal, job.fs, job.triggers, job.preMs, job.postMs);
    }
    case 'spikeSuite': {
      onProgress?.(0.2, 'Grouping spike trains');
      const trains = groupSpikes(job.times, job.ids, job.nNeurons);
      const ratesHz = firingRates(trains, job.durationMs);
      const popRate = populationRate(job.times, job.nNeurons, job.durationMs, 8, Math.max(1, job.binMs));
      const nonEmpty = trains.filter((t) => t.length >= 2);
      const isi = isiAnalysis(nonEmpty.length ? nonEmpty : trains, Math.max(1, job.binMs));
      const uA = trains[Math.min(job.unitA, trains.length - 1)] ?? new Float64Array(0);
      const uB = trains[Math.min(job.unitB, trains.length - 1)] ?? new Float64Array(0);
      onProgress?.(0.6, 'Computing Fano, PSTH, CCG & synchrony');
      const fano = fanoFactor(uA.length ? uA : job.times, job.durationMs, Math.min(200, Math.max(20, job.durationMs / 10)));
      const triggers = Float64Array.from({ length: Math.max(1, Math.floor((job.durationMs - 200) / 250)) }, (_, k) => 100 + k * 250);
      const psthRes = psth(uA.length ? uA : job.times, triggers, 50, 150, Math.max(2, job.binMs));
      const ccg = crossCorrelogram(uA, uB, job.durationMs, 100, Math.max(1, job.binMs));
      const activeTrains = trains.filter((t) => t.length >= 2).slice(0, 120);
      const synchronyChiVal = activeTrains.length >= 2 ? synchronyChi(binnedRates(activeTrains, job.durationMs, Math.max(2, job.binMs), 2)) : NaN;
      const sta = job.lfp && job.lfpFs ? spikeTriggeredAverage(job.lfp, job.lfpFs, uA, 80) : undefined;
      onProgress?.(1, 'Done');
      return { ratesHz, popRate, isi, fano, psth: psthRes, ccg, synchronyChi: synchronyChiVal, ...(sta ? { sta } : {}) };
    }
    case 'networkSuite': {
      onProgress?.(0.25, 'Computing degree, path length, betweenness & Louvain communities');
      const summary = summarizeGraph(job.weights, job.n, job.seed);
      const clusteringLocal = clusteringCoefficient(job.weights, job.n).local;
      onProgress?.(0.55, 'Evaluating small-worldness against null models');
      const sw = job.computeSmallWorld && job.n <= 100 ? smallWorldness(job.weights, job.n, job.seed, 10).sigma : NaN;
      let lesion: AnalyticsResultMap['networkSuite']['lesion'];
      if (job.computeLesion) {
        onProgress?.(0.75, 'Running targeted vs random lesion curve');
        const fractions = linspace(0, 0.7, 15);
        const randC = lesionCurve(job.weights, job.n, lesionOrder(job.weights, job.n, 'random', job.seed), fractions);
        const degC = lesionCurve(job.weights, job.n, lesionOrder(job.weights, job.n, 'degree', job.seed), fractions);
        const btwC = lesionCurve(job.weights, job.n, lesionOrder(job.weights, job.n, 'betweenness', job.seed, job.n <= 80), fractions);
        lesion = {
          fractions,
          randomEff: randC.efficiency,
          degreeEff: degC.efficiency,
          betweennessEff: btwC.efficiency,
          randomLcc: randC.lcc,
          betweennessLcc: btwC.lcc,
        };
      }
      onProgress?.(1, 'Done');
      return { summary, clusteringLocal, smallWorldSigma: sw, ...(lesion ? { lesion } : {}) };
    }
    case 'statsSuite': {
      const statsX = describe(job.x);
      const statsY = job.y ? describe(job.y) : undefined;
      let twoSample: AnalyticsResultMap['statsSuite']['twoSample'];
      let regression: RegressionResult | undefined;
      let correlation: AnalyticsResultMap['statsSuite']['correlation'];
      if (job.y && job.y.length >= 3 && job.x.length >= 3) {
        const w = welchTTest(job.x, job.y);
        const mw = mannWhitneyU(job.x, job.y);
        const perm = permutationTest(job.x, job.y, 1000, job.bootstrapSeed ?? 42);
        twoSample = { ...w, mannWhitneyP: mw.p, permutationP: perm.p };
        if (job.x.length === job.y.length) {
          correlation = { pearson: pearson(job.x, job.y), spearman: spearman(job.x, job.y) };
          if (job.polyDegree !== undefined && job.x.length > job.polyDegree + 2) {
            regression = polynomialRegression(job.x, job.y, job.polyDegree);
          }
        }
      }
      return {
        statsX,
        ...(statsY ? { statsY } : {}),
        ...(twoSample ? { twoSample } : {}),
        ...(regression ? { regression } : {}),
        ...(correlation ? { correlation } : {}),
      };
    }
  }
}

if (typeof self !== 'undefined') {
  self.onmessage = (ev: MessageEvent<WorkerRequest<AnalyticsJob>>) => {
    const { jobId, job } = ev.data;
    const t0 = performance.now();
    try {
      const result = executeAnalyticsJob(job, (fraction, label) => {
        post({ type: 'PROGRESS', jobId, fraction, ...(label !== undefined ? { label } : {}) });
      });
      const elapsedMs = performance.now() - t0;
      const transfers = collectTransferables(result);
      post({ type: 'DONE', jobId, result, elapsedMs }, transfers);
    } catch (err) {
      post({ type: 'ERROR', jobId, code: 'ERR_ANALYTICS_FAILED', message: err instanceof Error ? err.message : String(err) });
    }
  };
}
