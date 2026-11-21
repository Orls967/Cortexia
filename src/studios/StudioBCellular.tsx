import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { clearHoverTarget, scheduleHoverTarget, useSelectionStore } from '../stores/selectionStore';
import { withBoundsTree } from './common/bvh';
import { StudioViewport, type CameraPreset } from './common/StudioViewport';

export const CELLULAR_PRESETS: CameraPreset[] = [
  { id: 'overview', label: 'Overview', position: [0, 2.5, 11], target: [0, 0.5, 0] },
  { id: 'soma', label: 'Soma & AIS', position: [3.2, 0.8, 3.8], target: [0, 0, 0] },
  { id: 'dendrite', label: 'Apical Tuft', position: [2.5, 4.5, 4.5], target: [0, 2.8, 0] },
  { id: 'axon', label: 'Myelinated Axon', position: [2.2, -3.5, 5.2], target: [0, -2.5, 0] },
];

export type CellMorphologyId =
  | 'CELL-PYRAMIDAL-L5'
  | 'CELL-PYRAMIDAL-CA1'
  | 'CELL-INTERNEURON-PV-BASKET'
  | 'CELL-PURKINJE'
  | 'CELL-MOTOR-ALPHA'
  | 'CELL-SENSORY-DRG'
  | 'CELL-ASTROCYTE-PROTOPLASMIC'
  | 'CELL-OLIGODENDROCYTE'
  | 'CELL-MICROGLIA'
  | 'CELL-EPENDYMAL';

const CELL_LABELS: Record<CellMorphologyId, { name: string; kind: 'neuron' | 'glia'; somaUm: number; arborUm: number; myelinated: boolean }> = {
  'CELL-PYRAMIDAL-L5': { name: 'Cortical L5 Pyramidal Neuron', kind: 'neuron', somaUm: 22, arborUm: 1100, myelinated: true },
  'CELL-PYRAMIDAL-CA1': { name: 'Hippocampal CA1 Pyramidal Neuron', kind: 'neuron', somaUm: 18, arborUm: 820, myelinated: true },
  'CELL-INTERNEURON-PV-BASKET': { name: 'Parvalbumin (PV+) Basket Interneuron', kind: 'neuron', somaUm: 15, arborUm: 450, myelinated: false },
  'CELL-PURKINJE': { name: 'Cerebellar Purkinje Neuron', kind: 'neuron', somaUm: 28, arborUm: 650, myelinated: true },
  'CELL-MOTOR-ALPHA': { name: 'Spinal Alpha Motor Neuron', kind: 'neuron', somaUm: 45, arborUm: 1400, myelinated: true },
  'CELL-SENSORY-DRG': { name: 'DRG Pseudounipolar Sensory Neuron', kind: 'neuron', somaUm: 35, arborUm: 950, myelinated: true },
  'CELL-ASTROCYTE-PROTOPLASMIC': { name: 'Protoplasmic Astrocyte', kind: 'glia', somaUm: 11, arborUm: 90, myelinated: false },
  'CELL-OLIGODENDROCYTE': { name: 'Myelinating Oligodendrocyte', kind: 'glia', somaUm: 10, arborUm: 140, myelinated: true },
  'CELL-MICROGLIA': { name: 'Ramified Surveillance Microglia', kind: 'glia', somaUm: 8, arborUm: 70, myelinated: false },
  'CELL-EPENDYMAL': { name: 'Ciliated Ependymal Epithelial Sheet', kind: 'glia', somaUm: 14, arborUm: 45, myelinated: false },
};

function ApPulse({ myelinated, playing, speed }: { myelinated: boolean; playing: boolean; speed: number }) {
  const pulseRef = useRef<THREE.Mesh | null>(null);
  const phase = useRef(0);

  useFrame((_, delta) => {
    if (!pulseRef.current) return;
    if (playing) phase.current = (phase.current + delta * speed * (myelinated ? 0.65 : 0.28)) % 1;
    // Saltatory jumps between nodes at y = -1.25, -2.35, -3.45, -4.55 when myelinated
    const y = myelinated
      ? -0.9 - Math.floor(phase.current * 4) * 1.05 - ((phase.current * 4) % 1) * 0.15
      : -0.9 - phase.current * 4.2;
    pulseRef.current.position.set(0, y, 0);
  });

  return (
    <group ref={pulseRef} position={[0, -0.9, 0]}>
      <mesh>
        <sphereGeometry args={[0.18, 16, 12]} />
        <meshStandardMaterial color="#fde047" emissive="#f59e0b" emissiveIntensity={1.6} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.32, 16, 12]} />
        <meshBasicMaterial color="#f59e0b" transparent opacity={0.28} depthWrite={false} />
      </mesh>
    </group>
  );
}

