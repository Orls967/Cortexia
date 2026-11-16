// MODEL-023 … MODEL-026: analytical and regime tests (VAL-OJA-001, VAL-STDP-001, VAL-TDRL-001, EXP-032 … EXP-036).
import { describe, expect, it } from 'vitest';
import { configWith, presetConfig } from '../../src/kernels/core/config';
import { covarianceEigen, MODEL_023, MODEL_024, MODEL_025, MODEL_026, stdpEvolve, stdpWindow, type StdpRule } from '../../src/kernels/models/plasticity';

const preset = (m: typeof MODEL_023, id: string) => {
  const p = m.presets.find((x) => x.id === id);
  if (!p) throw new Error(`missing preset ${id}`);
  return presetConfig(m, p);
};

describe('MODEL-023 Hebb / Oja / BCM', () => {
  it('covariance eigen-decomposition is exact for a 2 x 2 matrix', () => {
    const e = covarianceEigen(1, 0.7, 0.8);
    const a = 1, d = 0.49, b = 0.56;
    // C e1 = l1 e1 and trace / determinant identities
    expect(a * e.e1[0] + b * e.e1[1]).toBeCloseTo(e.l1 * e.e1[0], 12);
    expect(b * e.e1[0] + d * e.e1[1]).toBeCloseTo(e.l1 * e.e1[1], 12);
    expect(e.l1 + e.l2).toBeCloseTo(a + d, 12);
    expect(e.l1 * e.l2).toBeCloseTo(a * d - b * b, 12);
    expect(covarianceEigen(2, 1, 0).e1).toEqual([1, 0]);
  });

  it('VAL-OJA-001: Oja converges to unit norm along the principal eigenvector (2,000 and 3,000 steps, 20 seeds)', () => {
    for (const steps of [2000, 3000]) {
      for (let seed = 1; seed <= 20; seed++) {
        const o = MODEL_023.run(configWith(MODEL_023, { durationMs: steps, seed }));
        expect(o.status).toBe('COMPLETED');
        expect(Math.abs(o.metrics.weightNorm! - 1)).toBeLessThan(0.02);
        expect(o.metrics.angleErrorDeg!).toBeLessThan(3);
      }
    }
  });

  it('Oja norm follows 1/sqrt(alpha) and both solvers agree', () => {
    for (const alpha of [0.25, 1, 4]) {
      const o = MODEL_023.run(configWith(MODEL_023, { params: { alpha_Oja: alpha }, durationMs: 4000 }));
      expect(o.metrics.weightNorm!).toBeCloseTo(1 / Math.sqrt(alpha), 2);
      expect(o.metrics.expectedNorm!).toBeCloseTo(1 / Math.sqrt(alpha), 12);
    }
    const rk = MODEL_023.run(configWith(MODEL_023, { durationMs: 3000 }));
    const fe = MODEL_023.run(configWith(MODEL_023, { durationMs: 3000, solver: 'SOLVER-FE' }));
    expect(Math.abs(rk.metrics.w1Final! - fe.metrics.w1Final!)).toBeLessThan(0.02);
  });

  it('Oja finds the principal axis for negatively correlated inputs (weights of opposite sign)', () => {
    const o = MODEL_023.run(configWith(MODEL_023, { params: { rho_in: -0.8 }, initial: { w_1: 0.5, w_2: -0.2 }, durationMs: 4000 }));
    expect(o.metrics.angleErrorDeg!).toBeLessThan(3);
    expect(Math.sign(o.metrics.w1Final!)).toBe(-Math.sign(o.metrics.w2Final!));
  });

  it('EXP-032: basic Hebb grows without bound until it saturates at the hard limit', () => {
    const o = MODEL_023.run(preset(MODEL_023, 'hebb'));
    expect(o.metrics.saturated).toBe(1);
    expect(o.metrics.weightNorm!).toBeGreaterThan(5);
    expect(o.metrics.w1Final!).toBeLessThanOrEqual(5);
    // growth is monotone on average: norm at 25% of the run is already above the Oja fixed point
    expect(o.series.norm![Math.floor(o.t.length / 4)]!).toBeGreaterThan(1.5);
  });

  it('EXP-033: BCM becomes selective with y = theta = 2 for the preferred pattern (4 seeds)', () => {
    for (const seed of [42, 7, 3, 11]) {
      const cfg = preset(MODEL_023, 'bcm');
      cfg.seed = seed;
      const o = MODEL_023.run(cfg);
      expect(o.metrics.selectivity!).toBeGreaterThan(0.95);
      expect(o.metrics.preferredResponse!).toBeGreaterThan(1.7);
      expect(o.metrics.preferredResponse!).toBeLessThan(2.3);
      expect(o.metrics.thetaLateMean!).toBeGreaterThan(1.6);
      expect(o.metrics.thetaLateMean!).toBeLessThan(2.4);
    }
  });

  it('EXP-033: a threshold slower than the weights destabilizes BCM', () => {
    const stable = MODEL_023.run(preset(MODEL_023, 'bcm'));
    const slow = MODEL_023.run(preset(MODEL_023, 'bcm_slow'));
    expect(slow.metrics.thetaLateRange!).toBeGreaterThan(2 * stable.metrics.thetaLateRange!);
    expect(slow.metrics.thetaLateRange!).toBeGreaterThan(3);
  });

  it('is reproducible for a fixed seed and differs across seeds', () => {
    const a = MODEL_023.run(configWith(MODEL_023, { seed: 5 })), b = MODEL_023.run(configWith(MODEL_023, { seed: 5 })), c = MODEL_023.run(configWith(MODEL_023, { seed: 6 }));
    expect(Array.from(a.series.w_1!)).toEqual(Array.from(b.series.w_1!));
    expect(a.metrics.w1Final).not.toBe(c.metrics.w1Final);
  });
});

