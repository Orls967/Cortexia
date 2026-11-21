import * as THREE from 'three';
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';

let bvhInstalled = false;

/** Installs three-mesh-bvh prototypes once so acceleratedRaycast is active across all 3D studios. */
export function ensureBvh(): void {
  if (bvhInstalled) return;
  bvhInstalled = true;
  (THREE.BufferGeometry.prototype as unknown as { computeBoundsTree: unknown }).computeBoundsTree = computeBoundsTree;
  (THREE.BufferGeometry.prototype as unknown as { disposeBoundsTree: unknown }).disposeBoundsTree = disposeBoundsTree;
  THREE.Mesh.prototype.raycast = acceleratedRaycast;
}

/** Builds a BVH boundsTree on the geometry if not already present, enabling <1.5 ms raycast queries. */
export function withBoundsTree<T extends THREE.BufferGeometry>(geom: T): T {
  ensureBvh();
  const g = geom as T & { computeBoundsTree?: () => void; boundsTree?: unknown };
  if (g.computeBoundsTree && !g.boundsTree && g.index !== null || (g.attributes.position && g.attributes.position.count > 0 && !g.boundsTree)) {
    g.computeBoundsTree?.();
  }
  return geom;
}
