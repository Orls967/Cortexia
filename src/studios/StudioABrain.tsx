import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { loadRegistry } from '../data/registry';
import type { AnatomicalEntity } from '../data/types';
import { clearHoverTarget, scheduleHoverTarget, useSelectionStore } from '../stores/selectionStore';
import { StudioViewport, type CameraPreset } from './common/StudioViewport';

export const BRAIN_CAMERA_PRESETS: CameraPreset[] = [
  { id: 'anterior', label: 'Anterior', position: [0, 1.5, 13.5], target: [0, 0, 0] },
  { id: 'posterior', label: 'Posterior', position: [0, 1.5, -13.5], target: [0, 0, 0] },
  { id: 'left', label: 'Left Lat', position: [-14, 1.2, 0], target: [0, 0, 0] },
  { id: 'right', label: 'Right Lat', position: [14, 1.2, 0], target: [0, 0, 0] },
  { id: 'superior', label: 'Dorsal', position: [0, 14.5, 0.2], target: [0, 0, 0] },
  { id: 'inferior', label: 'Ventral', position: [0, -14.5, 0.2], target: [0, 0, 0] },
  { id: 'medial', label: 'Sagittal', position: [9.5, 1.5, 6.5], target: [0, 0, 0] },
  { id: 'limbic', label: 'Deep Limbic', position: [5.5, 2.2, 6.2], target: [0, -0.4, 0] },
];

// Convert MNI stereotaxic mm (+X right, +Y anterior, +Z superior) to Three.js world units (+X right, +Y superior, +Z anterior)
const mniToWorld = (mni: [number, number, number], explode = 0): [number, number, number] => {
  const s = 0.055;
  const wx = mni[0] * s;
  const wy = mni[2] * s;
  const wz = mni[1] * s;
  const mag = Math.hypot(wx, wy, wz) || 1;
  return [wx + (wx / mag) * explode, wy + (wy / mag) * explode * 0.4, wz + (wz / mag) * explode * 0.6];
};

const DIVISION_COLOR: Record<string, string> = {
  CORTICAL_LOBE: '#38BDF8',
  CORTICAL_GYRUS_SULCUS: '#06B6D4',
  LIMBIC_HIPPOCAMPAL: '#10B981',
  DIENCEPHALON: '#A855F7',
  BASAL_GANGLIA: '#F59E0B',
  CEREBELLUM: '#FB7185',
  BRAINSTEM: '#60A5FA',
  SPINAL_PNS: '#94A3B8',
  WHITE_MATTER_TRACT: '#CBD5E1',
  VENTRICULAR: '#22D3EE',
};

function layerGroupOf(div: string): 'cortex' | 'limbic' | 'subcortical' | 'hindbrain' {
  if (div.includes('CORTICAL') || div === 'TELENCEPHALON' || div === 'HEMISPHERE') return 'cortex';
  if (div.includes('LIMBIC') || div.includes('HIPPOCAMP')) return 'limbic';
  if (div.includes('DIENCEPHAL') || div.includes('BASAL') || div.includes('THALAM')) return 'subcortical';
  return 'hindbrain';
}

interface StudioABrainProps {
  highlightIds?: string[];
  regionActivity?: Float64Array | null;
  height?: number | string;
}

