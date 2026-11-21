// Procedural brain geometry for Studio A. Everything here is an educational approximation generated from simple
// parametric shapes placed at the registry MNI centroids (assets-3d.json: PROCEDURAL_EDUCATIONAL_APPROXIMATION).
// It is not derived from an atlas mesh or from imaging data, and gyral folds are a decorative noise pattern.
import * as THREE from 'three';
import type { AnatomicalEntity } from '../../data/types';
import { withBoundsTree } from '../common/bvh';

export const MM = 0.055; // world units per millimetre

export type Mni = [number, number, number];

/**
 * MNI (+x right, +y anterior, +z superior) → three.js world (+X right, +Y up, −Z anterior). The sign flip on the
 * anterior axis keeps the mapping right-handed, so the left hemisphere is on the correct side in every view.
 */
export const toWorld = (m: Mni): THREE.Vector3 => new THREE.Vector3(m[0] * MM, m[2] * MM, -m[1] * MM);
export const BRAIN_CENTER: Mni = [0, -18, 14];

export type LobeId = 'ANAT-FRONTAL-LOBE' | 'ANAT-PARIETAL-LOBE' | 'ANAT-TEMPORAL-LOBE' | 'ANAT-OCCIPITAL-LOBE' | 'ANAT-LIMBIC-LOBE';
export const LOBE_COLOR: Record<LobeId, string> = {
  'ANAT-FRONTAL-LOBE': '#5b9bd5',
  'ANAT-PARIETAL-LOBE': '#4fb6a8',
  'ANAT-TEMPORAL-LOBE': '#c9a24b',
  'ANAT-OCCIPITAL-LOBE': '#b0739f',
  'ANAT-LIMBIC-LOBE': '#7d86c9',
};

/** Lobe of a cortical surface point given in right-hemisphere MNI coordinates (schematic boundaries). */
export function lobeOf(x: number, y: number, z: number): LobeId {
  if (x < 11 && z > -6 && z < 50 && y > -64 && y < 50) return 'ANAT-LIMBIC-LOBE';
  if (y < -66 + Math.max(0, z - 30) * 0.35) return 'ANAT-OCCIPITAL-LOBE';
  const centralSulcus = -22 + (62 - z) * 0.42;
  if (y > centralSulcus) return 'ANAT-FRONTAL-LOBE';
  return z < 4 ? 'ANAT-TEMPORAL-LOBE' : 'ANAT-PARIETAL-LOBE';
}

/** Smooth pseudo-random field used for the decorative gyral pattern; zero crossings become sulcus-like grooves. */
function foldField(x: number, y: number, z: number): number {
  // Wavelengths of roughly 12–20 mm, the scale of real gyri; the pattern itself is not anatomical.
  const a = Math.sin(0.42 * x + 1.9 * Math.sin(0.23 * y + 0.5)) * Math.cos(0.36 * y + 1.6 * Math.sin(0.27 * z));
  const b = 0.7 * Math.sin(0.47 * z + 2.1 * Math.sin(0.31 * x + 0.19 * y));
  const c = 0.35 * Math.sin(0.61 * x + 0.53 * y + 0.57 * z);
  return a + b + c;
}

export interface LobeMesh { lobe: LobeId; side: 'L' | 'R'; geometry: THREE.BufferGeometry; centroid: THREE.Vector3 }

interface Ellipsoid { c: Mni; r: Mni }
const CEREBRUM: Ellipsoid = { c: [34, -17, 28], r: [33, 85, 48] };
const TEMPORAL: Ellipsoid = { c: [45, -22, -17], r: [20, 46, 19] };

