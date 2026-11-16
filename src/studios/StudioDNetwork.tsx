import { useMemo, useState } from 'react';
import * as THREE from 'three';
import { ProvenanceBadge } from '../components/ui/ProvenanceBadge';
import { louvain } from '../kernels/analytics/graph';
import { Rng } from '../kernels/core/prng';
import { generateGraph, syntheticConnectome68 } from '../kernels/models/graphs';
import { clearHoverTarget, scheduleHoverTarget, useSelectionStore } from '../stores/selectionStore';
import { StudioViewport, type CameraPreset } from './common/StudioViewport';

export const NETWORK_PRESETS: CameraPreset[] = [
  { id: 'iso', label: '3D Orbit', position: [9, 6, 11], target: [0, 0, 0] },
  { id: 'top', label: 'Dorsal', position: [0, 14, 0.2], target: [0, 0, 0] },
  { id: 'front', label: 'Coronal', position: [0, 1, 14], target: [0, 0, 0] },
];

const COMM_COLORS = ['#38BDF8', '#A855F7', '#10B981', '#F59E0B', '#FB7185', '#22D3EE'];

interface StudioDNetworkProps {
  mode?: 'connectome68' | 'microcircuit';
  nodeActivity?: Float64Array | null;
  height?: number | string;
}

export function StudioDNetwork({ mode: initialMode = 'connectome68', nodeActivity = null, height = 430 }: StudioDNetworkProps) {
  const [mode, setMode] = useState<'connectome68' | 'microcircuit'>(initialMode);
  const [threshold, setThreshold] = useState(0.18);
  const [colorByCommunity, setColorByCommunity] = useState(true);
  const [lesionedNodes, setLesionedNodes] = useState<Set<number>>(() => new Set());
  const [selectedNodeIdx, setSelectedNodeIdx] = useState<number | null>(null);
  const [preset, setPreset] = useState<CameraPreset>(NETWORK_PRESETS[0]!);

  const selectEntity = useSelectionStore((s) => s.selectEntity);

  const graph = useMemo(() => {
    if (mode === 'connectome68') return syntheticConnectome68(42, 0.25);
    const g = generateGraph(5, 64, 42);
    const pos = new Float64Array(g.n * 3);
    const rng = new Rng(101);
    for (let i = 0; i < g.n; i++) {
      const layer = Math.floor((i * 3) / g.n); // L4, L2/3, L5
      const ang = (i / g.n) * Math.PI * 10;
      const rad = 1.6 + 1.8 * rng.next();
      pos[i * 3] = Math.cos(ang) * rad;
      pos[i * 3 + 1] = (layer - 1) * 1.9 + (rng.next() - 0.5) * 0.4;
      pos[i * 3 + 2] = Math.sin(ang) * rad;
    }
    return {
      ...g,
      positions: pos,
      labels: Array.from({ length: g.n }, (_, i) => (i < Math.round(0.8 * g.n) ? `Exc E-${i}` : `Inh PV-${i}`)),
    };
  }, [mode]);

  const communities = useMemo(() => louvain(graph.weights, graph.n, 1).communities, [graph]);

  const edges = useMemo(() => {
    const list: { key: string; from: [number, number, number]; to: [number, number, number]; w: number }[] = [];
    const n = graph.n;
    const pos = graph.positions!;
    const scale = mode === 'connectome68' ? 0.062 : 1;
    for (let i = 0; i < n; i++) {
      if (lesionedNodes.has(i)) continue;
      for (let j = i + 1; j < n; j++) {
        if (lesionedNodes.has(j)) continue;
        const w = graph.weights[i * n + j]!;
        if (w < threshold) continue;
        list.push({
          key: `${i}-${j}`,
          from: [pos[i * 3]! * scale, pos[i * 3 + 2]! * scale, pos[i * 3 + 1]! * scale],
          to: [pos[j * 3]! * scale, pos[j * 3 + 2]! * scale, pos[j * 3 + 1]! * scale],
          w,
        });
        if (list.length >= 260) return list;
      }
    }
    return list;
  }, [graph, mode, threshold, lesionedNodes]);

  const linePositions = useMemo(() => {
    const arr = new Float32Array(edges.length * 6);
    edges.forEach((e, k) => {
      arr[k * 6] = e.from[0]; arr[k * 6 + 1] = e.from[1]; arr[k * 6 + 2] = e.from[2];
      arr[k * 6 + 3] = e.to[0]; arr[k * 6 + 4] = e.to[1]; arr[k * 6 + 5] = e.to[2];
    });
    return arr;
  }, [edges]);

  const scale = mode === 'connectome68' ? 0.062 : 1;
  const targetEntityId = mode === 'connectome68' ? 'MODEL-028' : 'CIRC-003';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <StudioViewport
        title="Studio D — Neural Network & Connectome"
        studioTag={mode === 'connectome68' ? 'STUDIO D · L8 CONNECTOME' : 'STUDIO D · L5 MICROCIRCUIT'}
        presets={NETWORK_PRESETS}
        activePreset={preset}
        onSelectPreset={setPreset}
        disclosure={
          mode === 'connectome68'
            ? 'SYNTHETIC_TOPOLOGY: 68 Desikan–Killiany labeled nodes placed at schematic coordinates with exponential distance-rule weights (not measured DTI tractography).'
            : 'SYNTHETIC_SIMULATION: 64-node cortical E/I microcircuit motif (80% excitatory pyramids, 20% inhibitory PV spheres).'
        }
        height={height}
        fallback2D={
          <div className="cx-card">
            <strong>Network Nodes ({graph.n}) — Provenance: {graph.provenance}</strong>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
              {(graph.labels ?? []).slice(0, 32).map((lbl, idx) => (
                <button key={lbl} type="button" className="cx-entity-chip" onClick={() => { setSelectedNodeIdx(idx); selectEntity(targetEntityId); }}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>
        }
      >
        {/* Translucent brain hull in connectome mode */}
        {mode === 'connectome68' && (
          <mesh scale={[4.4, 3.4, 5.2]} position={[0, 0.4, -0.4]}>
            <sphereGeometry args={[1, 24, 18]} />
            <meshPhysicalMaterial color="#1e3a5f" transparent opacity={0.12} depthWrite={false} roughness={0.5} />
          </mesh>
        )}

        {/* Network Edges */}
        {edges.length > 0 && (
          <lineSegments>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" args={[linePositions, 3]} />
            </bufferGeometry>
            <lineBasicMaterial color="#38BDF8" transparent opacity={0.32} />
          </lineSegments>
        )}

        {/* Nodes */}
        {Array.from({ length: graph.n }, (_, i) => {
          const p = graph.positions!;
          const x = p[i * 3]! * scale;
          const y = p[i * 3 + 2]! * scale;
          const z = p[i * 3 + 1]! * scale;
          const isLesioned = lesionedNodes.has(i);
          const isInh = mode === 'microcircuit' && i >= Math.round(0.8 * graph.n);
          const isSel = selectedNodeIdx === i;
          const act = nodeActivity && i < nodeActivity.length ? nodeActivity[i]! : null;
          const color = isLesioned
            ? '#334155'
            : act !== null
              ? new THREE.Color().setHSL(0.58 - 0.45 * Math.max(0, Math.min(1, 0.5 + 0.5 * act)), 0.9, 0.55).getStyle()
              : colorByCommunity
                ? COMM_COLORS[(communities[i] ?? 0) % COMM_COLORS.length]!
                : isInh ? '#A855F7' : '#38BDF8';

          return (
            <mesh
              key={i}
              position={[x, y, z]}
              onPointerOver={(e) => {
                e.stopPropagation();
                scheduleHoverTarget({
                  entityId: targetEntityId,
                  x: e.nativeEvent.clientX,
                  y: e.nativeEvent.clientY,
                  labelOverride: graph.labels?.[i] ?? `Node ${i + 1}`,
                  definitionOverride: `${mode === 'connectome68' ? 'Synthetic Desikan–Killiany cortical node' : isInh ? 'Inhibitory microcircuit node' : 'Excitatory microcircuit node'} (Community ${(communities[i] ?? 0) + 1}${isLesioned ? ', LESIONED' : ''}).`,
                });
              }}
              onPointerOut={clearHoverTarget}
              onClick={(e) => {
                e.stopPropagation();
                clearHoverTarget();
                setSelectedNodeIdx(i);
                selectEntity(targetEntityId, { scale: mode === 'connectome68' ? 'L8' : 'L5' });
              }}
            >
              {mode === 'microcircuit' && !isInh ? <coneGeometry args={[0.17, 0.34, 6]} /> : <sphereGeometry args={[isSel ? 0.24 : 0.16, 12, 10]} />}
              <meshStandardMaterial
                color={color}
                emissive={isSel ? '#F59E0B' : '#000000'}
                emissiveIntensity={isSel ? 0.8 : 0}
                transparent={isLesioned}
                opacity={isLesioned ? 0.25 : 0.95}
              />
            </mesh>
          );
        })}
      </StudioViewport>

      {/* Controls & Provenance Bar */}
      <div className="cx-card" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <ProvenanceBadge status={graph.provenance} />
          <button type="button" className={`cx-btn${mode === 'connectome68' ? ' cx-btn-primary' : ''}`} onClick={() => { setMode('connectome68'); setLesionedNodes(new Set()); }}>
            68-Region Connectome (L8)
          </button>
          <button type="button" className={`cx-btn${mode === 'microcircuit' ? ' cx-btn-primary' : ''}`} onClick={() => { setMode('microcircuit'); setLesionedNodes(new Set()); }}>
            E/I Microcircuit (L5)
          </button>
          <button type="button" className={`cx-btn${colorByCommunity ? ' cx-btn-primary' : ''}`} onClick={() => setColorByCommunity((c) => !c)}>
            Community Coloring
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            Edge Threshold:
            <input type="range" min={0} max={0.9} step={0.05} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} />
            <span className="tabular">{threshold.toFixed(2)}</span>
          </label>
          {selectedNodeIdx !== null && (
            <button
              type="button"
              className="cx-btn cx-btn-danger"
              onClick={() =>
                setLesionedNodes((prev) => {
                  const next = new Set(prev);
                  if (next.has(selectedNodeIdx)) next.delete(selectedNodeIdx);
                  else next.add(selectedNodeIdx);
                  return next;
                })
              }
            >
              {lesionedNodes.has(selectedNodeIdx) ? `Restore ${graph.labels?.[selectedNodeIdx] ?? selectedNodeIdx}` : `Lesion ${graph.labels?.[selectedNodeIdx] ?? selectedNodeIdx}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
