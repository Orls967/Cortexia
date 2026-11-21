import type { ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { loadRegistry } from '../data/registry';
import type { AnatomicalEntity } from '../data/types';
import { clearHoverTarget, scheduleHoverTarget, useSelectionStore } from '../stores/selectionStore';
import {
  BRAIN_CENTER, buildCortex, buildTube, DIVISION_COLOR, DIVISION_LAYER, getFoliaSphere, getUnitSphere, isBilateral, MM,
  PAIRED_MIDLINE_OFFSET_MM, shapeOf, toWorld, type LayerKey, type LobeId, type Mni, type Shape,
} from './brain/brainGeometry';
import { StudioViewport, type CameraPreset } from './common/StudioViewport';

const C = toWorld(BRAIN_CENTER);
const TARGET: [number, number, number] = [C.x, C.y - 1.1, C.z + 0.3];

// World frame: +X right, +Y superior, −Z anterior (right-handed, so left and right are not mirrored).
export const BRAIN_CAMERA_PRESETS: CameraPreset[] = [
  { id: 'right', label: 'Right Lat', position: [17, 1.2, C.z], target: TARGET },
  { id: 'left', label: 'Left Lat', position: [-17, 1.2, C.z], target: TARGET },
  { id: 'anterior', label: 'Anterior', position: [0, 1.2, C.z - 17], target: TARGET },
  { id: 'posterior', label: 'Posterior', position: [0, 1.2, C.z + 17], target: TARGET },
  { id: 'superior', label: 'Dorsal', position: [0, 18, C.z + 0.01], target: TARGET },
  { id: 'inferior', label: 'Ventral', position: [0, -17, C.z + 0.01], target: TARGET },
  { id: 'medial', label: 'Medial', position: [17, 1.2, C.z], target: TARGET },
  { id: 'limbic', label: 'Deep Limbic', position: [9, 3.2, C.z - 8], target: [0.6, -0.2, C.z - 0.2] },
];

const LAYERS: { key: LayerKey; label: string }[] = [
  { key: 'cortex', label: 'Cortex' }, { key: 'limbic', label: 'Limbic' }, { key: 'subcortical', label: 'Subcortical' },
  { key: 'hindbrain', label: 'Brainstem & cerebellum' }, { key: 'tracts', label: 'White matter' },
];

interface Placed { entity: AnatomicalEntity; shape: Shape; layer: LayerKey; color: string; mirrored: boolean; key: string; center: Mni | null }

interface StudioABrainProps {
  /** Entities to emphasise (for example the core structures of a functional system). */
  highlightIds?: string[];
  height?: number | string;
}

export function StudioABrain({ highlightIds = [], height = 460 }: StudioABrainProps) {
  const [anatomy, setAnatomy] = useState<AnatomicalEntity[]>([]);
  const [preset, setPreset] = useState<CameraPreset>(BRAIN_CAMERA_PRESETS[0]!);
  const [cortexOpacity, setCortexOpacity] = useState(() => (highlightIds.length > 0 ? 0.22 : 1));
  const [explode, setExplode] = useState(0);
  const [isolateSelected, setIsolateSelected] = useState(false);
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({ cortex: true, limbic: true, subcortical: true, hindbrain: true, tracts: true });
  const [clipSagittal, setClipSagittal] = useState(100);
  const [clipCoronal, setClipCoronal] = useState(100);
  const [clipAxial, setClipAxial] = useState(100);

  const selectedId = useSelectionStore((s) => s.selectedEntityId);
  const selectEntity = useSelectionStore((s) => s.selectEntity);

  useEffect(() => {
    loadRegistry('anatomy').then(setAnatomy).catch(() => {});
  }, []);

  const byId = useMemo(() => new Map(anatomy.map((a) => [a.id, a])), [anatomy]);

  const cortex = useMemo(() => buildCortex(), []);
  useEffect(() => () => { for (const m of cortex) m.geometry.dispose(); }, [cortex]);

  // One entry per rendered mesh; bilateral structures get a mirrored twin.
  const placed = useMemo(() => {
    const out: Placed[] = [];
    for (const a of anatomy) {
      const shape = shapeOf(a);
      if (shape.kind === 'none' || shape.kind === 'cortex') continue;
      const layer = DIVISION_LAYER[a.division] ?? 'subcortical';
      const color = DIVISION_COLOR[a.division] ?? '#94a3b8';
      let center = a.mniCentroidMm as Mni | null;
      // Cingulate markers are listed on the midline; draw them just lateral to it on both sides.
      const pairedMidline = shape.kind === 'marker' && center !== null && Math.abs(center[0]) < 3;
      if (pairedMidline && center) center = [PAIRED_MIDLINE_OFFSET_MM, center[1], center[2]];
      out.push({ entity: a, shape, layer, color, mirrored: false, key: a.id, center });
      if (isBilateral(a, shape) || pairedMidline) out.push({ entity: a, shape, layer, color, mirrored: true, key: `${a.id}:mirror`, center: center ? [-center[0], center[1], center[2]] : null });
    }
    return out;
  }, [anatomy]);

  const tubes = useMemo(() => {
    const m = new Map<string, THREE.BufferGeometry>();
    for (const p of placed) if (p.shape.kind === 'tube') m.set(p.key, buildTube(p.shape.path, p.shape.radius, p.mirrored, p.shape.flattenX ?? 1));
    return m;
  }, [placed]);
  useEffect(() => () => { for (const g of tubes.values()) g.dispose(); }, [tubes]);

  // Parts of an aggregate (for example "Basal ganglia") are highlighted when the aggregate is selected.
  const descendants = useMemo(() => {
    const set = new Set<string>();
    if (!selectedId) return set;
    const children = new Map<string, string[]>();
    for (const a of anatomy) if (a.parentId) children.set(a.parentId, [...(children.get(a.parentId) ?? []), a.id]);
    const stack = [selectedId];
    while (stack.length) { const id = stack.pop()!; for (const c of children.get(id) ?? []) if (!set.has(c)) { set.add(c); stack.push(c); } }
    return set;
  }, [anatomy, selectedId]);

  const selectedEntity = selectedId ? byId.get(selectedId) ?? null : null;
  const connected = useMemo(() => new Set<string>([...highlightIds, ...(selectedEntity?.connectedStructureIds ?? [])]), [highlightIds, selectedEntity]);
  const emphasis = (id: string): 'selected' | 'part' | 'connected' | 'none' => (id === selectedId ? 'selected' : descendants.has(id) ? 'part' : connected.has(id) ? 'connected' : 'none');
  const anyEmphasis = selectedId !== null || highlightIds.length > 0;

  const clippingPlanes = useMemo(
    () => [
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), clipSagittal * MM), // keep x ≤ clip
      new THREE.Plane(new THREE.Vector3(0, 0, 1), clipCoronal * MM), // keep y ≤ clip (anterior is −Z)
      new THREE.Plane(new THREE.Vector3(0, -1, 0), clipAxial * MM), // keep z ≤ clip
    ],
    [clipSagittal, clipCoronal, clipAxial],
  );

  const choosePreset = (p: CameraPreset) => {
    setPreset(p);
    // The medial view removes the right hemisphere so the medial wall of the left one is visible.
    setClipSagittal(p.id === 'medial' ? 0 : 100);
    if (p.id === 'limbic') setCortexOpacity(0.12);
  };

  const handlers = (id: string, valueText?: string) => ({
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      scheduleHoverTarget({ entityId: id, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY, ...(valueText ? { valueText } : {}) });
    },
    onPointerOut: () => clearHoverTarget(),
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      clearHoverTarget();
      selectEntity(id, { scale: byId.get(id)?.primaryScale ?? 'L7' });
    },
  });

  const cortexSolid = cortexOpacity >= 0.98;
  // A translucent cortex lets pointer events through to the structures inside it.
  const cortexInteractive = cortexOpacity >= 0.5;
  const lobeEmphasis = (lobe: LobeId, side: 'L' | 'R') => {
    const hemi = side === 'L' ? 'ANAT-LEFT-HEMISPHERE' : 'ANAT-RIGHT-HEMISPHERE';
    const e = emphasis(lobe);
    if (e !== 'none') return e;
    if (selectedId === hemi || selectedId === 'ANAT-TELENCEPHALON') return 'part';
    return 'none';
  };

  // Relationship arcs for the current selection or highlighted system pathway: drawn as schematic arcs.
  const arcs = useMemo(() => {
    const out: { key: string; geometry: THREE.BufferGeometry }[] = [];
    const ids = selectedEntity ? selectedEntity.connectedStructureIds : [];
    const from = selectedEntity?.mniCentroidMm as Mni | null | undefined;
    if (from) {
      for (const id of ids) {
        const to = byId.get(id)?.mniCentroidMm as Mni | null | undefined;
        if (!to) continue;
        const a = toWorld(from), b = toWorld(to), mid = a.clone().add(b).multiplyScalar(0.5);
        mid.y += 0.25 + 0.2 * a.distanceTo(b);
        out.push({ key: id, geometry: new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 20, 0.035, 6, false) });
      }
    } else if (highlightIds.length > 1) {
      for (let i = 0; i < highlightIds.length - 1; i++) {
        const c1 = byId.get(highlightIds[i]!)?.mniCentroidMm as Mni | null | undefined;
        const c2 = byId.get(highlightIds[i + 1]!)?.mniCentroidMm as Mni | null | undefined;
        if (!c1 || !c2) continue;
        const a = toWorld(c1), b = toWorld(c2), mid = a.clone().add(b).multiplyScalar(0.5);
        mid.y += 0.2 + 0.18 * a.distanceTo(b);
        out.push({ key: `hl-${i}`, geometry: new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 20, 0.04, 6, false) });
      }
    }
    return out;
  }, [selectedEntity, byId, highlightIds]);
  useEffect(() => () => { for (const a of arcs) a.geometry.dispose(); }, [arcs]);

  const listed = useMemo(() => anatomy.filter((a) => a.mniCentroidMm !== null), [anatomy]);
  // Aggregates (shown through their parts) and structures without a stereotaxic centroid have no mesh of their own.
  const withoutGeometry = useMemo(() => anatomy.filter((a) => shapeOf(a).kind === 'none').length, [anatomy]);
  const activeMni = (selectedEntity?.mniCentroidMm as Mni | null | undefined) ?? [0, 0, 0];

  const fallback2D = (
    <div className="cx-card">
      <strong>Structures with stereotaxic centroids</strong>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Select any structure to open its explanation record; coordinates are registry MNI centroids.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {listed.map((st) => (
          <button key={st.id} type="button" className={`cx-entity-chip${selectedId === st.id ? ' cx-btn-primary' : ''}`} onClick={() => selectEntity(st.id)}>
            {st.canonicalName}
          </button>
        ))}
      </div>
    </div>
  );

  const materialProps = (p: Placed) => {
    const e = emphasis(p.entity.id);
    const dim = isolateSelected && anyEmphasis && e === 'none';
    const body = p.shape.kind === 'ellipsoid' && p.shape.body === true;
    const opacity = dim ? 0.06 : body ? (e === 'selected' ? 0.75 : 0.42) : 0.96;
    return {
      color: e === 'selected' ? '#38bdf8' : e === 'connected' ? '#f59e0b' : p.color,
      emissive: e === 'selected' ? '#0ea5e9' : e === 'part' ? '#0e7490' : e === 'connected' ? '#b45309' : '#000000',
      emissiveIntensity: e === 'selected' ? 0.55 : e === 'none' ? 0 : 0.35,
      transparent: opacity < 0.95, opacity, depthWrite: opacity >= 0.95,
      roughness: 0.45, metalness: 0.05, clippingPlanes, side: THREE.DoubleSide,
    };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <StudioViewport
        title="Studio A — Whole Brain"
        studioTag="STUDIO A · L6–L7"
        presets={BRAIN_CAMERA_PRESETS}
        activePreset={preset}
        onSelectPreset={choosePreset}
        disclosure={`Procedural educational approximation: a parametric cortex with decorative folds and simple shapes placed at registry MNI centroids. Lobe borders, sizes and fibre paths are schematic. It is not an atlas mesh or an MRI reconstruction.${withoutGeometry > 0 ? ` ${withoutGeometry} registry entries (aggregate divisions and structures without a stereotaxic centroid) have no shape of their own and are selected from the hierarchy list.` : ''}`}
        height={height}
        fallback2D={fallback2D}
      >
        {layers.cortex && cortex.map((m) => {
          const e = lobeEmphasis(m.lobe, m.side);
          const dim = isolateSelected && anyEmphasis && e === 'none';
          const dir = m.centroid.clone().sub(C).normalize().multiplyScalar(explode);
          const opacity = dim ? 0.05 : cortexOpacity;
          return (
            <mesh
              key={`${m.lobe}:${m.side}`}
              name={m.lobe}
              userData={{ entityId: m.lobe }}
              geometry={m.geometry}
              position={[dir.x + (m.side === 'L' ? -0.3 : 0.3) * explode, dir.y, dir.z]}
              {...(cortexInteractive && !dim ? handlers(m.lobe, m.side === 'L' ? 'Left hemisphere' : 'Right hemisphere') : { raycast: () => null })}
            >
              <meshStandardMaterial
                vertexColors
                color={e === 'selected' ? '#bae6fd' : '#ffffff'}
                emissive={e === 'selected' ? '#0ea5e9' : e === 'part' ? '#0e7490' : e === 'connected' ? '#b45309' : '#000000'}
                emissiveIntensity={e === 'none' ? 0 : 0.4}
                transparent={!cortexSolid || dim}
                opacity={opacity}
                depthWrite={cortexSolid && !dim}
                roughness={0.62}
                metalness={0.02}
                side={THREE.DoubleSide}
                clippingPlanes={clippingPlanes}
              />
            </mesh>
          );
        })}

        {placed.map((p) => {
          if (!layers[p.layer]) return null;
          const mat = materialProps(p);
          const ev = handlers(p.entity.id, p.entity.mniCentroidMm ? `MNI (${p.entity.mniCentroidMm.join(', ')}) mm · schematic shape` : 'schematic shape');
          if (p.shape.kind === 'tube') {
            const g = tubes.get(p.key);
            return g ? <mesh key={p.key} name={p.entity.id} userData={{ entityId: p.entity.id }} geometry={g} {...ev}><meshStandardMaterial {...mat} /></mesh> : null;
          }
          if (!p.center) return null;
          const pos = toWorld(p.center);
          if (p.shape.kind === 'marker') {
            // Cortical area marker: a small disc lying on the surface, oriented away from the brain centre.
            const out = pos.clone().sub(toWorld([p.center[0] > 0 ? 30 : -30, BRAIN_CENTER[1], BRAIN_CENTER[2]])).normalize();
            const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), out);
            const at = pos.clone().add(out.multiplyScalar(0.12));
            return (
              <mesh key={p.key} name={p.entity.id} userData={{ entityId: p.entity.id }} position={at} quaternion={q} scale={[0.3, 0.07, 0.3]} geometry={getUnitSphere()} {...ev}>
                <meshStandardMaterial {...mat} />
              </mesh>
            );
          }
          if (p.shape.kind !== 'ellipsoid') return null;
          const r = p.shape.r;
          return (
            <mesh
              key={p.key}
              name={p.entity.id}
              userData={{ entityId: p.entity.id }}
              position={pos}
              scale={[r[0] * MM, r[2] * MM, r[1] * MM]}
              geometry={p.shape.folia ? getFoliaSphere() : getUnitSphere()}
              renderOrder={p.shape.body ? 2 : 1}
              {...ev}
            >
              <meshStandardMaterial {...mat} />
            </mesh>
          );
        })}

        {layers.tracts && arcs.map((a) => (
          <mesh key={a.key} geometry={a.geometry} raycast={() => null}>
            <meshBasicMaterial color="#f59e0b" transparent opacity={0.9} />
          </mesh>
        ))}
      </StudioViewport>

      <div className="cx-grid-2">
        <div className="cx-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="cx-card-title">Studio A Controls — Clipping, Opacity & Layers</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {LAYERS.map((l) => (
              <button key={l.key} type="button" aria-pressed={layers[l.key]} className={`cx-btn${layers[l.key] ? ' cx-btn-primary' : ''}`} style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => setLayers((prev) => ({ ...prev, [l.key]: !prev[l.key] }))}>
                {l.label}
              </button>
            ))}
            <button type="button" aria-pressed={isolateSelected} className={`cx-btn${isolateSelected ? ' cx-btn-primary' : ''}`} style={{ fontSize: 11, padding: '3px 8px' }} disabled={!anyEmphasis} onClick={() => setIsolateSelected((v) => !v)}>
              Isolate Selected
            </button>
          </div>
          {([
            ['Cortex Opacity', cortexOpacity, 0.05, 1, 0.05, setCortexOpacity, `${Math.round(cortexOpacity * 100)}%`],
            ['Explode Lobes', explode, 0, 2.5, 0.1, setExplode, explode.toFixed(1)],
            ['Sagittal Clip X', clipSagittal, -80, 100, 5, setClipSagittal, `${clipSagittal} mm`],
            ['Coronal Clip Y', clipCoronal, -110, 100, 5, setClipCoronal, `${clipCoronal} mm`],
            ['Axial Clip Z', clipAxial, -60, 100, 5, setClipAxial, `${clipAxial} mm`],
          ] as const).map(([label, value, min, max, step, set, text]) => (
            <label key={label} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 110 }}>{label}</span>
              <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => set(Number(e.target.value))} style={{ flex: 1, minWidth: 0 }} />
              <span className="tabular" style={{ width: 52, textAlign: 'right' }}>{text}</span>
            </label>
          ))}
          <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>
            Lower the cortex opacity below 50% to hover and select structures inside the hemispheres. Amber arcs join the selected structure to its registry connections; they are schematic and do not trace fibre pathways.
          </p>
        </div>

        <div className="cx-card">
          <div className="cx-card-title">
            <span>Orthogonal Stereotaxic Projections (MNI)</span>
            <span className="tabular" style={{ fontSize: 11, color: 'var(--accent-ice-blue)' }}>({activeMni[0]}, {activeMni[1]}, {activeMni[2]}) mm</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {[
              { name: 'Sagittal (Y–Z)', outline: [60 - 17 * 0.5, 62 - 20 * 0.5, 44, 32], coords: (a: Mni) => [60 + a[1] * 0.5, 62 - a[2] * 0.5] as const },
              { name: 'Coronal (X–Z)', outline: [60, 62 - 20 * 0.5, 36, 32], coords: (a: Mni) => [60 + a[0] * 0.5, 62 - a[2] * 0.5] as const },
              { name: 'Axial (X–Y)', outline: [60, 55 + 17 * 0.5, 36, 44], coords: (a: Mni) => [60 + a[0] * 0.5, 55 - a[1] * 0.5] as const },
            ].map((view) => {
              const [cx, cy] = view.coords(activeMni);
              return (
                <div key={view.name} style={{ textAlign: 'center' }}>
                  <svg viewBox="0 0 120 110" role="img" aria-label={`${view.name} projection of structure centroids`} style={{ width: '100%', background: '#090d16', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                    <ellipse cx={view.outline[0]} cy={view.outline[1]} rx={view.outline[2]} ry={view.outline[3]} fill="rgba(30,58,95,0.35)" stroke="#334155" strokeWidth={1.2} />
                    {listed.map((st) => {
                      const [px, py] = view.coords(st.mniCentroidMm as Mni);
                      const isSel = selectedId === st.id;
                      return (
                        <circle key={st.id} cx={px} cy={py} r={isSel ? 4.2 : 1.8} fill={isSel ? '#38BDF8' : connected.has(st.id) ? '#F59E0B' : '#64748B'} style={{ cursor: 'pointer' }} onClick={() => selectEntity(st.id)}>
                          <title>{st.canonicalName}</title>
                        </circle>
                      );
                    })}
                    <line x1={cx} y1={4} x2={cx} y2={106} stroke="#F59E0B" strokeWidth={0.8} strokeDasharray="3 2" />
                    <line x1={4} y1={cy} x2={116} y2={cy} stroke="#F59E0B" strokeWidth={0.8} strokeDasharray="3 2" />
                  </svg>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>{view.name}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