function hemisphereSurface(e: Ellipsoid, wSeg: number, hSeg: number, fixedLobe: LobeId | null) {
  const sphere = new THREE.SphereGeometry(1, wSeg, hSeg);
  const pos = sphere.attributes.position as THREE.BufferAttribute;
  const n = pos.count;
  const mni = new Float32Array(n * 3), shade = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const dx = pos.getX(i), dy = pos.getZ(i), dz = pos.getY(i);
    // Taper the frontal and occipital poles, then place the point on the ellipsoid.
    const taper = 1 - (dy > 0 ? 0.2 : 0.28) * dy * dy;
    let x = e.c[0] + e.r[0] * dx * taper, y = e.c[1] + e.r[1] * dy, z = e.c[2] + e.r[2] * dz;
    const medial = x < 3;
    if (!medial) {
      const f = foldField(x, y, z);
      // Smooth rounded gyral crowns with crisp dark sulcal creases
      const ridge = Math.pow(Math.min(1, Math.abs(f) / 0.85), 0.38);
      // Subtle Sylvian fissure indentation between frontal/parietal and temporal region
      const sylvianDist = Math.abs(z - (-2 + (y + 20) * 0.28));
      const sylvian = !fixedLobe && x > 32 && y > -38 && y < 32 ? Math.exp(-(sylvianDist * sylvianDist) / 28) * 3.8 : 0;
      const d = 3.2 * (ridge - 0.55) - sylvian;
      x += d * dx; y += d * dy * 0.6; z += d * dz;
      shade[i] = 0.32 + 0.68 * ridge * (1 - 0.18 * (sylvian / 3.8));
    } else {
      shade[i] = 0.78;
    }
    // Flat medial wall along the longitudinal fissure and a flattened base.
    x = Math.max(x, 1.5);
    if (!fixedLobe) z = Math.max(z, -22 + 0.06 * Math.abs(y + 17));
    mni[i * 3] = x; mni[i * 3 + 1] = y; mni[i * 3 + 2] = z;
  }
  return { index: sphere.index!.array as ArrayLike<number>, mni, shade, count: n, dispose: () => sphere.dispose() };
}

/** Builds the cortical surface of both hemispheres, split into one mesh per lobe and side. */
export function buildCortex(): LobeMesh[] {
  const parts = [
    { surf: hemisphereSurface(CEREBRUM, 150, 110, null), fixed: null as LobeId | null },
    { surf: hemisphereSurface(TEMPORAL, 80, 56, 'ANAT-TEMPORAL-LOBE'), fixed: 'ANAT-TEMPORAL-LOBE' as LobeId | null },
  ];
  const out: LobeMesh[] = [];
  for (const side of ['R', 'L'] as const) {
    const sx = side === 'R' ? 1 : -1;
    const buckets = new Map<LobeId, { p: number[]; c: number[]; n: number[] }>();
    for (const { surf, fixed } of parts) {
      // Smooth vertex normals from the full surface, so that lobes split from it keep continuous shading.
      const world = new Float32Array(surf.count * 3);
      for (let i = 0; i < surf.count; i++) { world[i * 3] = sx * surf.mni[i * 3]! * MM; world[i * 3 + 1] = surf.mni[i * 3 + 2]! * MM; world[i * 3 + 2] = -surf.mni[i * 3 + 1]! * MM; }
      const full = new THREE.BufferGeometry();
      full.setAttribute('position', new THREE.BufferAttribute(world, 3));
      const idx = Array.from(surf.index);
      if (side === 'L') for (let t = 0; t < idx.length; t += 3) { const tmp = idx[t + 1]!; idx[t + 1] = idx[t + 2]!; idx[t + 2] = tmp; }
      full.setIndex(idx);
      full.computeVertexNormals();
      const normals = full.attributes.normal!.array as ArrayLike<number>;
      const col = new THREE.Color();
      for (let t = 0; t < idx.length; t += 3) {
        const a = idx[t]!, b = idx[t + 1]!, c = idx[t + 2]!;
        const cx = (surf.mni[a * 3]! + surf.mni[b * 3]! + surf.mni[c * 3]!) / 3, cy = (surf.mni[a * 3 + 1]! + surf.mni[b * 3 + 1]! + surf.mni[c * 3 + 1]!) / 3, cz = (surf.mni[a * 3 + 2]! + surf.mni[b * 3 + 2]! + surf.mni[c * 3 + 2]!) / 3;
        const lobe = fixed ?? lobeOf(cx, cy, cz);
        let bucket = buckets.get(lobe);
        if (!bucket) { bucket = { p: [], c: [], n: [] }; buckets.set(lobe, bucket); }
        for (const v of [a, b, c]) {
          bucket.p.push(world[v * 3]!, world[v * 3 + 1]!, world[v * 3 + 2]!);
          bucket.n.push(normals[v * 3]!, normals[v * 3 + 1]!, normals[v * 3 + 2]!);
          col.set(LOBE_COLOR[lobe]).multiplyScalar(surf.shade[v]!);
          bucket.c.push(col.r, col.g, col.b);
        }
      }
      full.dispose();
    }
    for (const [lobe, b] of buckets) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(b.c, 3));
      g.computeBoundingSphere();
      withBoundsTree(g);
      out.push({ lobe, side, geometry: g, centroid: g.boundingSphere!.center.clone() });
    }
  }
  for (const p of parts) p.surf.dispose();
  return out;
}

