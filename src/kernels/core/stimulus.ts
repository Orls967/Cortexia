// Stimulus waveform generator (MODEL_CATALOG §3, Panel 2): step, pulse train, ramp, sine, Ornstein–Uhlenbeck noise.
import { Rng } from './prng';
import type { StimulusConfig } from './types';

export type StimulusFn = (tMs: number) => number;

/**
 * Builds a deterministic stimulus function. OU noise is pre-sampled on the solver grid with the exact
 * OU propagator and held piecewise-constant, so higher-order solvers stay reproducible.
 */
export function makeStimulus(cfg: StimulusConfig, dtMs: number, durationMs: number, seed: number): StimulusFn {
  const { baseline, amplitude, startMs } = cfg;
  const end = startMs + cfg.durationMs;
  switch (cfg.kind) {
    case 'none':
      return () => baseline;
    case 'step':
      return (t) => (t >= startMs && t < end ? baseline + amplitude : baseline);
    case 'pulse-train': {
      const { pulseWidthMs: w, pulseIntervalMs: iv, pulseCount: n, laterPulseScale: s } = cfg;
      return (t) => {
        if (t < startMs) return baseline;
        const k = Math.floor((t - startMs) / iv);
        if (k >= n) return baseline;
        return t - startMs - k * iv < w ? baseline + amplitude * (k === 0 ? 1 : s) : baseline;
      };
    }
    case 'ramp': {
      const span = Math.max(1e-9, Math.min(cfg.durationMs, durationMs - startMs));
      return (t) => (t < startMs ? baseline : t >= startMs + span ? baseline + amplitude : baseline + (amplitude * (t - startMs)) / span);
    }
    case 'sine': {
      const w = (2 * Math.PI * cfg.frequencyHz) / 1000;
      return (t) => (t >= startMs && t < end ? baseline + amplitude * Math.sin(w * (t - startMs)) : baseline);
    }
    case 'ou-noise': {
      const n = Math.ceil(durationMs / dtMs) + 2;
      const rng = new Rng(seed ^ 0x51ed270b);
      const samples = new Float64Array(n);
      const decay = Math.exp(-dtMs / cfg.tauMs);
      const kick = cfg.sigma * Math.sqrt(1 - decay * decay);
      let x = 0;
      for (let i = 0; i < n; i++) {
        samples[i] = x;
        x = x * decay + kick * rng.normal();
      }
      return (t) => {
        if (t < startMs || t >= end) return baseline;
        const i = Math.min(n - 1, Math.max(0, Math.floor(t / dtMs + 1e-9)));
        return baseline + amplitude + samples[i]!;
      };
    }
  }
}
