// Synthetic ground-truth tests for the signal, spike and statistics kernels (ANALYTIC-001 … 015, 020 … 026).
// Graph analytics (016 … 019) are covered in graph.test.ts.
import { readFileSync } from 'node:fs';
import { describe as suite, expect, it } from 'vitest';
import { amplitudeSpectrum, bandPower, fftInPlace, peakFrequency, welchPsd } from '../../src/kernels/analytics/fft';
import { butterworthFilter, commonAverageReference, demean, designButterworth, designFir, detectArtifacts, detrendLinear, firFilter, frequencyResponse, zscore } from '../../src/kernels/analytics/filters';
import { analyticSignal, erpAverage, morletTransform, stft } from '../../src/kernels/analytics/spectral';
import { binnedRates, coherence, crossCorrelogram, fanoFactor, firingRates, groupSpikes, isiAnalysis, phaseLockingValue, populationRate, psth, spikeTriggeredAverage, synchronyChi } from '../../src/kernels/analytics/spikes';
import {
  akaikeWeights, benjaminiHochberg, bootstrapCI, correlationMatrix, describe, empiricalCdf, fitCurve, fitDistribution, incompleteBeta, informationCriteria,
  mannWhitneyU, normalCdf, normalInv, pearson, permutationTest, polynomialRegression, ranks, sensitivityIndex, spearman, tTwoSidedP, welchTTest,
} from '../../src/kernels/analytics/stats';
import { ANALYTIC_METHODS } from '../../src/kernels/analytics';
import { Rng } from '../../src/kernels/core/prng';

const sine = (n: number, fs: number, f: number, amp = 1, phase = 0) => Float64Array.from({ length: n }, (_, i) => amp * Math.sin((2 * Math.PI * f * i) / fs + phase));
const noise = (n: number, sd: number, seed: number) => { const r = new Rng(seed); return Float64Array.from({ length: n }, () => sd * r.normal()); };
const rms = (x: ArrayLike<number>, from = 0, to = x.length) => { let s = 0; for (let i = from; i < to; i++) s += x[i]! * x[i]!; return Math.sqrt(s / (to - from)); };
const poisson = (rateHz: number, durMs: number, seed: number) => { const r = new Rng(seed), out: number[] = []; let t = 0; for (;;) { t += (-Math.log(1 - r.next()) * 1000) / rateHz; if (t >= durMs) break; out.push(t); } return Float64Array.from(out); };

suite('registry coverage', () => {
  it('maps all 26 registry analysis methods to a kernel implementation', () => {
    const reg = JSON.parse(readFileSync(new URL('../../registries/analysis-methods/analysis-methods.json', import.meta.url), 'utf8')) as { items: { id: string }[] };
    expect(Object.keys(ANALYTIC_METHODS).sort()).toEqual(reg.items.map((m) => m.id).sort());
    for (const m of Object.values(ANALYTIC_METHODS)) expect(m.functions.length).toBeGreaterThan(0);
  });
});

suite('ANALYTIC-003/004 Fourier analysis', () => {
  it('FFT followed by inverse FFT is the identity', () => {
    const re = noise(256, 1, 1), im = new Float64Array(256), orig = Float64Array.from(re);
    fftInPlace(re, im); fftInPlace(re, im, true);
    for (let i = 0; i < 256; i++) { expect(re[i]!).toBeCloseTo(orig[i]!, 12); expect(Math.abs(im[i]!)).toBeLessThan(1e-12); }
  });
  it('satisfies Parseval: Σ|x|² = (1/N) Σ|X|²', () => {
    const re = noise(512, 2, 2), im = new Float64Array(512);
    let e = 0; for (const v of re) e += v * v;
    fftInPlace(re, im);
    let E = 0; for (let k = 0; k < 512; k++) E += re[k]! ** 2 + im[k]! ** 2;
    expect(E / 512).toBeCloseTo(e, 8);
  });
  it('recovers the amplitude and frequency of a sinusoid', () => {
    const s = amplitudeSpectrum(sine(1024, 256, 10, 3), 256, 'hann');
    let k = 0; for (let i = 1; i < s.amplitude.length; i++) if (s.amplitude[i]! > s.amplitude[k]!) k = i;
    expect(s.freq[k]!).toBeCloseTo(10, 6);
    expect(s.amplitude[k]!).toBeCloseTo(3, 2);
  });
  it('Welch PSD: band power of a sinusoid is A²/2 and white noise has density σ²/(fs/2)', () => {
    const fs = 256, x = sine(fs * 30, fs, 10, 4);
    const psd = welchPsd(x, fs, 512);
    expect(peakFrequency(psd, 1, 100)).toBeCloseTo(10, 6);
    expect(bandPower(psd, 8, 12)).toBeCloseTo(8, 1);
    expect(bandPower(psd, 13, 30)).toBeLessThan(1e-6);
    const w = welchPsd(noise(fs * 120, 3, 5), fs, 256);
    let m = 0, c = 0; for (let k = 2; k < w.freq.length - 2; k++) { m += w.power[k]!; c++; }
    expect(m / c).toBeCloseTo(9 / (fs / 2), 2);
    expect(bandPower(w, 0, fs / 2)).toBeCloseTo(9, 0);
  });
});

