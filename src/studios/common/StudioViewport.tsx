import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';
import { ErrorBoundary } from '../../components/ui/ErrorBoundary';
import { ProvenanceBadge } from '../../components/ui/ProvenanceBadge';

// Install three-mesh-bvh once for <1.5 ms raycast hover detection across all 3D studios.
let bvhInstalled = false;
function ensureBvh() {
  if (bvhInstalled) return;
  bvhInstalled = true;
  (THREE.BufferGeometry.prototype as unknown as { computeBoundsTree: unknown }).computeBoundsTree = computeBoundsTree;
  (THREE.BufferGeometry.prototype as unknown as { disposeBoundsTree: unknown }).disposeBoundsTree = disposeBoundsTree;
  THREE.Mesh.prototype.raycast = acceleratedRaycast;
}

export interface CameraPreset {
  id: string;
  label: string;
  position: [number, number, number];
  target: [number, number, number];
}

function OrbitRig({
  preset,
  orbitDelta,
}: {
  preset: CameraPreset;
  orbitDelta: { dAzimuth: number; dPolar: number; dZoom: number; seq: number };
}) {
  const { camera, gl } = useThree();
  const controlsRef = useRef<OrbitControls | null>(null);
  const desiredPos = useRef(new THREE.Vector3(...preset.position));
  const desiredTarget = useRef(new THREE.Vector3(...preset.target));
  const flying = useRef(false);

  const reducedMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  useEffect(() => {
    const ctrl = new OrbitControls(camera, gl.domElement);
    ctrl.enableDamping = true;
    ctrl.dampingFactor = 0.08;
    ctrl.minDistance = 1.2;
    ctrl.maxDistance = 45;
    ctrl.target.set(...preset.target);
    camera.position.set(...preset.position);
    ctrl.update();
    controlsRef.current = ctrl;
    return () => {
      ctrl.dispose();
      controlsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, gl]);

  useEffect(() => {
    desiredPos.current.set(...preset.position);
    desiredTarget.current.set(...preset.target);
    if (reducedMotion && controlsRef.current) {
      camera.position.copy(desiredPos.current);
      controlsRef.current.target.copy(desiredTarget.current);
      controlsRef.current.update();
      flying.current = false;
    } else {
      flying.current = true;
    }
  }, [preset, camera, reducedMotion]);

  useEffect(() => {
    const ctrl = controlsRef.current;
    if (!ctrl || orbitDelta.seq === 0) return;
    flying.current = false;
    const offset = camera.position.clone().sub(ctrl.target);
    const sph = new THREE.Spherical().setFromVector3(offset);
    sph.theta += orbitDelta.dAzimuth;
    sph.phi = Math.max(0.1, Math.min(Math.PI - 0.1, sph.phi + orbitDelta.dPolar));
    sph.radius = Math.max(1.5, Math.min(40, sph.radius * (1 + orbitDelta.dZoom)));
    offset.setFromSpherical(sph);
    camera.position.copy(ctrl.target).add(offset);
    ctrl.update();
  }, [orbitDelta, camera]);

  useFrame(() => {
    const ctrl = controlsRef.current;
    if (!ctrl) return;
    if (flying.current) {
      camera.position.lerp(desiredPos.current, 0.14);
      ctrl.target.lerp(desiredTarget.current, 0.14);
      if (camera.position.distanceTo(desiredPos.current) < 0.03) flying.current = false;
    }
    ctrl.update();
  });

  return null;
}

interface StudioViewportProps {
  title: string;
  studioTag: string;
  presets: CameraPreset[];
  activePreset: CameraPreset;
  onSelectPreset: (p: CameraPreset) => void;
  disclosure: string;
  height?: number | string;
  children: ReactNode;
  fallback2D?: ReactNode;
}

export function StudioViewport({
  title,
  studioTag,
  presets,
  activePreset,
  onSelectPreset,
  disclosure,
  height = 460,
  children,
  fallback2D,
}: StudioViewportProps) {
  ensureBvh();
  const [contextLost, setContextLost] = useState(false);
  const [mode2D, setMode2D] = useState(false);
  const [orbitDelta, setOrbitDelta] = useState({ dAzimuth: 0, dPolar: 0, dZoom: 0, seq: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);

  return (
    <ErrorBoundary title={`${title} 3D Viewport`}>
      <div
        ref={containerRef}
        tabIndex={0}
        role="region"
        aria-label={`${title} 3D Interactive Viewport`}
        onKeyDown={(e) => {
          const step = (5 * Math.PI) / 180;
          if (e.key === 'ArrowLeft') { e.preventDefault(); setOrbitDelta((d) => ({ dAzimuth: -step, dPolar: 0, dZoom: 0, seq: d.seq + 1 })); }
          else if (e.key === 'ArrowRight') { e.preventDefault(); setOrbitDelta((d) => ({ dAzimuth: step, dPolar: 0, dZoom: 0, seq: d.seq + 1 })); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setOrbitDelta((d) => ({ dAzimuth: 0, dPolar: -step, dZoom: 0, seq: d.seq + 1 })); }
          else if (e.key === 'ArrowDown') { e.preventDefault(); setOrbitDelta((d) => ({ dAzimuth: 0, dPolar: step, dZoom: 0, seq: d.seq + 1 })); }
          else if (e.key === '+' || e.key === '=') { e.preventDefault(); setOrbitDelta((d) => ({ dAzimuth: 0, dPolar: 0, dZoom: -0.12, seq: d.seq + 1 })); }
          else if (e.key === '-') { e.preventDefault(); setOrbitDelta((d) => ({ dAzimuth: 0, dPolar: 0, dZoom: 0.12, seq: d.seq + 1 })); }
        }}
        style={{
          position: 'relative',
          width: '100%',
          height,
          background: 'radial-gradient(circle at 50% 35%, #111b31 0%, #070b13 100%)',
          borderRadius: 10,
          border: '1px solid var(--border-subtle)',
          overflow: 'hidden',
        }}
      >
        {/* Top Overlay: Provenance Badge & Camera Presets */}
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            right: 10,
            zIndex: 10,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 8,
            pointerEvents: 'none',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, pointerEvents: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span className="cx-badge tabular" style={{ background: 'rgba(10,14,23,0.86)' }}>{studioTag}</span>
              <ProvenanceBadge status="PROCEDURAL_3D" />
            </div>
            <div
              style={{
                maxWidth: 360,
                fontSize: 10,
                color: '#cbd5e1',
                background: 'rgba(10, 14, 23, 0.78)',
                padding: '3px 8px',
                borderRadius: 4,
                border: '1px solid rgba(51, 65, 85, 0.7)',
              }}
            >
              {disclosure}
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'flex-end', pointerEvents: 'auto' }}>
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`cx-btn${activePreset.id === p.id ? ' cx-btn-primary' : ''}`}
                style={{ padding: '3px 7px', fontSize: 11 }}
                onClick={() => onSelectPreset(p)}
              >
                {p.label}
              </button>
            ))}
            {fallback2D && (
              <button
                type="button"
                className={`cx-btn${mode2D ? ' cx-btn-primary' : ''}`}
                style={{ padding: '3px 7px', fontSize: 11 }}
                onClick={() => setMode2D((m) => !m)}
              >
                {mode2D ? '3D View' : '2D Schematic'}
              </button>
            )}
          </div>
        </div>

        {(contextLost || mode2D) ? (
          <div style={{ width: '100%', height: '100%', padding: 16, paddingTop: 72, overflowY: 'auto' }}>
            {contextLost && (
              <div className="cx-banner cx-banner-amber" style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>3D Graphics Context Interrupted — showing accessible 2D schematic mode.</span>
                <button type="button" className="cx-btn" onClick={() => setContextLost(false)}>Restore 3D</button>
              </div>
            )}
            {fallback2D ?? <div className="cx-banner">2D fallback view active.</div>}
          </div>
        ) : (
          <Canvas
            dpr={[1, 2]}
            gl={{ antialias: true, powerPreference: 'high-performance', stencil: true, localClippingEnabled: true }}
            camera={{ position: activePreset.position, fov: 44, near: 0.1, far: 200 }}
            onCreated={({ gl }) => {
              gl.localClippingEnabled = true;
              const el = gl.domElement;
              el.addEventListener('webglcontextlost', (ev) => { ev.preventDefault(); setContextLost(true); });
              el.addEventListener('webglcontextrestored', () => setContextLost(false));
            }}
          >
            <color attach="background" args={['#080d17']} />
            <ambientLight intensity={0.62} />
            <directionalLight position={[12, 16, 10]} intensity={1.15} color="#f8fafc" />
            <directionalLight position={[-10, -8, -10]} intensity={0.45} color="#38bdf8" />
            <hemisphereLight args={['#38bdf8', '#0f172a', 0.35]} />
            <OrbitRig preset={activePreset} orbitDelta={orbitDelta} />
            {children}
          </Canvas>
        )}

        <div
          style={{
            position: 'absolute',
            bottom: 8,
            left: 10,
            zIndex: 10,
            fontSize: 10,
            color: 'var(--text-muted)',
            background: 'rgba(10,14,23,0.75)',
            padding: '2px 7px',
            borderRadius: 4,
            pointerEvents: 'none',
          }}
        >
          Drag: Orbit · Scroll: Zoom · Arrow/+/- keys: Keyboard camera · Hover/Click: UCES Inspector
        </div>
      </div>
    </ErrorBoundary>
  );
}
