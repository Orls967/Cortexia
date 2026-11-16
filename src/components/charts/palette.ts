// Colorblind-safe Okabe–Ito trace colors & Viridis / diverging colormaps (ACCESSIBILITY.md §3).
export const OKABE_ITO = [
  '#38BDF8', // Ice blue
  '#F59E0B', // Amber / Orange
  '#A855F7', // Violet
  '#10B981', // Emerald / Bluish green
  '#F43F5E', // Rose / Vermilion
  '#EAB308', // Yellow
  '#94A3B8', // Slate
] as const;

export const TRACE_DASH: number[][] = [
  [],
  [6, 4],
  [2, 3],
  [8, 3, 2, 3],
];

// 9-stop Viridis approximation interpolated linearly to 256 RGB entries (no rainbow/jet).
const VIRIDIS_STOPS: [number, number, number][] = [
  [68, 1, 84],
  [72, 40, 120],
  [62, 74, 137],
  [49, 104, 142],
  [38, 130, 142],
  [31, 158, 137],
  [53, 183, 121],
  [109, 205, 89],
  [180, 222, 44],
  [253, 231, 37],
];

const DIVERGING_STOPS: [number, number, number][] = [
  [56, 189, 248],  // Ice cyan (-1)
  [30, 64, 115],   // Deep blue (-0.5)
  [20, 28, 46],    // Dark graphite center (0)
  [146, 64, 14],   // Warm umber (+0.5)
  [245, 158, 11],  // Amber (+1)
];

function buildLut(stops: [number, number, number][]): Uint8Array {
  const lut = new Uint8Array(256 * 3);
  const segs = stops.length - 1;
  for (let i = 0; i < 256; i++) {
    const t = (i / 255) * segs;
    const k = Math.min(segs - 1, Math.floor(t));
    const f = t - k;
    const a = stops[k]!, b = stops[k + 1]!;
    lut[i * 3] = Math.round(a[0] + f * (b[0] - a[0]));
    lut[i * 3 + 1] = Math.round(a[1] + f * (b[1] - a[1]));
    lut[i * 3 + 2] = Math.round(a[2] + f * (b[2] - a[2]));
  }
  return lut;
}

export const VIRIDIS_LUT = buildLut(VIRIDIS_STOPS);
export const DIVERGING_LUT = buildLut(DIVERGING_STOPS);

export function formatNum(v: number): string {
  if (!Number.isFinite(v)) return 'NaN';
  const a = Math.abs(v);
  if (a === 0) return '0';
  if (a >= 1000 || a < 0.01) return v.toExponential(2);
  return Number(v.toPrecision(4)).toString();
}