describe('MODEL-024 STDP', () => {
  const R: StdpRule = { tauPlus: 16.8, tauMinus: 33.7, aPlus: 0.01, aMinus: 0.0105, wMin: 0, wMax: 1, multiplicative: false, triplet: false, a3Plus: 0.0065, tauY: 114 };

  it('VAL-STDP-001: the online trace rule reproduces the exponential window to < 1e-6', () => {
    const o = MODEL_024.run(configWith(MODEL_024, { durationMs: 2000 }));
    expect(o.metrics.windowMaxAbsError!).toBeLessThan(1e-6);
    expect(o.metrics.windowMaxAbsError!).toBeLessThan(1e-12);
    for (const dt of [-100, -33.7, -10, -0.1, 0.1, 10, 16.8, 100]) {
      const sim = stdpEvolve([500], [500 + dt], 0.5, R) - 0.5;
      const exact = dt > 0 ? 0.01 * Math.exp(-dt / 16.8) : -0.0105 * Math.exp(dt / 33.7);
      expect(Math.abs(sim - exact)).toBeLessThan(1e-15);
      expect(stdpWindow(dt, R, 0.5)).toBeCloseTo(exact, 15);
    }
    expect(stdpEvolve([500], [500], 0.5, R)).toBe(0.5); // coincident spikes: no change
  });

  it('VAL-STDP-001: 60 pairings at 1 Hz sum to 60 single-pair updates (Bi & Poo protocol)', () => {
    for (const dt of [10, -10, 40, -40]) {
      const o = MODEL_024.run(configWith(MODEL_024, { params: { n_pairs: 60, pair_freq: 1, delta_t: dt }, durationMs: 61000 }));
      expect(o.metrics.pairsDelivered).toBe(60);
      expect(Math.abs(o.metrics.weightChange! - 60 * stdpWindow(dt, R, 0.5))).toBeLessThan(1e-6);
    }
  });

  it('multiplicative soft bounds scale the window by the distance to the bound', () => {
    const soft = { ...R, multiplicative: true };
    expect(stdpEvolve([100], [110], 0.25, soft) - 0.25).toBeCloseTo(0.01 * 0.75 * Math.exp(-10 / 16.8), 15);
    expect(stdpEvolve([110], [100], 0.25, soft) - 0.25).toBeCloseTo(-0.0105 * 0.25 * Math.exp(-10 / 33.7), 15);
    const o = MODEL_024.run(preset(MODEL_024, 'soft'));
    expect(o.metrics.softBoundFixedPoint!).toBeCloseTo((0.01 * 16.8) / (0.01 * 16.8 + 0.0105 * 33.7), 12);
    expect(o.metrics.finalWeight!).toBeLessThan(1);
  });

  it('hard bounds clamp the weight inside [w_min, w_max]', () => {
    const up = MODEL_024.run(configWith(MODEL_024, { params: { A_plus_STDP: 0.1, n_pairs: 100, pair_freq: 10, delta_t: 5 }, durationMs: 11000 }));
    expect(up.metrics.finalWeight).toBe(1);
    const down = MODEL_024.run(configWith(MODEL_024, { params: { A_minus_STDP: 0.1, n_pairs: 100, pair_freq: 10, delta_t: -5 }, durationMs: 11000 }));
    expect(down.metrics.finalWeight).toBe(0);
    for (const v of up.series.w!) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
  });

  it('Poisson firing drifts at r_pre r_post (A+ tau+ - A- tau-)', () => {
    let sim = 0, expected = 0;
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
    for (const seed of seeds) {
      const o = MODEL_024.run(configWith(MODEL_024, { params: { protocol: 1, rate_pre: 20, rate_post: 20, A_plus_STDP: 0.001, A_minus_STDP: 0.00105 }, durationMs: 20000, seed }));
      sim += o.metrics.simulatedDriftPerS! / seeds.length;
      expected = o.metrics.expectedDriftPerS!;
    }
    expect(expected).toBeCloseTo((400 * (0.001 * 16.8 - 0.00105 * 33.7)) / 1000, 12);
    expect(Math.abs(sim - expected) / Math.abs(expected)).toBeLessThan(0.15);
  });

  it('only the triplet rule converts high-frequency post-before-pre pairing into potentiation', () => {
    const pair = MODEL_024.run(preset(MODEL_024, 'ltd'));
    const trip = MODEL_024.run(preset(MODEL_024, 'triplet'));
    const last = pair.curves.freq_post_pre!.y.length - 1;
    expect(pair.curves.freq_post_pre!.x[last]).toBe(50);
    for (const v of pair.curves.freq_post_pre!.y) expect(v).toBeLessThan(0);
    expect(trip.curves.freq_post_pre!.y[0]!).toBeLessThan(0);
    expect(trip.curves.freq_post_pre!.y[last]!).toBeGreaterThan(0);
    // triplet potentiation at +10 ms grows monotonically with frequency; an isolated pair gives none (A2+ = 0)
    const up = trip.curves.freq_pre_post!.y;
    for (let k = 1; k < up.length; k++) expect(up[k]!).toBeGreaterThanOrEqual(up[k - 1]!);
    expect(up[0]!).toBeLessThan(0.01);
  });

  it('records traces that jump by one at each spike and decay with the right time constants', () => {
    const o = MODEL_024.run(configWith(MODEL_024, { params: { n_pairs: 1, delta_t: 20 }, durationMs: 400 }));
    const at = (ms: number) => Math.round(ms / (o.t[1]! - o.t[0]!));
    expect(o.series.x_pre![at(149)]).toBe(0);
    expect(o.series.x_pre![at(160)]!).toBeCloseTo(Math.exp(-10 / 16.8), 6);
    expect(o.series.y_post![at(180)]!).toBeCloseTo(Math.exp(-10 / 33.7), 6);
    expect(o.series.y_slow![at(180)]!).toBeCloseTo(Math.exp(-10 / 114), 6);
    expect(o.spikes!.times.length).toBe(2);
  });
});

