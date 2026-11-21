import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { clearHoverTarget, scheduleHoverTarget, useSelectionStore } from '../stores/selectionStore';
import { StudioViewport, type CameraPreset } from './common/StudioViewport';

export const SYNAPSE_PRESETS: CameraPreset[] = [
  { id: 'cleft', label: 'Synaptic Cleft', position: [0, 0.5, 9.2], target: [0, 0, 0] },
  { id: 'presyn', label: 'Active Zone', position: [3.2, 2.8, 5.2], target: [0, 1.4, 0] },
  { id: 'postsyn', label: 'PSD & Receptors', position: [-3.2, -1.6, 5.2], target: [0, -1.5, 0] },
  { id: 'channel', label: 'Channel Cutaway', position: [5.2, -1.2, 4.6], target: [2.2, -1.4, 0] },
];

const STAGES = [
  '1. Action Potential Arrival',
  '2. Presynaptic Ca²⁺ Influx (CaV2.1)',
  '3. SNARE & Synaptotagmin Fusion',
  '4. Cleft Neurotransmitter Diffusion',
  '5. AMPA / NMDA Receptor Opening',
  '6. EAAT2 Reuptake & CaMKII / LTP',
];

function ReceptorBundle({
  subunits,
  open,
  color,
  radius = 0.24,
  height = 0.62,
}: {
  subunits: 4 | 5;
  open: boolean;
  color: string;
  radius?: number;
  height?: number;
}) {
  const spread = open ? radius * 1.15 : radius * 0.72;
  const tilt = open ? 0.22 : 0.04;
  return (
    <group>
      {Array.from({ length: subunits }, (_, i) => {
        const ang = (i / subunits) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(ang) * spread, 0, Math.sin(ang) * spread]}
            rotation={[Math.sin(ang) * tilt, 0, -Math.cos(ang) * tilt]}
          >
            <capsuleGeometry args={[radius * 0.34, height * 0.65, 6, 10]} />
            <meshStandardMaterial color={color} emissive={open ? color : '#000000'} emissiveIntensity={open ? 0.35 : 0} roughness={0.35} />
          </mesh>
        );
      })}
    </group>
  );
}

function DiffusingTransmitters({ stage, color }: { stage: number; color: string }) {
  const ref = useRef<THREE.InstancedMesh | null>(null);
  const count = 48;
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const seeds = useMemo(
    () => Array.from({ length: count }, (_, i) => ({
      x0: ((i % 8) - 3.5) * 0.38,
      z0: (Math.floor(i / 8) - 2.5) * 0.35,
      phase: (i * 0.37) % 1,
    })),
    [],
  );

  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = clock.getElapsedTime();
    const spread = stage >= 3 ? Math.min(1, (stage - 2) * 0.45) : 0.05;
    for (let i = 0; i < count; i++) {
      const s = seeds[i]!;
      const y = stage < 2
        ? 1.45 + 0.12 * Math.sin(t + s.phase * 6)
        : 0.75 - spread * (1.2 + 0.4 * Math.sin(t * 2 + s.phase * 6));
      const x = s.x0 * (0.4 + spread * 1.1) + 0.12 * Math.sin(t * 2.5 + i);
      const z = s.z0 * (0.4 + spread * 1.1) + 0.12 * Math.cos(t * 2.1 + i);
      dummy.position.set(x, y, z);
      dummy.scale.setScalar(stage === 5 ? 0.65 : 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[0.075, 10, 8]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.45} />
    </instancedMesh>
  );
}

interface StudioCSynapticProps {
  initialMode?: 'chemical' | 'electrical' | 'channels';
  height?: number | string;
}