// ── Deep and attached structures ─────────────────────────────────────────────

export type LayerKey = 'cortex' | 'limbic' | 'subcortical' | 'hindbrain' | 'tracts';

export const DIVISION_LAYER: Record<string, LayerKey> = {
  CEREBRAL_LOBES: 'cortex', GYRI_AND_SULCI: 'cortex', CEREBRAL_CORTEX: 'cortex', HEMISPHERES_COMMISSURES: 'tracts',
  HIPPOCAMPAL_FORMATION: 'limbic', AMYGDALA_LIMBIC: 'limbic',
  BASAL_GANGLIA: 'subcortical', THALAMUS_HYPOTHALAMUS: 'subcortical', VENTRICULAR_MENINGEAL: 'subcortical',
  BRAINSTEM: 'hindbrain', CEREBELLUM: 'hindbrain', SPINAL_CORD: 'hindbrain', CRANIAL_NERVES: 'hindbrain', PERIPHERAL_NERVOUS_SYSTEM: 'hindbrain',
  WHITE_MATTER_TRACTS: 'tracts', ROOT: 'cortex',
};

export const DIVISION_COLOR: Record<string, string> = {
  CEREBRAL_LOBES: '#5b9bd5', GYRI_AND_SULCI: '#e2e8f0', CEREBRAL_CORTEX: '#e2e8f0', HEMISPHERES_COMMISSURES: '#cbd5e1',
  HIPPOCAMPAL_FORMATION: '#34d399', AMYGDALA_LIMBIC: '#f472b6',
  BASAL_GANGLIA: '#f59e0b', THALAMUS_HYPOTHALAMUS: '#a78bfa', VENTRICULAR_MENINGEAL: '#22d3ee',
  BRAINSTEM: '#60a5fa', CEREBELLUM: '#fb7185', SPINAL_CORD: '#94a3b8', CRANIAL_NERVES: '#fde68a', PERIPHERAL_NERVOUS_SYSTEM: '#fde68a',
  WHITE_MATTER_TRACTS: '#cbd5e1', ROOT: '#94a3b8',
};

export type Shape =
  | { kind: 'ellipsoid'; r: Mni; body?: boolean; folia?: boolean }
  | { kind: 'tube'; path: Mni[]; radius: number; flattenX?: number }
  | { kind: 'marker' }
  | { kind: 'cortex' }
  | { kind: 'none' };

const E = (rx: number, ry: number, rz: number, body = false): Shape => ({ kind: 'ellipsoid', r: [rx, ry, rz], body });
const T = (radius: number, ...path: Mni[]): Shape => ({ kind: 'tube', path, radius });