describe('MODEL-025 homeostatic scaling', () => {
  it('EXP-035: deprivation is compensated by multiplicative upscaling that preserves weight ratios', () => {
    const o = MODEL_025.run(preset(MODEL_025, 'deprive'));
    expect(o.metrics.rateAfterPerturbationHz).toBeCloseTo(2.5, 12);
    expect(Math.abs(o.metrics.finalRateHz! - 5)).toBeLessThan(0.05 * 5);
    expect(o.metrics.requiredScaleFactor).toBeCloseTo(2, 12);
    expect(Math.abs(o.metrics.scaleFactor! - 2)).toBeLessThan(0.05);
    expect(o.metrics.ratioDrift!).toBeLessThan(1e-9);
    expect(o.metrics.recoveryTimeMs!).toBeGreaterThan(0);
    // before the perturbation the system sits at its fixed point
    const i = o.t.findIndex((t) => t >= 4000);
    expect(o.series.S![i]!).toBeCloseTo(5, 9);
    expect(o.series.scale![i]!).toBeCloseTo(1, 9);
  });

  it('EXP-035: hyperdrive is compensated by downscaling', () => {
    const o = MODEL_025.run(preset(MODEL_025, 'hyper'));
    expect(Math.abs(o.metrics.scaleFactor! - 0.5)).toBeLessThan(0.02);
    expect(Math.abs(o.metrics.finalRateHz! - 5)).toBeLessThan(0.1);
  });

  it('additive adjustment does not preserve relative weights', () => {
    const o = MODEL_025.run(preset(MODEL_025, 'additive'));
    expect(o.metrics.ratioDrift!).toBeGreaterThan(0.2);
  });

  it('damping ratio predicts monotone approach vs overshoot', () => {
    const smooth = MODEL_025.run(preset(MODEL_025, 'deprive'));
    const ringing = MODEL_025.run(preset(MODEL_025, 'ringing'));
    expect(smooth.metrics.dampingRatio).toBeCloseTo(1, 12);
    expect(ringing.metrics.dampingRatio!).toBeCloseTo(0.5 * Math.sqrt(5000 / (2 * 5 * 1000)), 12);
    const peak = (o: typeof smooth) => { let m = 0; for (let i = 0; i < o.t.length; i++) if (o.t[i]! > 5000) m = Math.max(m, o.series.S![i]!); return m; };
    expect(peak(smooth)).toBeLessThan(5.01);
    expect(peak(ringing)).toBeGreaterThan(5.5);
  });

  it('weights respect the hard bound', () => {
    const o = MODEL_025.run(configWith(MODEL_025, { params: { input_scale: 0.02, w_max: 2 } }));
    for (const v of o.curves.weights_final!.y) { expect(v).toBeLessThanOrEqual(2); expect(v).toBeGreaterThanOrEqual(0); }
    expect(Math.max(...o.series.w_hi!)).toBeLessThanOrEqual(2);
  });
});