export function StudioCSynaptic({ initialMode = 'chemical', height = 430 }: StudioCSynapticProps) {
  const [mode, setMode] = useState<'chemical' | 'electrical' | 'channels'>(initialMode);
  const [stage, setStage] = useState(3);
  const [depolarized, setDepolarized] = useState(false);
  const [transmitter, setTransmitter] = useState<'glutamate' | 'gaba'>('glutamate');
  const [preset, setPreset] = useState<CameraPreset>(SYNAPSE_PRESETS[0]!);

  const selectEntity = useSelectionStore((s) => s.selectEntity);

  const hoverBind = (id: string, label: string, def: string) => ({
    onPointerOver: (e: { stopPropagation: () => void; nativeEvent: PointerEvent }) => {
      e.stopPropagation();
      scheduleHoverTarget({ entityId: id, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY, labelOverride: label, definitionOverride: def });
    },
    onPointerOut: clearHoverTarget,
    onClick: (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      clearHoverTarget();
      selectEntity(id, { scale: 'L1' });
    },
  });

  const ntId = transmitter === 'glutamate' ? 'MOL-NT-GLUTAMATE' : 'MOL-NT-GABA';
  const ntColor = transmitter === 'glutamate' ? '#38BDF8' : '#A855F7';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <StudioViewport
        title="Studio C — Synaptic & Molecular"
        studioTag="STUDIO C · L1–L4 (nm)"
        presets={SYNAPSE_PRESETS}
        activePreset={preset}
        onSelectPreset={setPreset}
        disclosure="Procedural nanoscale biophysical 3D schematic (MIT_PROCEDURAL). Receptor and channel geometries are educational schematics, not cryo-EM atomic coordinates."
        height={height}
        fallback2D={
          <div className="cx-card">
            <strong>Nanoscale Synaptic & Molecular Components</strong>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {['MOL-CH-CAV2-1', 'MOL-VES-SNARE', 'MOL-NT-GLUTAMATE', 'MOL-NT-GABA', 'MOL-REC-AMPAR', 'MOL-REC-NMDAR', 'MOL-REC-GABAA', 'MOL-TRANS-EAAT2', 'MOL-SIG-CAMKII', 'MECH-026'].map((id) => (
                <button key={id} type="button" className="cx-entity-chip" onClick={() => selectEntity(id)}>
                  {id}
                </button>
              ))}
            </div>
          </div>
        }
      >
        {mode === 'chemical' && (
          <group>
            {/* Presynaptic Terminal Dome + Active Zone Rim */}
            <group {...hoverBind('MECH-020', 'Presynaptic Terminal & Active Zone', 'Houses reserve and docked vesicles poised at the active zone for Ca²⁺-triggered exocytosis.')}>
              <mesh position={[0, 2.3, 0]} scale={[2.8, 1.5, 2.4]}>
                <sphereGeometry args={[1, 28, 18, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.65]} />
                <meshPhysicalMaterial color="#2563eb" emissive="#1e3a8a" emissiveIntensity={0.28} transparent opacity={0.42} roughness={0.25} clearcoat={0.4} side={THREE.DoubleSide} />
              </mesh>
              <mesh position={[0, 1.62, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[2.38, 0.055, 10, 48]} />
                <meshStandardMaterial color="#60a5fa" emissive="#3b82f6" emissiveIntensity={0.65} />
              </mesh>
            </group>

            {/* CaV2.1 Voltage-Gated Calcium Channels (4-subunit pore) */}
            {[-2.1, 2.1].map((x, idx) => (
              <group key={idx} position={[x, 1.35, 0.3]} {...hoverBind('MOL-CH-CAV2-1', 'CaV2.1 (P/Q-type) Calcium Channel', 'Opens upon terminal depolarization to create high-concentration Ca²⁺ microdomains driving Synaptotagmin-1.')}>
                <ReceptorBundle subunits={4} open={stage >= 1} color={stage >= 1 ? '#F59E0B' : '#64748B'} radius={0.2} height={0.55} />
              </group>
            ))}

            {/* Synaptic Vesicles & SNARE Fusion Complex */}
            {[-0.9, 0, 0.9].map((x, idx) => (
              <group key={idx}>
                <mesh position={[x, stage >= 2 && idx === 1 ? 1.05 : 1.75, 0]} {...hoverBind('MOL-VES-SNARE', 'Synaptic Vesicle & SNARE Machinery', 'Synaptobrevin, Syntaxin-1, SNAP-25 and Synaptotagmin-1 mediate millisecond vesicle fusion.')}>
                  <sphereGeometry args={[0.32, 16, 12]} />
                  <meshStandardMaterial color="#06B6D4" transparent opacity={0.78} />
                </mesh>
              </group>
            ))}

            {/* Perisynaptic Astrocyte & EAAT2 Transporters */}
            <mesh position={[3.3, 0, -0.4]} scale={[0.85, 1.6, 1.2]} {...hoverBind('MOL-TRANS-EAAT2', 'Astrocytic EAAT2 Glutamate Transporter', 'Clears cleft glutamate into perisynaptic astrocytic processes to terminate EPSPs and prevent excitotoxicity.')}>
              <capsuleGeometry args={[0.5, 1.2, 8, 14]} />
              <meshStandardMaterial color="#10B981" transparent opacity={0.65} />
            </mesh>

            {/* Postsynaptic Spine & PSD-95 Plaque */}
            <group {...hoverBind('MOL-SIG-PSD95', 'Postsynaptic Density (PSD-95 Scaffold)', 'Electron-dense protein scaffold anchoring AMPA, NMDA, and signaling enzymes opposite the active zone.')}>
              <mesh position={[0, -2.05, 0]}>
                <cylinderGeometry args={[2.85, 1.65, 1.45, 28]} />
                <meshPhysicalMaterial color="#334155" emissive="#0f172a" emissiveIntensity={0.35} roughness={0.4} clearcoat={0.25} />
              </mesh>
              <mesh position={[0, -1.32, 0]}>
                <cylinderGeometry args={[2.88, 2.88, 0.12, 28]} />
                <meshStandardMaterial color="#475569" emissive="#38bdf8" emissiveIntensity={0.18} roughness={0.3} />
              </mesh>
            </group>

            {/* Postsynaptic Receptors (Tetrameric AMPA/NMDA, Pentameric GABA_A) */}
            <group position={[-1.15, -1.2, 0]} {...hoverBind('MOL-REC-AMPAR', 'AMPA Receptor (Tetramer)', 'Fast ionotropic glutamate receptor mediating rapid Na⁺ influx and EPSP depolarization.')}>
              <ReceptorBundle subunits={4} open={stage >= 4 && transmitter === 'glutamate'} color={stage >= 4 && transmitter === 'glutamate' ? '#38BDF8' : '#475569'} radius={0.25} height={0.6} />
            </group>

            <group position={[0, -1.2, 0]}>
              <group {...hoverBind('MOL-REC-NMDAR', 'NMDA Receptor (Tetrameric Coincidence Detector)', 'Requires both glutamate binding and postsynaptic depolarization to expel the pore Mg²⁺ block and pass Ca²⁺.')}>
                <ReceptorBundle subunits={4} open={stage >= 4 && transmitter === 'glutamate' && depolarized} color={stage >= 4 && depolarized ? '#10B981' : '#A855F7'} radius={0.27} height={0.65} />
              </group>
              {!depolarized && (
                <mesh position={[0, 0.15, 0]}>
                  <sphereGeometry args={[0.13, 12, 10]} />
                  <meshStandardMaterial color="#F59E0B" emissive="#F59E0B" emissiveIntensity={0.8} />
                </mesh>
              )}
            </group>

            <group position={[1.15, -1.2, 0]} {...hoverBind('MOL-REC-GABAA', 'GABA_A Receptor (Pentameric Cl⁻ Channel)', 'Ionotropic inhibitory receptor passing Cl⁻ to produce hyperpolarizing or shunting inhibition.')}>
              <ReceptorBundle subunits={5} open={stage >= 4 && transmitter === 'gaba'} color={stage >= 4 && transmitter === 'gaba' ? '#A855F7' : '#475569'} radius={0.26} height={0.6} />
            </group>

            {/* CaMKII Hexamer inside Postsynaptic Spine */}
            <mesh position={[0, -2.15, 0.7]} {...hoverBind('MOL-SIG-CAMKII', 'CaMKII Holoenzyme', 'Ca²⁺/calmodulin-activated kinase driving E-LTP phosphorylation and AMPA receptor insertion.')}>
              <torusGeometry args={[0.32, 0.11, 10, 18]} />
              <meshStandardMaterial color={stage >= 5 ? '#F59E0B' : '#64748B'} emissive={stage >= 5 ? '#F59E0B' : '#000000'} emissiveIntensity={0.5} />
            </mesh>

            <group {...hoverBind(ntId, transmitter === 'glutamate' ? 'Glutamate Neurotransmitter' : 'GABA Neurotransmitter', 'Primary fast excitatory (glutamate) or inhibitory (GABA) transmitter diffusing across the ~20 nm cleft.')}>
              <DiffusingTransmitters stage={stage} color={ntColor} />
            </group>
          </group>
        )}

        {mode === 'electrical' && (
          <group>
            {/* Pre & Post membranes with hydrophilic headgroup rims bridged by connexon hemichannels */}
            <group position={[0, 1.5, 0]} {...hoverBind('MECH-026', 'Electrical Synapse (Presynaptic Membrane)', 'Connexin gap-junction plaque providing bidirectional ohmic coupling (I_gap = g_gap(V_pre - V_post)).')}>
              <mesh>
                <boxGeometry args={[5.5, 0.38, 3.2]} />
                <meshPhysicalMaterial color="#1e3a8a" emissive="#172554" emissiveIntensity={0.35} transparent opacity={0.82} roughness={0.3} />
              </mesh>
              <mesh position={[0, -0.2, 0]}>
                <boxGeometry args={[5.52, 0.05, 3.22]} />
                <meshStandardMaterial color="#38bdf8" emissive="#0284c7" emissiveIntensity={0.5} />
              </mesh>
            </group>
            <group position={[0, -1.5, 0]} {...hoverBind('MECH-026', 'Electrical Synapse (Postsynaptic Membrane)', 'Coupled postsynaptic membrane separated by a ~3.5 nm gap.')}>
              <mesh>
                <boxGeometry args={[5.5, 0.38, 3.2]} />
                <meshPhysicalMaterial color="#1e293b" emissive="#0f172a" emissiveIntensity={0.35} transparent opacity={0.85} roughness={0.3} />
              </mesh>
              <mesh position={[0, 0.2, 0]}>
                <boxGeometry args={[5.52, 0.05, 3.22]} />
                <meshStandardMaterial color="#38bdf8" emissive="#0284c7" emissiveIntensity={0.5} />
              </mesh>
            </group>
            {[-1.5, -0.5, 0.5, 1.5].map((x) => (
              <group key={x} position={[x, 0, 0]} {...hoverBind('MECH-026', 'Connexon Gap-Junction Channel', 'Paired hexameric connexin channel allowing direct electrotonic current and sub-millisecond synchrony.')}>
                <ReceptorBundle subunits={5} open color="#38BDF8" radius={0.26} height={2.5} />
              </group>
            ))}
          </group>
        )}

        {mode === 'channels' && (
          <group>
            {/* Phospholipid Bilayer with upper & lower hydrophilic headgroup planes */}
            <group position={[0, 0, 0]}>
              <mesh>
                <boxGeometry args={[7, 0.55, 3]} />
                <meshPhysicalMaterial color="#1e293b" transparent opacity={0.68} roughness={0.35} />
              </mesh>
              <mesh position={[0, 0.28, 0]}>
                <boxGeometry args={[7.02, 0.04, 3.02]} />
                <meshStandardMaterial color="#38bdf8" emissive="#0284c7" emissiveIntensity={0.45} />
              </mesh>
              <mesh position={[0, -0.28, 0]}>
                <boxGeometry args={[7.02, 0.04, 3.02]} />
                <meshStandardMaterial color="#38bdf8" emissive="#0284c7" emissiveIntensity={0.45} />
              </mesh>
            </group>
            {/* NaV1.1 (4-domain transmembrane bundle) */}
            <group position={[-1.8, 0, 0]} {...hoverBind('MOL-CH-NAV1-1', 'Voltage-Gated Sodium Channel (NaV1.1)', 'Fast m³ activation and h inactivation gates driving action potential depolarization.')}>
              <ReceptorBundle subunits={4} open color="#38BDF8" radius={0.45} height={1.15} />
            </group>
            {/* KV1.1 (4-subunit tetramer) */}
            <group position={[0, 0, 0]} {...hoverBind('MOL-CH-KV1-1', 'Delayed-Rectifier Potassium Channel (KV1.1)', 'Slower n⁴ activation gate repolarizing the membrane toward E_K.')}>
              <ReceptorBundle subunits={4} open color="#A855F7" radius={0.45} height={1.15} />
            </group>
            {/* Na+/K+ ATPase (alpha/beta heterodimer) */}
            <group position={[1.8, 0, 0]} {...hoverBind('MOL-PUMP-NAK-ATPASE', 'Na⁺/K⁺-ATPase Pump', 'Electrogenic pump exporting 3 Na⁺ and importing 2 K⁺ per ATP to maintain resting ionic gradients.')}>
              <mesh position={[-0.16, 0, 0]}>
                <capsuleGeometry args={[0.28, 0.85, 8, 14]} />
                <meshStandardMaterial color="#10B981" roughness={0.35} />
              </mesh>
              <mesh position={[0.22, 0.12, 0]}>
                <capsuleGeometry args={[0.18, 0.65, 8, 12]} />
                <meshStandardMaterial color="#34D399" roughness={0.35} />
              </mesh>
            </group>
          </group>
        )}
      </StudioViewport>

      {/* Studio C Interactive Controls */}
      <div className="cx-card" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['chemical', 'electrical', 'channels'] as const).map((m) => (
            <button key={m} type="button" className={`cx-btn${mode === m ? ' cx-btn-primary' : ''}`} onClick={() => setMode(m)}>
              {m === 'chemical' ? 'Chemical Synapse' : m === 'electrical' ? 'Electrical Gap Junction' : 'NaV / KV Channel Cutaway'}
            </button>
          ))}
        </div>
        {mode === 'chemical' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className={`cx-btn${transmitter === 'glutamate' ? ' cx-btn-primary' : ''}`} onClick={() => setTransmitter('glutamate')}>
              Glutamate (Excitatory)
            </button>
            <button type="button" className={`cx-btn${transmitter === 'gaba' ? ' cx-btn-primary' : ''}`} onClick={() => setTransmitter('gaba')}>
              GABA (Inhibitory)
            </button>
            <button type="button" className={`cx-btn${depolarized ? ' cx-btn-primary' : ''}`} onClick={() => setDepolarized((d) => !d)}>
              {depolarized ? 'Mg²⁺ Block Expelled (Depolarized)' : 'Mg²⁺ Pore Blocked (Resting)'}
            </button>
          </div>
        )}
      </div>

      {mode === 'chemical' && (
        <div className="cx-card" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 12 }}>Transmission Stage:</strong>
          <input type="range" min={0} max={5} step={1} value={stage} onChange={(e) => setStage(Number(e.target.value))} style={{ flex: 1, minWidth: 160 }} aria-label="Synaptic transmission stage" />
          <span className="cx-badge" style={{ color: 'var(--accent-ice-blue)' }}>{STAGES[stage]}</span>
        </div>
      )}
    </div>
  );
}