/** Shape table. Radii and paths are in MNI millimetres for the right side; bilateral structures are mirrored. */
const SHAPES: Record<string, Shape> = {
  // Aggregates have no mesh of their own: selecting them highlights their parts.
  'ANAT-NERVOUS-SYSTEM': { kind: 'none' }, 'ANAT-CNS': { kind: 'none' }, 'ANAT-ENCEPHALON': { kind: 'none' }, 'ANAT-FOREBRAIN': { kind: 'none' },
  'ANAT-TELENCEPHALON': { kind: 'none' }, 'ANAT-DIENCEPHALON': { kind: 'none' }, 'ANAT-HINDBRAIN': { kind: 'none' }, 'ANAT-BASAL-GANGLIA': { kind: 'none' },
  'ANAT-STRIATUM': { kind: 'none' }, 'ANAT-VENTRICULAR-SYSTEM': { kind: 'none' }, 'ANAT-HIPPOCAMPAL-FORMATION': { kind: 'none' }, 'ANAT-CINGULATE-GYRUS': { kind: 'none' },
  'ANAT-LEFT-HEMISPHERE': { kind: 'cortex' }, 'ANAT-RIGHT-HEMISPHERE': { kind: 'cortex' },
  'ANAT-FRONTAL-LOBE': { kind: 'cortex' }, 'ANAT-PARIETAL-LOBE': { kind: 'cortex' }, 'ANAT-TEMPORAL-LOBE': { kind: 'cortex' }, 'ANAT-OCCIPITAL-LOBE': { kind: 'cortex' }, 'ANAT-LIMBIC-LOBE': { kind: 'cortex' },
  'ANAT-INSULAR-LOBE': E(4, 19, 13),
  // Limbic
  'ANAT-HIPPOCAMPUS': T(4.2, [21, -8, -22], [27, -20, -16], [30, -32, -8], [27, -40, 2]),
  'ANAT-DENTATE-GYRUS': E(2.4, 3, 2.4), 'ANAT-HIPPOCAMPUS-CA3': E(2.3, 2.8, 2.3), 'ANAT-HIPPOCAMPUS-CA2': E(1.8, 2.2, 1.8), 'ANAT-HIPPOCAMPUS-CA1': E(2.6, 3.4, 2.4),
  'ANAT-SUBICULUM': E(2.6, 3.2, 2), 'ANAT-ENTORHINAL-CORTEX': E(5, 8, 4),
  'ANAT-AMYGDALA': E(7.5, 7.5, 7.5, true), 'ANAT-AMYGDALA-BLA': E(3.6, 3.6, 3.6), 'ANAT-AMYGDALA-CEA': E(2.6, 2.6, 2.6),
  'ANAT-SEPTAL-NUCLEI': E(3, 4, 4), 'ANAT-NUCLEUS-BASALIS': E(3.5, 4.5, 2.5),
  // Basal ganglia
  'ANAT-CAUDATE-NUCLEUS': T(4.2, [12, 20, 2], [14, 12, 14], [17, -8, 24], [24, -30, 18], [30, -34, 4]),
  'ANAT-PUTAMEN': E(6, 15, 9), 'ANAT-NUCLEUS-ACCUMBENS': E(4, 4.5, 3.5), 'ANAT-GPE': E(3.5, 9, 6), 'ANAT-GPI': E(2.8, 6, 4.5), 'ANAT-STN': E(3, 4, 2.4), 'ANAT-SUBSTANTIA-NIGRA': E(3, 6, 2.6),
  // Diencephalon
  'ANAT-THALAMUS': E(10, 15, 10, true), 'ANAT-THALAMUS-VPL': E(3, 3.5, 3), 'ANAT-THALAMUS-VPM': E(2.4, 3, 2.4), 'ANAT-THALAMUS-VL': E(3, 3.5, 3), 'ANAT-LGN': E(2.6, 2.6, 2),
  'ANAT-MGN': E(2.4, 2.4, 2), 'ANAT-THALAMUS-MD': E(3, 4, 3), 'ANAT-PULVINAR': E(4, 4.5, 4), 'ANAT-TRN': E(1.4, 12, 8),
  'ANAT-HYPOTHALAMUS': E(5.5, 7, 6, true), 'ANAT-SCN': E(1.4, 1.4, 1.4), 'ANAT-PVN-HYPO': E(1.6, 1.8, 1.8), 'ANAT-PITUITARY-GLAND': E(4.5, 4, 3.5), 'ANAT-MAMMILLARY-BODIES': E(2.3, 2.3, 2.3), 'ANAT-EPITHALAMUS-HABENULA': E(2.2, 2.6, 2.2),
  // Cerebellum
  'ANAT-CEREBELLUM': { kind: 'ellipsoid', r: [25, 23, 17], body: true, folia: true }, 'ANAT-CEREBELLAR-CORTEX': { kind: 'marker' },
  'ANAT-CEREBELLAR-VERMIS': E(7, 21, 15, true), 'ANAT-FLOCCULONODULAR-LOBE': E(6, 5, 4), 'ANAT-DENTATE-NUCLEUS': E(5, 6, 4),
  'ANAT-SUPERIOR-CEREBELLAR-PEDUNCLE': T(2.4, [16, -50, -32], [12, -42, -27], [7, -34, -22]),
  // Brainstem
  'ANAT-MIDBRAIN': E(13, 9, 9, true), 'ANAT-PONS': E(15, 12, 12, true), 'ANAT-MEDULLA-OBLONGATA': E(8, 8, 11, true),
  'ANAT-SUPERIOR-COLLICULUS': E(3, 3, 2.6), 'ANAT-INFERIOR-COLLICULUS': E(3, 3, 2.6), 'ANAT-VTA': E(2.4, 3, 2.4), 'ANAT-PAG': E(2.4, 5, 3),
  'ANAT-LOCUS-COERULEUS': E(1.4, 3, 1.4), 'ANAT-RAPHE-NUCLEI': E(1.6, 2.2, 6), 'ANAT-NTS': E(1.8, 3, 4), 'ANAT-VESTIBULAR-NUCLEI': E(3, 4, 3),
  'ANAT-RED-NUCLEUS': E(3, 3, 3), 'ANAT-INFERIOR-OLIVE': E(3, 3, 5),
  // Ventricles
  'ANAT-LATERAL-VENTRICLES': T(3, [9, 26, 6], [11, 8, 20], [16, -22, 22], [26, -44, 10], [30, -32, -6], [32, -14, -14]),
  'ANAT-THIRD-VENTRICLE': E(1.4, 12, 9), 'ANAT-FOURTH-VENTRICLE': E(5, 6, 5),
  // Spinal cord and sensory organs
  'ANAT-SPINAL-CORD': T(5, [0, -44, -56], [0, -46, -75], [0, -48, -98]),
  'ANAT-RETINA': E(4.6, 4.6, 4.6), 'ANAT-COCHLEA-ORGAN-CORTI': E(3.8, 3.8, 3.2),
  // White matter
  'ANAT-CORPUS-CALLOSUM': { kind: 'tube', radius: 3.2, flattenX: 5.5, path: [[0, 26, 2], [0, 30, 12], [0, 18, 24], [0, -12, 27], [0, -36, 22], [0, -44, 10]] },
  'ANAT-ANTERIOR-COMMISSURE': T(1.3, [-22, 0, -8], [0, 2, -4], [22, 0, -8]), 'ANAT-POSTERIOR-COMMISSURE': T(1.1, [-7, -28, -1], [0, -28, -1], [7, -28, -1]),
  'ANAT-INTERNAL-CAPSULE': T(3, [24, -18, 30], [21, -10, 14], [17, -12, 0], [12, -18, -12]),
  'ANAT-ARCUATE-FASCICULUS': T(2.2, [-46, 18, 12], [-40, -4, 28], [-38, -30, 30], [-46, -46, 14], [-52, -34, -2]),
  'ANAT-UNCINATE-FASCICULUS': T(2, [28, 30, -10], [32, 16, -12], [36, 6, -20], [38, -4, -26]),
  'ANAT-CINGULUM-BUNDLE': T(1.8, [8, 30, 6], [8, 28, 26], [8, -4, 36], [8, -38, 32], [9, -46, 12]),
  'ANAT-FORNIX': T(1.6, [22, -36, 0], [10, -32, 14], [3, -12, 16], [3, -2, 4], [4, -8, -12]),
  // Cranial nerves: short schematic stumps leaving the brain near their registry centroid.
  'ANAT-CN-I': T(1.8, [8, 14, -18], [8, 36, -22], [9, 48, -22]), 'ANAT-CN-II': T(1.9, [22, 46, -14], [10, 16, -16], [2, 4, -16], [8, -8, -8]),
  'ANAT-CN-III': T(1.1, [4, -18, -16], [10, 2, -18], [18, 30, -16]), 'ANAT-CN-IV': T(0.9, [4, -30, -12], [14, -18, -20], [20, 24, -14]),
  'ANAT-CN-V': T(1.9, [16, -24, -28], [22, -10, -24], [28, 6, -22]), 'ANAT-CN-VI': T(1, [4, -32, -34], [8, -6, -26], [20, 26, -18]),
  'ANAT-CN-VII': T(1.3, [12, -34, -36], [24, -30, -34], [36, -24, -30]), 'ANAT-CN-VIII': T(1.4, [14, -36, -37], [22, -34, -36], [28, -32, -36]),
  'ANAT-CN-IX': T(1.1, [10, -40, -44], [20, -36, -50], [28, -30, -58]), 'ANAT-CN-X': T(1.3, [8, -42, -46], [16, -40, -58], [20, -38, -78]),
  'ANAT-CN-XI': T(1, [6, -44, -54], [16, -46, -66], [24, -48, -80]), 'ANAT-CN-XII': T(1.1, [4, -40, -48], [10, -24, -56], [12, -4, -60]),
};

