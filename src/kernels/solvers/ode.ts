// Generic ODE steppers (NUMERICAL_METHODS §3). All work in-place on pre-allocated Float64Array scratch
// buffers so the inner time loop performs zero allocations.

export type Deriv = (t: number, y: Float64Array, dydt: Float64Array) => void;

export interface Stepper {
  /** Advances y from t to t + h in place. */
  step(f: Deriv, t: number, y: Float64Array, h: number): void;
}

export function createEuler(n: number): Stepper {
  const k = new Float64Array(n);
  return {
    step(f, t, y, h) {
      f(t, y, k);
      for (let i = 0; i < n; i++) y[i] = y[i]! + h * k[i]!;
    },
  };
}

export function createRk4(n: number): Stepper {
  const k1 = new Float64Array(n);
  const k2 = new Float64Array(n);
  const k3 = new Float64Array(n);
  const k4 = new Float64Array(n);
  const tmp = new Float64Array(n);
  return {
    step(f, t, y, h) {
      f(t, y, k1);
      for (let i = 0; i < n; i++) tmp[i] = y[i]! + 0.5 * h * k1[i]!;
      f(t + 0.5 * h, tmp, k2);
      for (let i = 0; i < n; i++) tmp[i] = y[i]! + 0.5 * h * k2[i]!;
      f(t + 0.5 * h, tmp, k3);
      for (let i = 0; i < n; i++) tmp[i] = y[i]! + h * k3[i]!;
      f(t + h, tmp, k4);
      for (let i = 0; i < n; i++) y[i] = y[i]! + (h / 6) * (k1[i]! + 2 * k2[i]! + 2 * k3[i]! + k4[i]!);
    },
  };
}

/** Heun / explicit trapezoid (RK2). */
export function createRk2(n: number): Stepper {
  const k1 = new Float64Array(n);
  const k2 = new Float64Array(n);
  const tmp = new Float64Array(n);
  return {
    step(f, t, y, h) {
      f(t, y, k1);
      for (let i = 0; i < n; i++) tmp[i] = y[i]! + h * k1[i]!;
      f(t + h, tmp, k2);
      for (let i = 0; i < n; i++) y[i] = y[i]! + 0.5 * h * (k1[i]! + k2[i]!);
    },
  };
}

// Dormand–Prince 5(4) coefficients.
const C2 = 1 / 5, C3 = 3 / 10, C4 = 4 / 5, C5 = 8 / 9;
const A21 = 1 / 5;
const A31 = 3 / 40, A32 = 9 / 40;
const A41 = 44 / 45, A42 = -56 / 15, A43 = 32 / 9;
const A51 = 19372 / 6561, A52 = -25360 / 2187, A53 = 64448 / 6561, A54 = -212 / 729;
const A61 = 9017 / 3168, A62 = -355 / 33, A63 = 46732 / 5247, A64 = 49 / 176, A65 = -5103 / 18656;
const B1 = 35 / 384, B3 = 500 / 1113, B4 = 125 / 192, B5 = -2187 / 6784, B6 = 11 / 84;
const E1 = 71 / 57600, E3 = -71 / 16695, E4 = 71 / 1920, E5 = -17253 / 339200, E6 = 22 / 525, E7 = -1 / 40;

export interface AdaptiveStepper {
  /**
   * Integrates y from t to tEnd with adaptive Dormand–Prince RK4(5) steps (error-controlled).
   * Returns the number of accepted internal steps.
   */
  advance(f: Deriv, t: number, tEnd: number, y: Float64Array): number;
  /** Current internal step-size estimate, carried between calls. */
  h: number;
}