describe('MODEL-026 TD learning', () => {
  it('VAL-TDRL-001: 30 conditioning trials move the error from reward to cue; omission gives a negative dip', () => {
    const o = MODEL_026.run(configWith(MODEL_026, { durationMs: 31 }));
    expect(o.metrics.deltaUsFirst).toBe(1);
    expect(o.metrics.deltaCsFirst).toBe(0);
    expect(o.metrics.deltaCsTrained!).toBeGreaterThan(0.5);
    expect(o.metrics.deltaUsTrained!).toBeLessThan(0.05);
    expect(o.metrics.deltaOmission!).toBeLessThan(-0.9);
    expect(o.metrics.transferTrial!).toBeLessThan(30);
    expect(o.metrics.rewardedTrials).toBe(30);
  });

  it('converges to the discounted value function V = r gamma^k and delta_CS = r gamma^n', () => {
    const o = MODEL_026.run(configWith(MODEL_026, { durationMs: 300, params: { omission: 0 } }));
    expect(o.metrics.deltaCsTheory).toBeCloseTo(Math.pow(0.95, 10), 12);
    expect(o.metrics.deltaCsTrained!).toBeCloseTo(Math.pow(0.95, 10), 6);
    expect(Math.abs(o.metrics.deltaUsTrained!)).toBeLessThan(1e-6);
    const v = o.curves.value_final!.y, th = o.curves.value_theory!.y;
    for (let j = 0; j < v.length; j++) expect(Math.abs(v[j]! - th[j]!)).toBeLessThan(1e-5);
  });

  it('TD(0) learns more slowly than TD(lambda) but reaches the same fixed point', () => {
    const lam = MODEL_026.run(preset(MODEL_026, 'conditioning'));
    const td0 = MODEL_026.run(preset(MODEL_026, 'td0'));
    expect(td0.metrics.effectiveLambda!).toBeLessThan(1e-6);
    expect(td0.metrics.transferTrial!).toBeGreaterThan(lam.metrics.transferTrial!);
    expect(td0.metrics.deltaCsTrained!).toBeCloseTo(td0.metrics.deltaCsTheory!, 3);
  });

  it('partial reinforcement leaves a positive error at reward of about (1 - p) r', () => {
    let us = 0, cs = 0;
    const seeds = [1, 2, 3, 4, 5, 6];
    for (const seed of seeds) {
      const cfg = configWith(MODEL_026, { params: { p_reward: 0.5, omission: 0 }, durationMs: 600, seed });
      const o = MODEL_026.run(cfg);
      us += o.metrics.deltaUsLateMean! / seeds.length;
      cs += o.metrics.deltaCsLateMean! / seeds.length;
      expect(o.metrics.deltaUsTheory).toBe(0.5);
    }
    expect(Math.abs(us - 0.5)).toBeLessThan(0.08);
    expect(Math.abs(cs - 0.5 * Math.pow(0.95, 10))).toBeLessThan(0.06);
  });

  it('rejects impossible trial timing', () => {
    expect(() => MODEL_026.run(configWith(MODEL_026, { params: { t_cs: 2000, t_us: 1500 } }))).toThrow(/Trial timing/);
  });
});