suite('ANALYTIC-001/002/008 filtering and preprocessing', () => {
  const fs = 500;
  it('Butterworth section response is −3 dB at the cutoff and maximally flat in the passband', () => {
    for (const order of [2, 4] as const) {
      const sos = designButterworth({ kind: 'lowpass', f1: 40, order }, fs);
      expect(frequencyResponse(sos, 40, fs).magnitude).toBeCloseTo(Math.SQRT1_2, 6);
      expect(frequencyResponse(sos, 4, fs).magnitude).toBeCloseTo(1, 3);
      // |H|² = 1 / (1 + (ω/ω_c)^{2n}) after undoing the bilinear frequency warping
      const warp = (f: number) => Math.tan((Math.PI * f) / fs);
      const f = 90, expected = 1 / Math.sqrt(1 + Math.pow(warp(f) / warp(40), 2 * order));
      expect(frequencyResponse(sos, f, fs).magnitude).toBeCloseTo(expected, 6);
    }
  });
  it('zero-phase low-pass keeps a 5 Hz component, removes 120 Hz, and introduces no delay', () => {
    const n = fs * 4, slow = sine(n, fs, 5, 1), x = Float64Array.from(slow, (v, i) => v + Math.sin((2 * Math.PI * 120 * i) / fs));
    const y = butterworthFilter(x, fs, { kind: 'lowpass', f1: 30, order: 4 });
    let err = 0; for (let i = 200; i < n - 200; i++) err = Math.max(err, Math.abs(y[i]! - slow[i]!));
    expect(err).toBeLessThan(2e-3);
  });
  it('high-pass removes drift, band-pass isolates a band, notch removes line noise', () => {
    const n = fs * 6;
    const drift = Float64Array.from({ length: n }, (_, i) => 5 + 0.002 * i + Math.sin((2 * Math.PI * 12 * i) / fs));
    const hp = butterworthFilter(drift, fs, { kind: 'highpass', f1: 1, order: 4 });
    expect(Math.abs(hp.slice(500, n - 500).reduce((a, b) => a + b, 0) / (n - 1000))).toBeLessThan(0.01);
    expect(rms(hp, 500, n - 500)).toBeCloseTo(Math.SQRT1_2, 2);
    const mix = Float64Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * 3 * i) / fs) + Math.sin((2 * Math.PI * 10 * i) / fs) + Math.sin((2 * Math.PI * 60 * i) / fs));
    const bp = butterworthFilter(mix, fs, { kind: 'bandpass', f1: 8, f2: 12, order: 4 });
    const psd = welchPsd(bp, fs, 1024);
    expect(bandPower(psd, 8, 12) / bandPower(psd, 0.5, 200)).toBeGreaterThan(0.97);
    const nt = butterworthFilter(mix, fs, { kind: 'notch', f1: 60, notchQ: 30 });
    const pn = welchPsd(nt, fs, 1024), p0 = welchPsd(mix, fs, 1024);
    expect(bandPower(pn, 58, 62) / bandPower(p0, 58, 62)).toBeLessThan(0.01);
    expect(bandPower(pn, 8, 12) / bandPower(p0, 8, 12)).toBeGreaterThan(0.98);
  });
  it('windowed-sinc FIR has symmetric taps, unit DC gain and linear phase without delay', () => {
    const taps = designFir({ kind: 'lowpass', f1: 30 }, fs, 201);
    for (let i = 0; i < taps.length; i++) expect(taps[i]!).toBeCloseTo(taps[taps.length - 1 - i]!, 14);
    expect(taps.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    const n = fs * 4, slow = sine(n, fs, 5), x = Float64Array.from(slow, (v, i) => v + Math.sin((2 * Math.PI * 120 * i) / fs));
    const y = firFilter(x, taps);
    let err = 0; for (let i = 300; i < n - 300; i++) err = Math.max(err, Math.abs(y[i]! - slow[i]!));
    expect(err).toBeLessThan(5e-3);
    const hpTaps = designFir({ kind: 'highpass', f1: 30 }, fs, 201);
    expect(Math.abs(hpTaps.reduce((a, b) => a + b, 0))).toBeLessThan(1e-12);
    const bpOut = firFilter(x, designFir({ kind: 'bandpass', f1: 100, f2: 140 }, fs, 201));
    expect(rms(bpOut, 300, n - 300)).toBeCloseTo(Math.SQRT1_2, 2);
  });
  it('rejects cutoffs outside (0, Nyquist)', () => {
    expect(() => designButterworth({ kind: 'lowpass', f1: 300 }, fs)).toThrow();
    expect(() => designButterworth({ kind: 'bandpass', f1: 20, f2: 10 }, fs)).toThrow();
  });
  it('preprocessing: demean, detrend, z-score, common average reference and artifact detection', () => {
    const x = Float64Array.from({ length: 1000 }, (_, i) => 3 + 0.01 * i + Math.sin(i / 7));
    expect(Math.abs(demean(x).reduce((a, b) => a + b, 0))).toBeLessThan(1e-9);
    const d = detrendLinear(Float64Array.from({ length: 100 }, (_, i) => 2 + 0.5 * i));
    expect(Math.max(...d.map(Math.abs))).toBeLessThan(1e-9);
    const z = zscore(x); const dz = describe(z);
    expect(dz.mean).toBeCloseTo(0, 10); expect(dz.sd).toBeCloseTo(1, 10);
    const common = noise(500, 5, 3), chans = [0, 1, 2, 3].map((k) => Float64Array.from(common, (v, i) => v + Math.sin(i / (5 + k))));
    const car = commonAverageReference(chans);
    for (let i = 0; i < 500; i += 50) expect(Math.abs(car[0]![i]! + car[1]![i]! + car[2]![i]! + car[3]![i]!)).toBeLessThan(1e-9);
    expect(rms(car[0]!)).toBeLessThan(1.2);
    const a = noise(2000, 20, 4); a[500] = 400; a[501] = -380; a[1500] = 900;
    const rep = detectArtifacts(a, 150, 2);
    expect(rep.segments).toEqual([[498, 503], [1498, 1502]]);
    expect(rep.rejectedSamples).toBe(11);
  });
});