export function StudioABrain({ highlightIds = [], regionActivity = null, height = 460 }: StudioABrainProps) {
  const [anatomy, setAnatomy] = useState<AnatomicalEntity[]>([]);
  const [preset, setPreset] = useState<CameraPreset>(BRAIN_CAMERA_PRESETS[3]!);
  const [cortexOpacity, setCortexOpacity] = useState(0.22);
  const [explode, setExplode] = useState(0);
  const [isolateSelected, setIsolateSelected] = useState(false);
  const [layers, setLayers] = useState({ cortex: true, limbic: true, subcortical: true, hindbrain: true, tracts: true });
  const [clipSagittal, setClipSagittal] = useState(100);
  const [clipCoronal, setClipCoronal] = useState(100);
  const [clipAxial, setClipAxial] = useState(100);

  const selectedId = useSelectionStore((s) => s.selectedEntityId);
  const selectEntity = useSelectionStore((s) => s.selectEntity);

  useEffect(() => {
    loadRegistry('anatomy').then(setAnatomy).catch(() => {});
  }, []);

  const structures = useMemo(
    () => anatomy.filter((a) => a.mniCentroidMm !== null && !a.id.includes('HEMISPHERE')),
    [anatomy],
  );

  const clippingPlanes = useMemo(
    () => [
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), clipSagittal * 0.055),
      new THREE.Plane(new THREE.Vector3(0, 0, -1), clipCoronal * 0.055),
      new THREE.Plane(new THREE.Vector3(0, -1, 0), clipAxial * 0.055),
    ],
    [clipSagittal, clipCoronal, clipAxial],
  );

  const selectedEntity = useMemo(() => anatomy.find((a) => a.id === selectedId) ?? null, [anatomy, selectedId]);
  const highlightSet = useMemo(() => {
    const set = new Set<string>(highlightIds);
    if (selectedEntity) {
      set.add(selectedEntity.id);
      for (const c of selectedEntity.connectedStructureIds) set.add(c);
    }
    return set;
  }, [highlightIds, selectedEntity]);

  const byId = useMemo(() => new Map(anatomy.map((a) => [a.id, a])), [anatomy]);

  const tractLines = useMemo(() => {
    if (!layers.tracts) return [];
    const lines: { key: string; from: [number, number, number]; to: [number, number, number]; active: boolean }[] = [];
    for (const s of structures) {
      if (!s.mniCentroidMm) continue;
      for (const cid of s.connectedStructureIds) {
        if (s.id >= cid) continue;
        const t = byId.get(cid);
        if (!t?.mniCentroidMm) continue;
        const active = highlightSet.has(s.id) && highlightSet.has(t.id);
        if (isolateSelected && !active) continue;
        lines.push({
          key: `${s.id}->${t.id}`,
          from: mniToWorld(s.mniCentroidMm, layerGroupOf(s.division) === 'cortex' ? explode : 0),
          to: mniToWorld(t.mniCentroidMm, layerGroupOf(t.division) === 'cortex' ? explode : 0),
          active,
        });
      }
    }
    return lines;
  }, [structures, byId, highlightSet, isolateSelected, layers.tracts, explode]);

  const activeMni = selectedEntity?.mniCentroidMm ?? [0, 0, 0];

  const fallback2D = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
      <div className="cx-card">
        <strong>Sagittal / Coronal / Axial Coordinate Map</strong>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Click any structure in the hierarchy list to inspect its 12-section UCES record and MNI coordinates.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {structures.slice(0, 28).map((st) => (
            <button
              key={st.id}
              type="button"
              className={`cx-entity-chip${selectedId === st.id ? ' cx-btn-primary' : ''}`}
              onClick={() => selectEntity(st.id)}
            >
              {st.canonicalName}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <StudioViewport
        title="Studio A — Whole Brain"
        studioTag="STUDIO A · L6–L7"
        presets={BRAIN_CAMERA_PRESETS}
        activePreset={preset}
        onSelectPreset={setPreset}
        disclosure="Procedural parametric brain geometry anchored on registry MNI stereotaxic centroids (MIT_PROCEDURAL). Educational approximation; not a clinical MRI reconstruction."
        height={height}
        fallback2D={fallback2D}
      >
        {/* Translucent Left & Right Cerebral Hemisphere Shells */}
        {layers.cortex && (
          <group>
            <mesh
              name="ANAT-LEFT-HEMISPHERE"
              position={[-1.9 - explode * 0.4, 0.75, -0.3]}
              scale={[1.85, 2.25, 3.85]}
              onPointerOver={(e) => {
                e.stopPropagation();
                scheduleHoverTarget({ entityId: 'ANAT-LEFT-HEMISPHERE', x: e.nativeEvent.clientX, y: e.nativeEvent.clientY });
              }}
              onPointerOut={clearHoverTarget}
              onClick={(e) => { e.stopPropagation(); clearHoverTarget(); selectEntity('ANAT-LEFT-HEMISPHERE'); }}
            >
              <sphereGeometry args={[1, 28, 22]} />
              <meshPhysicalMaterial
                color={selectedId === 'ANAT-LEFT-HEMISPHERE' ? '#38bdf8' : '#1e3a5f'}
                transparent
                opacity={cortexOpacity}
                roughness={0.35}
                depthWrite={false}
                clippingPlanes={clippingPlanes}
              />
            </mesh>
            <mesh
              name="ANAT-RIGHT-HEMISPHERE"
              position={[1.9 + explode * 0.4, 0.75, -0.3]}
              scale={[1.85, 2.25, 3.85]}
              onPointerOver={(e) => {
                e.stopPropagation();
                scheduleHoverTarget({ entityId: 'ANAT-RIGHT-HEMISPHERE', x: e.nativeEvent.clientX, y: e.nativeEvent.clientY });
              }}
              onPointerOut={clearHoverTarget}
              onClick={(e) => { e.stopPropagation(); clearHoverTarget(); selectEntity('ANAT-RIGHT-HEMISPHERE'); }}
            >
              <sphereGeometry args={[1, 28, 22]} />
              <meshPhysicalMaterial
                color={selectedId === 'ANAT-RIGHT-HEMISPHERE' ? '#38bdf8' : '#1e3a5f'}
                transparent
                opacity={cortexOpacity}
                roughness={0.35}
                depthWrite={false}
                clippingPlanes={clippingPlanes}
              />
            </mesh>
          </group>
        )}

        {/* MNI-Anchored Anatomical Structures */}
        {structures.map((st, idx) => {
          const grp = layerGroupOf(st.division);
          if (!layers[grp]) return null;
          const isSel = selectedId === st.id;
          const isHi = highlightSet.has(st.id);
          if (isolateSelected && selectedId && !isHi) return null;

          const pos = mniToWorld(st.mniCentroidMm!, grp === 'cortex' ? explode : 0);
          const isLobe = st.division === 'CORTICAL_LOBE';
          const isCerebellum = st.id.includes('CEREBELLUM');
          const isStem = grp === 'hindbrain' && !isCerebellum;
          const baseRadius = isCerebellum ? 0.85 : isLobe ? 0.72 : isStem ? 0.48 : 0.34;
          const act = regionActivity && regionActivity.length > 0 ? regionActivity[idx % regionActivity.length]! : null;
          const baseColor = act !== null
            ? new THREE.Color().setHSL(0.55 - 0.42 * Math.max(0, Math.min(1, 0.5 + 0.5 * act)), 0.85, 0.55).getStyle()
            : isSel
              ? '#38BDF8'
              : isHi
                ? '#F59E0B'
                : DIVISION_COLOR[st.division] ?? '#38BDF8';

          return (
            <mesh
              key={st.id}
              name={st.id}
              userData={{ entityId: st.id }}
              position={pos}
              scale={isLobe ? [1.25, 0.9, 1.3] : isCerebellum ? [1.6, 0.9, 1.05] : [1, 1, 1.15]}
              onPointerOver={(e) => {
                e.stopPropagation();
                scheduleHoverTarget({
                  entityId: st.id,
                  x: e.nativeEvent.clientX,
                  y: e.nativeEvent.clientY,
                  valueText: `MNI (${st.mniCentroidMm!.join(', ')}) mm`,
                });
              }}
              onPointerOut={clearHoverTarget}
              onClick={(e) => {
                e.stopPropagation();
                clearHoverTarget();
                selectEntity(st.id, { scale: st.primaryScale });
              }}
            >
              {isStem ? <cylinderGeometry args={[0.32, 0.28, 0.95, 16]} /> : <sphereGeometry args={[baseRadius, 18, 14]} />}
              <meshStandardMaterial
                color={baseColor}
                emissive={isSel ? '#38bdf8' : isHi ? '#b45309' : '#000000'}
                emissiveIntensity={isSel ? 0.55 : isHi ? 0.25 : 0}
                roughness={0.35}
                metalness={0.1}
                transparent={isLobe}
                opacity={isLobe ? Math.max(0.28, cortexOpacity + 0.15) : 0.94}
                clippingPlanes={clippingPlanes}
              />
            </mesh>
          );
        })}

        {/* Tract / Relationship Arcs */}
        {tractLines.map((ln) => {
          const mid: [number, number, number] = [
            (ln.from[0] + ln.to[0]) * 0.5,
            (ln.from[1] + ln.to[1]) * 0.5 + 0.65,
            (ln.from[2] + ln.to[2]) * 0.5,
          ];
          const curve = new THREE.QuadraticBezierCurve3(
            new THREE.Vector3(...ln.from),
            new THREE.Vector3(...mid),
            new THREE.Vector3(...ln.to),
          );
          const geo = new THREE.TubeGeometry(curve, 16, ln.active ? 0.045 : 0.02, 6, false);
          return (
            <mesh key={ln.key} geometry={geo}>
              <meshBasicMaterial color={ln.active ? '#f59e0b' : '#38bdf8'} transparent opacity={ln.active ? 0.88 : 0.22} />
            </mesh>
          );
        })}
      </StudioViewport>

      {/* Studio A Interactive Controls & Orthogonal Slice Mini-Map */}
      <div className="cx-grid-2">
        <div className="cx-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="cx-card-title">Studio A Controls — Clipping, Opacity & Layers</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(['cortex', 'limbic', 'subcortical', 'hindbrain', 'tracts'] as const).map((k) => (
              <button
                key={k}
                type="button"
                className={`cx-btn${layers[k] ? ' cx-btn-primary' : ''}`}
                style={{ fontSize: 11, padding: '3px 8px' }}
                onClick={() => setLayers((prev) => ({ ...prev, [k]: !prev[k] }))}
              >
                {k}
              </button>
            ))}
            <button
              type="button"
              className={`cx-btn${isolateSelected ? ' cx-btn-primary' : ''}`}
              style={{ fontSize: 11, padding: '3px 8px' }}
              disabled={!selectedId}
              onClick={() => setIsolateSelected((v) => !v)}
            >
              Isolate Selected
            </button>
          </div>
          <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 110 }}>Cortex Opacity</span>
            <input type="range" min={0.05} max={0.85} step={0.05} value={cortexOpacity} onChange={(e) => setCortexOpacity(Number(e.target.value))} style={{ flex: 1 }} />
            <span className="tabular" style={{ width: 38 }}>{Math.round(cortexOpacity * 100)}%</span>
          </label>
          <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 110 }}>Explode Lobes</span>
            <input type="range" min={0} max={2.5} step={0.1} value={explode} onChange={(e) => setExplode(Number(e.target.value))} style={{ flex: 1 }} />
            <span className="tabular" style={{ width: 38 }}>{explode.toFixed(1)}</span>
          </label>
          <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 110 }}>Sagittal Clip X</span>
            <input type="range" min={-80} max={100} step={5} value={clipSagittal} onChange={(e) => setClipSagittal(Number(e.target.value))} style={{ flex: 1 }} />
            <span className="tabular" style={{ width: 46 }}>{clipSagittal} mm</span>
          </label>
          <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 110 }}>Coronal Clip Y</span>
            <input type="range" min={-100} max={100} step={5} value={clipCoronal} onChange={(e) => setClipCoronal(Number(e.target.value))} style={{ flex: 1 }} />
            <span className="tabular" style={{ width: 46 }}>{clipCoronal} mm</span>
          </label>
          <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 110 }}>Axial Clip Z</span>
            <input type="range" min={-60} max={100} step={5} value={clipAxial} onChange={(e) => setClipAxial(Number(e.target.value))} style={{ flex: 1 }} />
            <span className="tabular" style={{ width: 46 }}>{clipAxial} mm</span>
          </label>
        </div>

        {/* Orthogonal Slices SVG Trio */}
        <div className="cx-card">
          <div className="cx-card-title">
            <span>Orthogonal Stereotaxic Slices (MNI Crosshair)</span>
            <span className="tabular" style={{ fontSize: 11, color: 'var(--accent-ice-blue)' }}>
              ({activeMni[0]}, {activeMni[1]}, {activeMni[2]}) mm
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {[
              { name: 'Sagittal (Y-Z)', coords: (a: [number, number, number]) => [60 - a[1] * 0.45, 55 - a[2] * 0.55] as const },
              { name: 'Coronal (X-Z)', coords: (a: [number, number, number]) => [60 + a[0] * 0.55, 55 - a[2] * 0.55] as const },
              { name: 'Axial (X-Y)', coords: (a: [number, number, number]) => [60 + a[0] * 0.55, 60 - a[1] * 0.45] as const },
            ].map((view) => {
              const [cx, cy] = view.coords(activeMni);
              return (
                <div key={view.name} style={{ textAlign: 'center' }}>
                  <svg viewBox="0 0 120 110" style={{ width: '100%', background: '#090d16', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                    <ellipse cx={60} cy={55} rx={44} ry={40} fill="rgba(30,58,95,0.35)" stroke="#334155" strokeWidth={1.2} />
                    {structures.slice(0, 40).map((st) => {
                      const [px, py] = view.coords(st.mniCentroidMm!);
                      const isSel = selectedId === st.id;
                      return (
                        <circle
                          key={st.id}
                          cx={px}
                          cy={py}
                          r={isSel ? 4.2 : 2.1}
                          fill={isSel ? '#38BDF8' : '#64748B'}
                          style={{ cursor: 'pointer' }}
                          onClick={() => selectEntity(st.id)}
                        >
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
