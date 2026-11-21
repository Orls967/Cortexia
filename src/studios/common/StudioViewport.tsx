import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ErrorBoundary } from '../../components/ui/ErrorBoundary';
import { ProvenanceBadge } from '../../components/ui/ProvenanceBadge';
import { ensureBvh } from './bvh';

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
  const [showDisclosure, setShowDisclosure] = useState(false);
  const disclosureId = useId();
  // In flat mode (2D schematic or lost context) the header is part of the flow so it cannot cover the fallback content.
  const flat = contextLost || mode2D;

  return (
    <ErrorBoundary title={`${title} 3D Viewport`}>
      <div className="cx-studio">
        {/* Header in normal flow: it never covers the scene or the 2D schematic. */}
        <div className="cx-studio-bar">
          <div className="cx-studio-id">
            <span className="cx-badge tabular">{studioTag}</span>
            <ProvenanceBadge status="PROCEDURAL_3D" />
            <button type="button" className="cx-btn cx-studio-info" aria-expanded={showDisclosure} aria-controls={disclosureId} onClick={() => setShowDisclosure((v) => !v)}>
              {showDisclosure ? 'Hide geometry note' : 'About this geometry'}
            </button>
          </div>
          <div className="cx-studio-presets" role="group" aria-label={`${title} camera views`}>
            {presets.map((p) => (
              <button key={p.id} type="button" aria-pressed={!flat && activePreset.id === p.id} className={`cx-btn${!flat && activePreset.id === p.id ? ' cx-btn-primary' : ''}`} onClick={() => { setMode2D(false); onSelectPreset(p); }}>
                {p.label}
              </button>
            ))}
            {fallback2D && (
              <button type="button" className={`cx-btn${mode2D ? ' cx-btn-primary' : ''}`} onClick={() => setMode2D((m) => !m)}>
                {mode2D ? '3D View' : '2D Schematic'}
              </button>
            )}
          </div>
        </div>
        <p id={disclosureId} className="cx-studio-disclosure" hidden={!showDisclosure}>{disclosure}</p>

        <div
          ref={containerRef}
          tabIndex={0}
          role="region"
          aria-label={`${title} 3D Interactive Viewport`}
          className="cx-studio-stage"
          onKeyDown={(e) => {
            const step = (5 * Math.PI) / 180;
            if (e.key === 'ArrowLeft') { e.preventDefault(); setOrbitDelta((d) => ({ dAzimuth: -step, dPolar: 0, dZoom: 0, seq: d.seq + 1 })); }
            else if (e.key === 'ArrowRight') { e.preventDefault(); setOrbitDelta((d) => ({ dAzimuth: step, dPolar: 0, dZoom: 0, seq: d.seq + 1 })); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setOrbitDelta((d) => ({ dAzimuth: 0, dPolar: -step, dZoom: 0, seq: d.seq + 1 })); }
            else if (e.key === 'ArrowDown') { e.preventDefault(); setOrbitDelta((d) => ({ dAzimuth: 0, dPolar: step, dZoom: 0, seq: d.seq + 1 })); }
            else if (e.key === '+' || e.key === '=') { e.preventDefault(); setOrbitDelta((d) => ({ dAzimuth: 0, dPolar: 0, dZoom: -0.12, seq: d.seq + 1 })); }
            else if (e.key === '-') { e.preventDefault(); setOrbitDelta((d) => ({ dAzimuth: 0, dPolar: 0, dZoom: 0.12, seq: d.seq + 1 })); }
          }}
          style={{ height: flat ? 'auto' : height, maxHeight: flat ? height : undefined, overflowY: flat ? 'auto' : 'hidden' }}
        >
          {flat ? (
            <div style={{ padding: 10 }}>
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
              gl={{ antialias: true, powerPreference: 'high-performance', stencil: true, localClippingEnabled: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
              camera={{ position: activePreset.position, fov: 40, near: 0.1, far: 200 }}
              onCreated={({ gl }) => {
                gl.localClippingEnabled = true;
                const el = gl.domElement;
                // React Three Fiber releases the context when the canvas unmounts (switching to the 2D schematic or leaving
                // the page). That is intentional, so only a loss on a canvas still in the document is reported.
                el.addEventListener('webglcontextlost', (ev) => {
                  if (!el.isConnected) return;
                  ev.preventDefault();
                  setContextLost(true);
                });
                el.addEventListener('webglcontextrestored', () => { if (el.isConnected) setContextLost(false); });
              }}
            >
              <color attach="background" args={['#080d17']} />
              <ambientLight intensity={0.65} />
              <directionalLight position={[12, 16, -10]} intensity={1.45} color="#f8fafc" />
              <directionalLight position={[-12, 6, 12]} intensity={0.7} color="#7dd3fc" />
              <directionalLight position={[0, -10, -12]} intensity={0.45} color="#a855f7" />
              <hemisphereLight args={['#bae6fd', '#0f172a', 0.55]} />
              <OrbitRig preset={activePreset} orbitDelta={orbitDelta} />
              {children}
            </Canvas>
          )}
          {!flat && <div className="cx-studio-hint">Drag to orbit · scroll to zoom · arrow keys and +/− move the camera · hover or click a structure to explain it</div>}
        </div>
      </div>
    </ErrorBoundary>
  );
}