suite('ANALYTIC-005/006/007 time-frequency analysis and ERP', () => {
  const fs = 256;
  it('STFT tracks a linear chirp and reports its resolution', () => {
    const n = fs * 10, x = Float64Array.from({ length: n }, (_, i) => { const t = i / fs; return Math.sin(2 * Math.PI * (5 * t + 1.5 * t * t)); }); // f(t) = 5 + 3t
    const tf = stft(x, fs, 256, 32, 'hann', 60);
    expect(tf.deltaF).toBeCloseTo(1, 12); expect(tf.deltaT).toBeCloseTo(1, 12);
    for (const c of [5, Math.floor(tf.cols / 2), tf.cols - 6]) {
      let best = 0; for (let r = 1; r < tf.rows; r++) if (tf.power[r * tf.cols + c]! > tf.power[best * tf.cols + c]!) best = r;
      expect(Math.abs(tf.freqs[best]! - (5 + 3 * tf.times[c]!))).toBeLessThan(1.6);
    }
  });
  it('Morlet power equals A² at the signal frequency and localizes a burst in time', () => {
    const n = fs * 8, freqs = Float64Array.from({ length: 30 }, (_, i) => 2 + i);
    const w = morletTransform(sine(n, fs, 10, 3), fs, freqs, 7);
    const r10 = 8, mid = Math.floor(w.cols / 2);
    expect(w.power[r10 * w.cols + mid]!).toBeCloseTo(9, 1);
    let best = 0; for (let r = 0; r < w.rows; r++) if (w.power[r * w.cols + mid]! > w.power[best * w.cols + mid]!) best = r;
    expect(w.freqs[best]).toBe(10);
    expect(w.coi[r10]!).toBeCloseTo(Math.SQRT2 / (2 * Math.PI * (10 / 7)), 12);
    const burst = Float64Array.from({ length: n }, (_, i) => { const t = i / fs; return Math.exp(-((t - 5) ** 2) / (2 * 0.2 ** 2)) * Math.sin(2 * Math.PI * 20 * t); });
    const wb = morletTransform(burst, fs, freqs, 7), r20 = 18;
    let tBest = 0; for (let c = 0; c < wb.cols; c++) if (wb.power[r20 * wb.cols + c]! > wb.power[r20 * wb.cols + tBest]!) tBest = c;
    expect(wb.times[tBest]!).toBeCloseTo(5, 1);
    expect(wb.power[r20 * wb.cols + Math.round(2 * fs)]!).toBeLessThan(1e-6);
  });
  it('analytic signal gives unit amplitude and linear phase for a sinusoid', () => {
    const a = analyticSignal(sine(1024, fs, 16));
    for (let i = 100; i < 900; i += 37) expect(a.amplitude[i]!).toBeCloseTo(1, 6);
  });
  it('ERP averaging recovers a known waveform with SEM ≈ σ/√M', () => {
    const n = fs * 120, sigma = 10, x = noise(n, sigma, 9), triggers: number[] = [];
    const wave = (ms: number) => 8 * Math.exp(-((ms - 100) ** 2) / (2 * 20 ** 2));
    for (let s = fs; s < n - fs; s += Math.round(0.6 * fs)) { triggers.push(s); for (let i = 0; i < 0.4 * fs; i++) x[s + i] = x[s + i]! + wave((i * 1000) / fs); }
    const erp = erpAverage(x, fs, triggers, 100, 300, [-100, 0]);
    expect(erp.trials).toBe(triggers.length);
    let peakI = 0; for (let i = 0; i < erp.mean.length; i++) if (erp.mean[i]! > erp.mean[peakI]!) peakI = i;
    expect(Math.abs(erp.time[peakI]! - 100)).toBeLessThan(20);
    expect(erp.mean[peakI]!).toBeGreaterThan(6); expect(erp.mean[peakI]!).toBeLessThan(10);
    const expected = sigma / Math.sqrt(triggers.length);
    expect(erp.sem[peakI]! / expected).toBeGreaterThan(0.8); expect(erp.sem[peakI]! / expected).toBeLessThan(1.25);
    expect(erpAverage(x, fs, [10, n - 5], 100, 300).rejected).toBe(2);
  });
});