export function createRk45(n: number, hInit: number, atol = 1e-6, rtol = 1e-5, hMin = 1e-6): AdaptiveStepper {
  const k1 = new Float64Array(n), k2 = new Float64Array(n), k3 = new Float64Array(n), k4 = new Float64Array(n);
  const k5 = new Float64Array(n), k6 = new Float64Array(n), k7 = new Float64Array(n);
  const tmp = new Float64Array(n), ynew = new Float64Array(n);
  const stepper: AdaptiveStepper = {
    h: hInit,
    advance(f, t0, tEnd, y) {
      let t = t0;
      let accepted = 0;
      let guard = 0;
      while (tEnd - t > 1e-12) {
        if (++guard > 1e6) throw new Error('RK45 step limit exceeded');
        const h = Math.min(stepper.h, tEnd - t);
        f(t, y, k1);
        for (let i = 0; i < n; i++) tmp[i] = y[i]! + h * A21 * k1[i]!;
        f(t + C2 * h, tmp, k2);
        for (let i = 0; i < n; i++) tmp[i] = y[i]! + h * (A31 * k1[i]! + A32 * k2[i]!);
        f(t + C3 * h, tmp, k3);
        for (let i = 0; i < n; i++) tmp[i] = y[i]! + h * (A41 * k1[i]! + A42 * k2[i]! + A43 * k3[i]!);
        f(t + C4 * h, tmp, k4);
        for (let i = 0; i < n; i++) tmp[i] = y[i]! + h * (A51 * k1[i]! + A52 * k2[i]! + A53 * k3[i]! + A54 * k4[i]!);
        f(t + C5 * h, tmp, k5);
        for (let i = 0; i < n; i++) tmp[i] = y[i]! + h * (A61 * k1[i]! + A62 * k2[i]! + A63 * k3[i]! + A64 * k4[i]! + A65 * k5[i]!);
        f(t + h, tmp, k6);
        for (let i = 0; i < n; i++) ynew[i] = y[i]! + h * (B1 * k1[i]! + B3 * k3[i]! + B4 * k4[i]! + B5 * k5[i]! + B6 * k6[i]!);
        f(t + h, ynew, k7);
        let err = 0;
        for (let i = 0; i < n; i++) {
          const e = h * (E1 * k1[i]! + E3 * k3[i]! + E4 * k4[i]! + E5 * k5[i]! + E6 * k6[i]! + E7 * k7[i]!);
          const sc = atol + rtol * Math.max(Math.abs(y[i]!), Math.abs(ynew[i]!));
          err = Math.max(err, Math.abs(e) / sc);
        }
        if (!Number.isFinite(err)) throw new Error('RK45 produced a non-finite error estimate');
        if (err <= 1 || h <= hMin) {
          t += h;
          y.set(ynew);
          accepted++;
        }
        const factor = err === 0 ? 5 : Math.min(5, Math.max(0.2, 0.9 * Math.pow(err, -0.2)));
        stepper.h = Math.max(hMin, h * factor);
      }
      return accepted;
    },
  };
  return stepper;
}

/** exprel-style guard: x / (1 - exp(-x)) with Taylor expansion near the removable singularity. */
export function xOverOneMinusExpNeg(x: number): number {
  if (Math.abs(x) < 1e-7) return 1 + x / 2 + (x * x) / 12;
  return x / (1 - Math.exp(-x));
}

/** Thomas algorithm for a tridiagonal system; overwrites `d` with the solution. */
export function solveTridiagonal(a: Float64Array, b: Float64Array, c: Float64Array, d: Float64Array, cp: Float64Array): void {
  const n = d.length;
  cp[0] = c[0]! / b[0]!;
  d[0] = d[0]! / b[0]!;
  for (let i = 1; i < n; i++) {
    const m = b[i]! - a[i]! * cp[i - 1]!;
    cp[i] = c[i]! / m;
    d[i] = (d[i]! - a[i]! * d[i - 1]!) / m;
  }
  for (let i = n - 2; i >= 0; i--) d[i] = d[i]! - cp[i]! * d[i + 1]!;
}

/** Dense LU decomposition with partial pivoting (used for small branched-cable and network systems). */
export function luDecompose(a: Float64Array, n: number): { lu: Float64Array; perm: Int32Array } {
  const lu = Float64Array.from(a);
  const perm = new Int32Array(n);
  for (let i = 0; i < n; i++) perm[i] = i;
  for (let k = 0; k < n; k++) {
    let p = k;
    let max = Math.abs(lu[k * n + k]!);
    for (let i = k + 1; i < n; i++) {
      const v = Math.abs(lu[i * n + k]!);
      if (v > max) {
        max = v;
        p = i;
      }
    }
    if (max < 1e-300) throw new Error('Singular matrix in LU decomposition');
    if (p !== k) {
      for (let j = 0; j < n; j++) {
        const t = lu[k * n + j]!;
        lu[k * n + j] = lu[p * n + j]!;
        lu[p * n + j] = t;
      }
      const t = perm[k]!;
      perm[k] = perm[p]!;
      perm[p] = t;
    }
    for (let i = k + 1; i < n; i++) {
      const m = (lu[i * n + k] = lu[i * n + k]! / lu[k * n + k]!);
      if (m !== 0) for (let j = k + 1; j < n; j++) lu[i * n + j] = lu[i * n + j]! - m * lu[k * n + j]!;
    }
  }
  return { lu, perm };
}

export function luSolve(lu: Float64Array, perm: Int32Array, n: number, b: Float64Array, out: Float64Array): void {
  for (let i = 0; i < n; i++) {
    let s = b[perm[i]!]!;
    for (let j = 0; j < i; j++) s -= lu[i * n + j]! * out[j]!;
    out[i] = s;
  }
  for (let i = n - 1; i >= 0; i--) {
    let s = out[i]!;
    for (let j = i + 1; j < n; j++) s -= lu[i * n + j]! * out[j]!;
    out[i] = s / lu[i * n + i]!;
  }
}

/** Inverse of a dense matrix via LU (n ≤ a few hundred). */
export function invertMatrix(a: Float64Array, n: number): Float64Array {
  const { lu, perm } = luDecompose(a, n);
  const inv = new Float64Array(n * n);
  const e = new Float64Array(n);
  const col = new Float64Array(n);
  for (let j = 0; j < n; j++) {
    e.fill(0);
    e[j] = 1;
    luSolve(lu, perm, n, e, col);
    for (let i = 0; i < n; i++) inv[i * n + j] = col[i]!;
  }
  return inv;
}