interface StudioBCellularProps {
  cellId?: CellMorphologyId;
  onSelectCell?: (id: CellMorphologyId) => void;
  height?: number | string;
}

export function StudioBCellular({ cellId = 'CELL-PYRAMIDAL-L5', onSelectCell, height = 430 }: StudioBCellularProps) {
  const [preset, setPreset] = useState<CameraPreset>(CELLULAR_PRESETS[0]!);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [myelinatedOverride, setMyelinatedOverride] = useState<boolean | null>(null);
  const [isolatePart, setIsolatePart] = useState<string | null>(null);

  const selectEntity = useSelectionStore((s) => s.selectEntity);
  const selectedId = useSelectionStore((s) => s.selectedEntityId);

  const info = CELL_LABELS[cellId];
  const isMyelinated = myelinatedOverride ?? info.myelinated;

  const dendriteGeometries = useMemo(() => {
    const branches: { key: string; pts: THREE.Vector3[]; r: number }[] = [];
    if (cellId === 'CELL-PURKINJE') {
      // Planar dense candelabra arbor
      for (let i = -3; i <= 3; i++) {
        const x1 = i * 0.55;
        branches.push({
          key: `p-${i}`,
          pts: [new THREE.Vector3(0, 0.5, 0), new THREE.Vector3(x1 * 0.6, 2.0, 0), new THREE.Vector3(x1, 3.8, (i % 2) * 0.15)],
          r: 0.06,
        });
        branches.push({
          key: `p2-${i}`,
          pts: [new THREE.Vector3(x1 * 0.6, 2.0, 0), new THREE.Vector3(x1 * 1.25, 3.4, -0.1)],
          r: 0.04,
        });
      }
    } else if (cellId === 'CELL-SENSORY-DRG') {
      // Pseudounipolar T-stem from offset soma bifurcating into peripheral (up) & central (down to AIS/axon) branches
      branches.push({
        key: 'drg-stem',
        pts: [new THREE.Vector3(1.15, 0.25, 0), new THREE.Vector3(0.45, 0.25, 0), new THREE.Vector3(0, 0.25, 0)],
        r: 0.09,
      });
      branches.push({
        key: 'drg-peripheral',
        pts: [new THREE.Vector3(0, 0.25, 0), new THREE.Vector3(0, 2.0, 0), new THREE.Vector3(-0.35, 3.7, 0.2)],
        r: 0.07,
      });
      branches.push({
        key: 'drg-periph-twig-1',
        pts: [new THREE.Vector3(-0.18, 2.8, 0.1), new THREE.Vector3(0.45, 3.6, -0.25)],
        r: 0.04,
      });
    } else if (cellId === 'CELL-MOTOR-ALPHA') {
      // Multipolar stellate spinal motor neuron with thick radiating dendrites in 3D
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        const elev = (i % 2 === 0 ? 1 : -0.35) * 1.15;
        branches.push({
          key: `motor-${i}`,
          pts: [
            new THREE.Vector3(0, 0.1, 0),
            new THREE.Vector3(Math.cos(ang) * 1.5, 0.4 + elev * 0.6, Math.sin(ang) * 1.5),
            new THREE.Vector3(Math.cos(ang + 0.18) * 2.7, 0.6 + elev, Math.sin(ang + 0.18) * 2.7),
          ],
          r: 0.07,
        });
      }
    } else if (cellId === 'CELL-EPENDYMAL') {
      // Apical motile cilia tufts projecting into the ventricular lumen
      for (let i = -3; i <= 3; i++) {
        const x = i * 0.16;
        branches.push({
          key: `cilium-${i}`,
          pts: [new THREE.Vector3(x, 0.55, (i % 2) * 0.12), new THREE.Vector3(x * 1.2 + 0.15, 1.35, (i % 2) * 0.18), new THREE.Vector3(x * 1.4 + 0.3, 2.1, 0)],
          r: 0.032,
        });
      }
    } else if (cellId === 'CELL-OLIGODENDROCYTE') {
      // Processes reaching out to wrap nearby axonal internode segments
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2;
        const yTarget = ((i % 3) - 1) * 1.4;
        branches.push({
          key: `oligo-${i}`,
          pts: [
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(Math.cos(ang) * 1.1, yTarget * 0.5, Math.sin(ang) * 1.1),
            new THREE.Vector3(Math.cos(ang) * 2.1, yTarget, Math.sin(ang) * 2.1),
          ],
          r: 0.05,
        });
      }
    } else if (cellId === 'CELL-INTERNEURON-PV-BASKET' || info.kind === 'glia') {
      const count = cellId === 'CELL-MICROGLIA' ? 8 : 7;
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2;
        const elev = ((i % 3) - 1) * 1.1;
        branches.push({
          key: `rad-${i}`,
          pts: [
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(Math.cos(ang) * 1.4, elev * 0.6, Math.sin(ang) * 1.4),
            new THREE.Vector3(Math.cos(ang + 0.25) * 2.5, elev, Math.sin(ang + 0.25) * 2.5),
          ],
          r: info.kind === 'glia' ? 0.07 : 0.055,
        });
      }
    } else {
      // Apical shaft + tuft + basal dendrites (Pyramidal L5 / CA1)
      branches.push({
        key: 'apical-main',
        pts: [new THREE.Vector3(0, 0.5, 0), new THREE.Vector3(0.08, 2.1, 0), new THREE.Vector3(0, 3.7, 0)],
        r: 0.1,
      });
      for (let i = 0; i < 4; i++) {
        const ang = (i / 4) * Math.PI * 2 + 0.4;
        branches.push({
          key: `tuft-${i}`,
          pts: [new THREE.Vector3(0, 3.3, 0), new THREE.Vector3(Math.cos(ang) * 1.1, 4.3, Math.sin(ang) * 1.1)],
          r: 0.045,
        });
      }
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2;
        branches.push({
          key: `basal-${i}`,
          pts: [new THREE.Vector3(0, -0.2, 0), new THREE.Vector3(Math.cos(ang) * 1.4, -0.6, Math.sin(ang) * 1.4), new THREE.Vector3(Math.cos(ang) * 2.2, -0.95, Math.sin(ang) * 2.2)],
          r: 0.055,
        });
      }
    }
    return branches.map((b) => ({
      key: b.key,
      geometry: withBoundsTree(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(b.pts), 16, b.r, 8, false)),
    }));
  }, [cellId, info.kind]);

  useEffect(() => () => {
    for (const b of dendriteGeometries) b.geometry.dispose();
  }, [dendriteGeometries]);

  const hoverBind = (id: string, label: string, def: string) => ({
    onPointerOver: (e: { stopPropagation: () => void; nativeEvent: PointerEvent }) => {
      e.stopPropagation();
      scheduleHoverTarget({ entityId: id, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY, labelOverride: label, definitionOverride: def });
    },
    onPointerOut: clearHoverTarget,
    onClick: (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      clearHoverTarget();
      selectEntity(id, { scale: 'L3' });
    },
  });

  const pyramidalSomaGeo = useMemo(() => {
    const pts = [
      new THREE.Vector2(0.01, -0.45),
      new THREE.Vector2(0.46, -0.35),
      new THREE.Vector2(0.56, -0.12),
      new THREE.Vector2(0.42, 0.18),
      new THREE.Vector2(0.22, 0.45),
      new THREE.Vector2(0.11, 0.68),
      new THREE.Vector2(0.01, 0.72),
    ];
    return withBoundsTree(new THREE.LatheGeometry(pts, 24));
  }, []);

  useEffect(() => () => pyramidalSomaGeo.dispose(), [pyramidalSomaGeo]);

  const showPart = (p: string) => !isolatePart || isolatePart === p;

  const hasSpines = cellId.includes('PYRAMIDAL') || cellId === 'CELL-PURKINJE';
  const somaPosition: [number, number, number] = cellId === 'CELL-SENSORY-DRG' ? [1.25, 0.25, 0] : [0, 0.05, 0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <StudioViewport
        title="Studio B — Cellular Morphology"
        studioTag="STUDIO B · L2–L3"
        presets={CELLULAR_PRESETS}
        activePreset={preset}
        onSelectPreset={setPreset}
        disclosure={`Procedural parametric ${info.name} morphology (MIT_PROCEDURAL). Scale: soma ~${info.somaUm} µm, arbor span ~${info.arborUm} µm; illustrative compartments.`}
        height={height}
        fallback2D={
          <div className="cx-card">
            <strong>{info.name} — Accessible Compartment Map</strong>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              <button type="button" className="cx-entity-chip" onClick={() => selectEntity(cellId)}>Soma ({info.name})</button>
              <button type="button" className="cx-entity-chip" onClick={() => selectEntity('CELL-COMP-DENDRITIC-SPINE')}>Dendritic Spines</button>
              <button type="button" className="cx-entity-chip" onClick={() => selectEntity('CELL-COMP-AIS')}>Axon Initial Segment (AIS)</button>
              <button type="button" className="cx-entity-chip" onClick={() => selectEntity('CELL-OLIGODENDROCYTE')}>Myelin Internodes</button>
              <button type="button" className="cx-entity-chip" onClick={() => selectEntity('MECH-003')}>Action Potential Propagation</button>
            </div>
          </div>
        }
      >
        {/* Soma */}
        {showPart('soma') && (
          <mesh
            name={cellId}
            position={somaPosition}
            geometry={cellId.includes('PYRAMIDAL') ? pyramidalSomaGeo : undefined}
            {...hoverBind(cellId, `${info.name} — Soma`, `Cell body (~${info.somaUm} µm) integrating synaptic potentials and housing the nucleus.`)}
          >
            {!cellId.includes('PYRAMIDAL') && (
              cellId === 'CELL-EPENDYMAL' ? (
                <cylinderGeometry args={[0.62, 0.62, 1.05, 20]} />
              ) : (
                <sphereGeometry args={[cellId === 'CELL-MOTOR-ALPHA' ? 0.66 : 0.55, 24, 18]} />
              )
            )}
            <meshPhysicalMaterial
              color={selectedId === cellId ? '#38BDF8' : info.kind === 'glia' ? '#10B981' : '#0EA5E9'}
              emissive={selectedId === cellId ? '#38bdf8' : '#0369a1'}
              emissiveIntensity={selectedId === cellId ? 0.45 : 0.14}
              roughness={0.28}
              clearcoat={0.35}
            />
          </mesh>
        )}

        {/* Dendritic / Glial Arbors (Memoized & disposed) */}
        {showPart('dendrites') && dendriteGeometries.map((b) => (
          <mesh
            key={b.key}
            geometry={b.geometry}
            {...hoverBind(cellId, `${info.name} — Arbors`, 'Dendritic / cellular branches receiving excitatory and inhibitory inputs.')}
          >
            <meshStandardMaterial color={info.kind === 'glia' ? '#34D399' : '#38BDF8'} roughness={0.38} />
          </mesh>
        ))}

        {/* Mushroom Dendritic Spines (Neck + Head) on Spiny Neurons */}
        {hasSpines && showPart('spines') && [1.2, 1.8, 2.5, 3.0].map((y, idx) => {
          const side = idx % 2 === 0 ? 1 : -1;
          return (
            <group
              key={y}
              position={[side * 0.1, y, 0.06]}
              rotation={[0, 0, -side * 1.25]}
              {...hoverBind('CELL-COMP-DENDRITIC-SPINE', 'Dendritic Spine', 'Postsynaptic protrusion housing AMPA/NMDA receptors and biochemical Ca²⁺ microdomains.')}
            >
              <mesh position={[0, 0.08, 0]}>
                <cylinderGeometry args={[0.022, 0.028, 0.14, 8]} />
                <meshStandardMaterial color="#c084fc" />
              </mesh>
              <mesh name="CELL-COMP-DENDRITIC-SPINE" position={[0, 0.17, 0]}>
                <sphereGeometry args={[0.075, 12, 10]} />
                <meshStandardMaterial color={selectedId === 'CELL-COMP-DENDRITIC-SPINE' ? '#F59E0B' : '#A855F7'} emissive="#7e22ce" emissiveIntensity={0.25} roughness={0.3} />
              </mesh>
            </group>
          );
        })}

        {/* Neuron Axon + AIS + Myelin + Terminals */}
        {info.kind === 'neuron' && (
          <group>
            {showPart('ais') && (
              <mesh
                name="CELL-COMP-AIS"
                position={[0, -0.68, 0]}
                {...hoverBind('CELL-COMP-AIS', 'Axon Initial Segment (AIS)', 'High-density NaV1.6 domain where action potentials initiate.')}
              >
                <cylinderGeometry args={[0.09, 0.075, 0.55, 12]} />
                <meshStandardMaterial color="#F59E0B" emissive="#F59E0B" emissiveIntensity={0.4} />
              </mesh>
            )}

            {showPart('axon') && (
              <mesh
                name="MECH-003"
                position={[0, -3.0, 0]}
                {...hoverBind('MECH-003', 'Axon Shaft', 'Conducts action potentials down to presynaptic terminals.')}
              >
                <cylinderGeometry args={[0.055, 0.055, 4.2, 12]} />
                <meshStandardMaterial color="#94A3B8" />
              </mesh>
            )}

            {isMyelinated && showPart('myelin') && [-1.45, -2.55, -3.65, -4.65].map((y, idx) => (
              <mesh
                key={idx}
                name="CELL-OLIGODENDROCYTE"
                position={[0, y, 0]}
                {...hoverBind('CELL-OLIGODENDROCYTE', 'Myelin Internode (Oligodendrocyte)', 'Insulating lipid sheath reducing membrane capacitance and speeding saltatory conduction across Nodes of Ranvier.')}
              >
                <capsuleGeometry args={[0.17, 0.56, 8, 18]} />
                <meshPhysicalMaterial color="#a855f7" emissive="#581c87" emissiveIntensity={0.22} transparent opacity={0.72} roughness={0.22} clearcoat={0.45} />
              </mesh>
            ))}

            {showPart('terminals') && [-0.45, 0, 0.45].map((tx, i) => (
              <mesh
                key={i}
                position={[tx, -5.2, (i - 1) * 0.25]}
                {...hoverBind('MECH-020', 'Presynaptic Bouton', 'Axonal terminal where action potentials open CaV2.1 channels to trigger vesicle exocytosis.')}
              >
                <sphereGeometry args={[0.16, 12, 10]} />
                <meshStandardMaterial color="#06B6D4" />
              </mesh>
            ))}

            <ApPulse myelinated={isMyelinated} playing={playing} speed={speed} />
          </group>
        )}
      </StudioViewport>

      {/* Studio B Interactive Controls */}
      <div className="cx-card" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 12 }}>
            Cell Class:{' '}
            <select
              className="cx-select"
              value={cellId}
              onChange={(e) => {
                const next = e.target.value as CellMorphologyId;
                setMyelinatedOverride(null);
                onSelectCell?.(next);
                selectEntity(next, { openInspector: false });
              }}
            >
              {(Object.keys(CELL_LABELS) as CellMorphologyId[]).map((id) => (
                <option key={id} value={id}>{CELL_LABELS[id].name}</option>
              ))}
            </select>
          </label>
          <button type="button" className="cx-btn" onClick={() => setPlaying((p) => !p)}>
            {playing ? 'Pause AP Pulse' : 'Play AP Pulse'}
          </button>
          <button
            type="button"
            className={`cx-btn${isMyelinated ? ' cx-btn-primary' : ''}`}
            onClick={() => setMyelinatedOverride(!isMyelinated)}
          >
            {isMyelinated ? 'Saltatory (Myelinated)' : 'Continuous (Unmyelinated)'}
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12 }}>Speed:</span>
          <input type="range" min={0.2} max={2.5} step={0.1} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} aria-label="Action potential speed" />
          <span className="tabular" style={{ fontSize: 11 }}>{speed.toFixed(1)}×</span>
          {(['all', 'soma', 'dendrites', 'ais', 'myelin'] as const).map((pt) => (
            <button
              key={pt}
              type="button"
              className={`cx-btn${(pt === 'all' && !isolatePart) || isolatePart === pt ? ' cx-btn-primary' : ''}`}
              style={{ fontSize: 11, padding: '3px 7px' }}
              onClick={() => setIsolatePart(pt === 'all' ? null : pt)}
            >
              {pt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