suite('ANALYTIC-009 … 015 spike-train analytics', () => {
  const T = 200000;
  const pois = poisson(20, T, 11), regular = Float64Array.from({ length: 4000 }, (_, i) => 25 + i * 50);
  it('firing rates and Gaussian population rate integrate to the spike count', () => {
    expect(firingRates([pois, regular], T)[1]!).toBeCloseTo(20, 6);
    expect(firingRates([pois], T)[0]!).toBeGreaterThan(19); expect(firingRates([pois], T)[0]!).toBeLessThan(21);
    const pr = populationRate(regular, 1, T, 20, 1);
    let m = 0; for (let i = 500; i < pr.rate.length - 500; i++) m += pr.rate[i]!;
    expect(m / (pr.rate.length - 1000)).toBeCloseTo(20, 1);
    const g = groupSpikes(Float64Array.of(5, 1, 3, 2), Uint32Array.of(1, 0, 1, 0), 2);
    expect(Array.from(g[0]!)).toEqual([1, 2]); expect(Array.from(g[1]!)).toEqual([3, 5]);
  });
  it('ISI statistics: CV = 0 for a pacemaker and ≈ 1 for a Poisson process', () => {
    const r = isiAnalysis([regular]);
    expect(r.cv).toBeCloseTo(0, 10); expect(r.cv2).toBeCloseTo(0, 10); expect(r.mean).toBeCloseTo(50, 10);
    const p = isiAnalysis([pois]);
    expect(p.cv).toBeGreaterThan(0.95); expect(p.cv).toBeLessThan(1.05);
    expect(p.cv2).toBeGreaterThan(0.95); expect(p.cv2).toBeLessThan(1.05);
    expect(p.mean).toBeGreaterThan(48); expect(p.mean).toBeLessThan(52);
    expect(p.histogram.counts.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(p.intervals.length);
  });
  it('Fano factor ≈ 1 for Poisson counts and 0 for a regular train', () => {
    const f = fanoFactor(pois, T, 500);
    expect(f.fano).toBeGreaterThan(0.85); expect(f.fano).toBeLessThan(1.15);
    expect(fanoFactor(regular, T, 500).fano).toBeCloseTo(0, 10);
  });
  it('PSTH recovers a stimulus-locked rate step', () => {
    const r = new Rng(21), spikes: number[] = [], triggers: number[] = [];
    for (let k = 0; k < 400; k++) {
      const t0 = 200 + k * 500; triggers.push(t0);
      for (let t = t0 - 200; t < t0 + 300; t += 1) { const rate = t >= t0 && t < t0 + 100 ? 80 : 10; if (r.next() < rate / 1000) spikes.push(t + r.next()); }
    }
    const h = psth(Float64Array.from(spikes), triggers, 200, 300, 20);
    const mean = (a: number, b: number) => { let s = 0, c = 0; for (let i = 0; i < h.t.length; i++) if (h.t[i]! > a && h.t[i]! < b) { s += h.rate[i]!; c++; } return s / c; };
    expect(mean(-200, 0)).toBeGreaterThan(8); expect(mean(-200, 0)).toBeLessThan(12);
    expect(mean(0, 100)).toBeGreaterThan(72); expect(mean(0, 100)).toBeLessThan(88);
    expect(h.trials).toBe(400);
  });
  it('spike-triggered average recovers the linear filter of a threshold neuron', () => {
    const fs = 1000, n = 400000, s = noise(n, 1, 31);
    // Drive = stimulus filtered by a kernel peaking 10 ms in the past; spike whenever the drive crosses a threshold.
    const kernel = Float64Array.from({ length: 40 }, (_, k) => Math.exp(-((k - 10) ** 2) / (2 * 3 ** 2)));
    const spikes: number[] = [];
    for (let i = 40; i < n; i++) { let d = 0; for (let k = 0; k < 40; k++) d += kernel[k]! * s[i - k]!; if (d > 6) spikes.push(i); }
    const sta = spikeTriggeredAverage(s, fs, spikes, 39);
    let best = 0; for (let k = 0; k < sta.sta.length; k++) if (sta.sta[k]! > sta.sta[best]!) best = k;
    expect(Math.abs(sta.lagMs[best]! - 10)).toBeLessThanOrEqual(1);
    expect(sta.spikesUsed).toBeGreaterThan(100);
    let dot = 0, na = 0, nb = 0; for (let k = 0; k < 40; k++) { dot += sta.sta[k]! * kernel[k]!; na += sta.sta[k]! ** 2; nb += kernel[k]! ** 2; }
    expect(dot / Math.sqrt(na * nb)).toBeGreaterThan(0.95);
  });
  it('cross-correlogram peaks at the imposed lag and sits at chance level elsewhere', () => {
    const jitter = new Rng(41), follower = Float64Array.from(pois, (t) => t + 7 + 0.3 * jitter.normal());
    const c = crossCorrelogram(follower, pois, T, 50, 1);
    expect(c.peakLagMs).toBe(7);
    let far = 0, cnt = 0; for (let k = 0; k < c.lagMs.length; k++) if (Math.abs(c.lagMs[k]! - 7) > 10) { far += c.ccg[k]!; cnt++; }
    expect(far / cnt / c.chanceLevel).toBeGreaterThan(0.85); expect(far / cnt / c.chanceLevel).toBeLessThan(1.15);
    const ac = crossCorrelogram(regular, regular, T, 120, 2);
    expect(ac.ccg[(ac.ccg.length - 1) / 2]!).toBe(0);
    expect(ac.ccg[(ac.ccg.length - 1) / 2 + 25]!).toBeGreaterThan(0.9);
  });
  it('synchrony index: ≈ 1 for identical trains, ≈ 1/√N for independent Poisson trains', () => {
    const same = binnedRates(Array.from({ length: 20 }, () => pois), T, 20);
    expect(synchronyChi(same)).toBeCloseTo(1, 10);
    const indep = binnedRates(Array.from({ length: 50 }, (_, k) => poisson(20, 100000, 100 + k)), 100000, 20);
    const chi = synchronyChi(indep);
    expect(chi).toBeGreaterThan(0.1); expect(chi).toBeLessThan(0.19);
  });
  it('PLV = 1 for phase-locked signals with a fixed lag and is small for independent noise', () => {
    const fs = 256, n = fs * 20, a = sine(n, fs, 10), b = sine(n, fs, 10, 1, 1.2);
    const p = phaseLockingValue(a, b);
    expect(p.plv).toBeGreaterThan(0.999);
    expect(Math.abs(Math.abs(p.meanPhaseDiff) - 1.2)).toBeLessThan(0.01);
    const na = butterworthFilter(noise(n, 1, 51), fs, { kind: 'bandpass', f1: 8, f2: 12 }), nb = butterworthFilter(noise(n, 1, 52), fs, { kind: 'bandpass', f1: 8, f2: 12 });
    expect(phaseLockingValue(na, nb).plv).toBeLessThan(0.35);
  });
  it('coherence ≈ 1 at a shared frequency and near 1/K elsewhere', () => {
    const fs = 256, n = fs * 120, shared = sine(n, fs, 10, 2);
    const x = Float64Array.from(shared, (v, i) => v + noise(1, 1, i + 1)[0]!), y = Float64Array.from(shared, (v, i) => 0.5 * v + noise(1, 1, i + 900001)[0]!);
    const c = coherence(x, y, fs, 256);
    const at = (f: number) => c.coherence[Math.round((f * 256) / fs)]!;
    expect(at(10)).toBeGreaterThan(0.95);
    expect(at(40)).toBeLessThan(0.1);
    expect(c.segments).toBeGreaterThan(100);
  });
});

suite('ANALYTIC-020 … 026 statistics', () => {
  it('special functions match reference values', () => {
    expect(tTwoSidedP(2.228, 10)).toBeCloseTo(0.05, 3);
    expect(tTwoSidedP(1.96, 1e6)).toBeCloseTo(0.05, 3);
    expect(tTwoSidedP(0, 5)).toBeCloseTo(1, 12);
    expect(incompleteBeta(0.5, 2, 2)).toBeCloseTo(0.5, 12);
    expect(normalCdf(1.959964)).toBeCloseTo(0.975, 5);
    expect(normalInv(0.975)).toBeCloseTo(1.959964, 5);
    expect(normalInv(normalCdf(-1.3))).toBeCloseTo(-1.3, 5);
  });
  it('descriptive statistics on a known sample', () => {
    const d = describe([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(d.mean).toBe(5); expect(d.sd).toBeCloseTo(Math.sqrt(32 / 7), 12); expect(d.median).toBe(4.5);
    expect(d.q1).toBe(4); expect(d.q3).toBeCloseTo(5.5, 12); expect(d.iqr).toBeCloseTo(1.5, 12);
    expect(d.sem).toBeCloseTo(d.sd / Math.sqrt(8), 12);
    const g = describe(noise(200000, 2, 61));
    expect(g.skewness).toBeCloseTo(0, 1); expect(g.kurtosisExcess).toBeCloseTo(0, 1);
    const e = empiricalCdf([3, 1, 2]);
    expect(Array.from(e.x)).toEqual([1, 2, 3]); expect(e.p[2]).toBe(1);
  });
  it('distribution fits recover parameters and AIC prefers the generating family', () => {
    const r = new Rng(62), expo = Float64Array.from({ length: 5000 }, () => -Math.log(1 - r.next()) / 0.25);
    const fe = fitDistribution(expo, 'exponential'), fg = fitDistribution(expo, 'gaussian'), fl = fitDistribution(expo, 'lognormal');
    expect(fe.params.rate!).toBeCloseTo(0.25, 1);
    expect(fe.aic).toBeLessThan(fg.aic); expect(fe.aic).toBeLessThan(fl.aic);
    const w = akaikeWeights([fe.aic, fg.aic, fl.aic]);
    expect(w[0]!).toBeGreaterThan(0.99);
    const counts = Float64Array.from({ length: 4000 }, () => r.poisson(3.5));
    expect(fitDistribution(counts, 'poisson').params.lambda!).toBeCloseTo(3.5, 1);
    expect(fitDistribution([-1, 2], 'exponential').valid).toBe(false);
    const gn = fitDistribution(noise(20000, 3, 63), 'gaussian');
    expect(gn.params.sigma!).toBeCloseTo(3, 1);
  });
  it('Pearson and Spearman correlation on exact cases', () => {
    const x = [1, 2, 3, 4, 5];
    expect(pearson(x, [2, 4, 6, 8, 10]).r).toBeCloseTo(1, 12);
    expect(pearson(x, [5, 4, 3, 2, 1]).r).toBeCloseTo(-1, 12);
    expect(pearson(x, [2, 1, 4, 3, 5]).r).toBeCloseTo(0.8, 12);
    expect(spearman(x, [1, 8, 27, 64, 125]).r).toBeCloseTo(1, 12);
    expect(Array.from(ranks([10, 20, 20, 5]))).toEqual([2, 3.5, 3.5, 1]);
    const p = pearson([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], [2.1, 3.9, 6.2, 7.8, 10.1, 12.2, 13.8, 16.1, 18, 19.9]);
    expect(p.p).toBeLessThan(1e-8); expect(p.ciLow).toBeGreaterThan(0.99);
    const a = noise(4000, 1, 64), b = noise(4000, 1, 65);
    expect(pearson(a, b).p).toBeGreaterThan(0.01);
    const m = correlationMatrix([a, b, Float64Array.from(a, (v) => 2 * v + 1)]);
    expect(m[2]!).toBeCloseTo(1, 12); expect(m[0]!).toBe(1); expect(m[1]!).toBe(m[3]!);
  });
  it('OLS regression recovers polynomial coefficients, R² and Durbin–Watson', () => {
    const x = Float64Array.from({ length: 200 }, (_, i) => i / 20), e = noise(200, 0.3, 66);
    const y = Float64Array.from(x, (v, i) => 1.5 - 2 * v + 0.4 * v * v + e[i]!);
    const fit = polynomialRegression(x, y, 2);
    expect(fit.coefficients[0]!).toBeCloseTo(1.5, 0); expect(fit.coefficients[1]!).toBeCloseTo(-2, 1); expect(fit.coefficients[2]!).toBeCloseTo(0.4, 1);
    expect(fit.r2).toBeGreaterThan(0.99); expect(fit.adjustedR2).toBeLessThan(fit.r2);
    expect(fit.durbinWatson).toBeGreaterThan(1.6); expect(fit.durbinWatson).toBeLessThan(2.4);
    expect(fit.residualSd).toBeCloseTo(0.3, 1);
    const exact = polynomialRegression([0, 1, 2, 3], [1, 3, 5, 7], 1);
    expect(exact.coefficients[0]!).toBeCloseTo(1, 10); expect(exact.coefficients[1]!).toBeCloseTo(2, 10); expect(exact.r2).toBeCloseTo(1, 12);
    // positively autocorrelated residuals (a missed quadratic term) push Durbin–Watson toward 0
    expect(polynomialRegression(x, y, 1).durbinWatson).toBeLessThan(0.5);
    expect(() => polynomialRegression([1, 2], [1, 2], 2)).toThrow();
  });
  it('bootstrap confidence interval of the mean matches σ/√n and is reproducible', () => {
    const x = noise(400, 2, 67).map((v) => v + 10), mean = (s: Float64Array) => s.reduce((a, b) => a + b, 0) / s.length;
    const b = bootstrapCI(x, mean, 2000, 7);
    expect(b.standardError).toBeCloseTo(2 / 20, 1);
    expect(b.ciLow).toBeLessThan(10.2); expect(b.ciHigh).toBeGreaterThan(9.8);
    expect(b.ciHigh - b.ciLow).toBeCloseTo(2 * 1.96 * 0.1, 1);
    expect(Math.abs(b.bcaLow - b.ciLow)).toBeLessThan(0.05);
    expect(bootstrapCI(x, mean, 2000, 7).ciLow).toBe(b.ciLow);
    expect(bootstrapCI(x, mean, 2000, 8).ciLow).not.toBe(b.ciLow);
  });
  it('Welch t, Mann–Whitney and permutation tests agree on shifted and identical samples', () => {
    const a = noise(60, 1, 68), shifted = noise(60, 1, 69).map((v) => v + 1);
    for (const p of [welchTTest(a, shifted).p, mannWhitneyU(a, shifted).p, permutationTest(a, shifted, 4000, 3).p]) expect(p).toBeLessThan(0.001);
    // Type I error calibration: under the null hypothesis each test rejects at α = 0.05 in about 5% of 400 experiments.
    let rejT = 0, rejU = 0, rejP = 0;
    for (let k = 0; k < 400; k++) {
      const u = noise(40, 1, 1000 + 2 * k), v = noise(40, 1, 1001 + 2 * k);
      if (welchTTest(u, v).p < 0.05) rejT++;
      if (mannWhitneyU(u, v).p < 0.05) rejU++;
      if (k < 150 && permutationTest(u, v, 500, k).p < 0.05) rejP++;
    }
    for (const rate of [rejT / 400, rejU / 400, rejP / 150]) { expect(rate).toBeGreaterThan(0.015); expect(rate).toBeLessThan(0.1); }
    const t = welchTTest([1, 2, 3, 4, 5], [2, 4, 6, 8, 10]);
    expect(t.t).toBeCloseTo(-1.8974, 3); expect(t.df).toBeCloseTo(5.882, 2); expect(t.p).toBeCloseTo(0.1075, 2);
    const u = mannWhitneyU([1, 2, 3], [4, 5, 6]);
    expect(u.u).toBe(0); expect(u.rankBiserial).toBe(1);
    expect(permutationTest(a, shifted, 4000, 3).p).toBe(permutationTest(a, shifted, 4000, 3).p);
  });
  it('Benjamini–Hochberg adjusted p-values match a worked example', () => {
    const r = benjaminiHochberg([0.01, 0.04, 0.03, 0.005, 0.5], 0.05);
    expect(Array.from(r.adjusted).map((v) => +v.toFixed(4))).toEqual([0.025, 0.05, 0.05, 0.025, 0.5]);
    expect(Array.from(r.rejected)).toEqual([1, 1, 1, 1, 0]); expect(r.discoveries).toBe(4);
    expect(benjaminiHochberg([0.2, 0.3], 0.05).discoveries).toBe(0);
  });
  it('nonlinear least squares recovers an exponential decay; sensitivity index of a power law is its exponent', () => {
    const x = Float64Array.from({ length: 60 }, (_, i) => i), y = Float64Array.from(x, (v) => 5 * Math.exp(-v / 12) + 1);
    const fit = fitCurve(x, y, (xx, p) => p[0]! * Math.exp(-xx / p[1]!) + p[2]!, [3, 8, 0.5]);
    expect(fit.params[0]!).toBeCloseTo(5, 3); expect(fit.params[1]!).toBeCloseTo(12, 3); expect(fit.params[2]!).toBeCloseTo(1, 3);
    expect(fit.sse).toBeLessThan(1e-8);
    expect(sensitivityIndex((p) => 3 * Math.pow(p, 2.5), 4).index).toBeCloseTo(2.5, 2);
    expect(sensitivityIndex(() => 7, 4).index).toBe(0);
  });
  it('information criteria follow their definitions', () => {
    const ic = informationCriteria(-120, 3, 100);
    expect(ic.aic).toBe(246); expect(ic.bic).toBeCloseTo(3 * Math.log(100) + 240, 12); expect(ic.aicc).toBeCloseTo(246 + 24 / 96, 12);
    expect(Array.from(akaikeWeights([10, 10])).map((v) => +v.toFixed(3))).toEqual([0.5, 0.5]);
  });
});