export function shapeOf(a: AnatomicalEntity): Shape {
  const s = SHAPES[a.id];
  if (s) return s;
  if (!a.mniCentroidMm) return { kind: 'none' };
  if (a.division === 'GYRI_AND_SULCI' || a.division === 'CEREBRAL_CORTEX') return { kind: 'marker' };
  return E(3.5, 3.5, 3.5);
}

const unitSphere = withBoundsTree(new THREE.SphereGeometry(1, 24, 18));
let foliaGeometry: THREE.BufferGeometry | null = null;
/** Unit sphere with fine horizontal ridges, used for the cerebellar hemispheres (decorative folia). */
export function getFoliaSphere(): THREE.BufferGeometry {
  if (foliaGeometry) return foliaGeometry;
  const g = new THREE.SphereGeometry(1, 48, 64);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i), k = 1 + 0.035 * Math.sin(y * 46);
    pos.setXYZ(i, pos.getX(i) * k, y, pos.getZ(i) * k);
  }
  g.computeVertexNormals();
  foliaGeometry = withBoundsTree(g);
  return foliaGeometry;
}
export const getUnitSphere = () => unitSphere;

/** Tube along a Catmull–Rom path given in MNI millimetres (mirrored across the midline when `mirror` is set). */
export function buildTube(path: Mni[], radius: number, mirror: boolean, flattenX = 1): THREE.BufferGeometry {
  const pts = path.map((p) => toWorld([mirror ? -p[0] : p[0], p[1], p[2]]));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
  const g = new THREE.TubeGeometry(curve, Math.max(12, path.length * 10), radius * MM, 10, false);
  if (flattenX !== 1) g.scale(flattenX, 1, 1);
  return withBoundsTree(g);
}

/** True when a structure exists on both sides and the registry gives one lateral centroid. */
export function isBilateral(a: AnatomicalEntity, shape: Shape): boolean {
  if (shape.kind === 'tube') return shape.path.every((p) => Math.abs(p[0]) >= 3) && !a.id.includes('ARCUATE');
  return a.mniCentroidMm !== null && Math.abs(a.mniCentroidMm[0]) >= 3;
}

/** Midline structures given at x = 0 that are really paired just off the midline (cingulate cortex markers). */
export const PAIRED_MIDLINE_OFFSET_MM = 5;
