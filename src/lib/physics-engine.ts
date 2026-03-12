import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { LoadedBlock, PLATE_TOTAL_HEIGHT } from './voxel-types';

// Minimal voxel shape for physics — doesn't require worldId
interface PhysicsVoxel {
  id: string;
  x: number;
  y: number;
  z: number;
  typeId: number;
  rotation: number;
  color: string;
  placedBy?: string;
  isHeap?: boolean;
  isBridge?: boolean;
  bridgeSegment?: number;
}

// ───────────────────────────────────────
// CLUSTERING — Groups connected blocks into rigid bodies
// ───────────────────────────────────────

interface PlacedBlock {
  voxel: PhysicsVoxel;
  block: LoadedBlock;
  width: number;
  depth: number;
}

/**
 * Compute connected clusters of blocks using BFS.
 * Two blocks are "connected" if they share a stud connection:
 *   - One sits directly on top of the other (y differs by heightInPlates)
 *   - AND their XZ footprints overlap by at least 1 cell
 */
export function computeClusters(
  voxels: PhysicsVoxel[],
  getBlock: (id: number) => LoadedBlock | undefined
): PlacedBlock[][] {
  const placed: PlacedBlock[] = [];
  for (const v of voxels) {
    const block = getBlock(v.typeId);
    if (!block) continue;
    const isRotated90 = Math.round(v.rotation) % 2 !== 0;
    placed.push({
      voxel: v,
      block,
      width: isRotated90 ? block.depth : block.width,
      depth: isRotated90 ? block.width : block.depth,
    });
  }

  const n = placed.length;
  const adj: Set<number>[] = Array.from({ length: n }, () => new Set<number>());

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (areConnected(placed[i], placed[j])) {
        adj[i].add(j);
        adj[j].add(i);
      }
    }
  }

  const visited = new Array(n).fill(false);
  const clusters: PlacedBlock[][] = [];

  for (let i = 0; i < n; i++) {
    if (visited[i]) continue;
    const cluster: PlacedBlock[] = [];
    const queue = [i];
    visited[i] = true;
    while (queue.length > 0) {
      const curr = queue.shift()!;
      cluster.push(placed[curr]);
      for (const neighbor of adj[curr]) {
        if (!visited[neighbor]) {
          visited[neighbor] = true;
          queue.push(neighbor);
        }
      }
    }
    clusters.push(cluster);
  }

  return clusters;
}

function areConnected(a: PlacedBlock, b: PlacedBlock): boolean {
  // Bridges never stick to towers or other non-bridge blocks
  if (!!a.voxel.isBridge !== !!b.voxel.isBridge) return false;
  // Bridge blocks only stick to their own segment
  if (a.voxel.isBridge && b.voxel.isBridge) {
    if (a.voxel.bridgeSegment !== b.voxel.bridgeSegment) return false;
  }

  const aTop = a.voxel.y + a.block.heightInPlates;
  const bTop = b.voxel.y + b.block.heightInPlates;

  const verticallyConnected =
    (a.voxel.y === bTop) ||
    (b.voxel.y === aTop);

  if (!verticallyConnected) return false;

  const aMinX = a.voxel.x, aMaxX = a.voxel.x + a.width;
  const aMinZ = a.voxel.z, aMaxZ = a.voxel.z + a.depth;
  const bMinX = b.voxel.x, bMaxX = b.voxel.x + b.width;
  const bMinZ = b.voxel.z, bMaxZ = b.voxel.z + b.depth;

  const overlapX = Math.max(0, Math.min(aMaxX, bMaxX) - Math.max(aMinX, bMinX));
  const overlapZ = Math.max(0, Math.min(aMaxZ, bMaxZ) - Math.max(aMinZ, bMinZ));

  return overlapX > 0 && overlapZ > 0;
}

// ───────────────────────────────────────
// CANNON.js PHYSICS WORLD
// ───────────────────────────────────────

export interface PhysicsSimulation {
  world: CANNON.World;
  bodyMeshPairs: { body: CANNON.Body; meshes: THREE.Mesh[] }[];
  groundBody: CANNON.Body;
  originalPositions: Map<string, { position: THREE.Vector3; quaternion: THREE.Quaternion }>;
  bodyInitialPositions: Map<CANNON.Body, CANNON.Vec3>;
}

/**
 * Create a cannon-es physics world from the current voxel state.
 * Ground-level voxels (y=0) are STATIC. Everything else is DYNAMIC.
 */
export function createPhysicsWorld(
  voxels: PhysicsVoxel[],
  getBlock: (id: number) => LoadedBlock | undefined,
  voxelMeshesGroup: THREE.Group
): PhysicsSimulation {
  const world = new CANNON.World({
    gravity: new CANNON.Vec3(0, -15, 0),
  });
  (world.solver as CANNON.GSSolver).iterations = 10;
  world.defaultContactMaterial.friction = 0.6;
  world.defaultContactMaterial.restitution = 0.1;

  // Ground plane
  const groundBody = new CANNON.Body({
    type: CANNON.Body.STATIC,
    shape: new CANNON.Plane(),
  });
  groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(groundBody);

  // Save original mesh positions for reset
  const originalPositions = new Map<string, { position: THREE.Vector3; quaternion: THREE.Quaternion }>();
  for (const child of voxelMeshesGroup.children) {
    const mesh = child as THREE.Mesh;
    originalPositions.set(mesh.userData.voxelId, {
      position: mesh.position.clone(),
      quaternion: mesh.quaternion.clone(),
    });
  }

  // Split ground vs non-ground voxels
  const nonGroundVoxels = voxels.filter(v => v.y > 0);
  const groundVoxels = voxels.filter(v => v.y === 0);

  // Create one big static compound body for all ground-level voxels
  if (groundVoxels.length > 0) {
    const groundStructure = new CANNON.Body({ type: CANNON.Body.STATIC });
    for (const v of groundVoxels) {
      const block = getBlock(v.typeId);
      if (!block) continue;
      const isRotated90 = Math.round(v.rotation) % 2 !== 0;
      const w = isRotated90 ? block.depth : block.width;
      const d = isRotated90 ? block.width : block.depth;
      const h = block.heightInPlates * PLATE_TOTAL_HEIGHT;

      const shape = new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2));
      const offset = new CANNON.Vec3(
        v.x + w / 2,
        v.y * PLATE_TOTAL_HEIGHT + h / 2,
        v.z + d / 2
      );
      groundStructure.addShape(shape, offset);
    }
    world.addBody(groundStructure);
  }

  // Cluster non-ground voxels into connected groups
  const clusters = computeClusters(nonGroundVoxels, getBlock);
  const bodyMeshPairs: PhysicsSimulation['bodyMeshPairs'] = [];

  for (const cluster of clusters) {
    let totalMass = 0;
    let comX = 0, comY = 0, comZ = 0;

    const shapeData: { shape: CANNON.Box; worldCenter: CANNON.Vec3; voxelId: string }[] = [];

    for (const pb of cluster) {
      const h = pb.block.heightInPlates * PLATE_TOTAL_HEIGHT;
      const mass = pb.width * pb.depth * pb.block.heightInPlates;
      const cx = pb.voxel.x + pb.width / 2;
      const cy = pb.voxel.y * PLATE_TOTAL_HEIGHT + h / 2;
      const cz = pb.voxel.z + pb.depth / 2;

      comX += cx * mass;
      comY += cy * mass;
      comZ += cz * mass;
      totalMass += mass;

      shapeData.push({
        shape: new CANNON.Box(new CANNON.Vec3(pb.width / 2, h / 2, pb.depth / 2)),
        worldCenter: new CANNON.Vec3(cx, cy, cz),
        voxelId: pb.voxel.id,
      });
    }

    comX /= totalMass;
    comY /= totalMass;
    comZ /= totalMass;

    const body = new CANNON.Body({
      mass: totalMass * 0.5,
      position: new CANNON.Vec3(comX, comY, comZ),
      linearDamping: 0.1,
      angularDamping: 0.3,
    });

    for (const sd of shapeData) {
      const localOffset = new CANNON.Vec3(
        sd.worldCenter.x - comX,
        sd.worldCenter.y - comY,
        sd.worldCenter.z - comZ
      );
      body.addShape(sd.shape, localOffset);
    }

    world.addBody(body);

    // Find matching Three.js meshes
    const meshes: THREE.Mesh[] = [];
    for (const pb of cluster) {
      const mesh = voxelMeshesGroup.children.find(
        c => (c as THREE.Mesh).userData.voxelId === pb.voxel.id
      ) as THREE.Mesh | undefined;
      if (mesh) meshes.push(mesh);
    }

    bodyMeshPairs.push({ body, meshes });
  }

  // Connect bridge segments with soft locks so it bends under gravity
  const bridgeBodiesBySegment = new Map<number, CANNON.Body>();
  for (const { body, meshes } of bodyMeshPairs) {
    const firstMesh = meshes[0];
    if (firstMesh) {
      const voxelId = firstMesh.userData.voxelId;
      const voxelData = voxels.find(v => v.id === voxelId);
      if (voxelData?.isBridge && voxelData.bridgeSegment !== undefined) {
        bridgeBodiesBySegment.set(voxelData.bridgeSegment, body);
      }
    }
  }

  const segments = Array.from(bridgeBodiesBySegment.keys()).sort((a, b) => a - b);
  for (let i = 0; i < segments.length - 1; i++) {
    const bodyA = bridgeBodiesBySegment.get(segments[i])!;
    const bodyB = bridgeBodiesBySegment.get(segments[i + 1])!;
    
    // Lock them at their current initial relative positions
    const lock = new CANNON.LockConstraint(bodyA, bodyB);
    lock.collideConnected = false;
    
    // Higher stiffness prevents shattering, but keeping it below default (1e7)
    // allows for a slight organic bend when placed on uneven towers.
    lock.equations.forEach((eq: any) => {
      eq.stiffness = 5e6; // Higher than before (was 2e5)
      eq.relaxation = 3;
    });
    
    world.addConstraint(lock);
  }

  // Store initial body positions for stepping
  const bodyInitialPositions = new Map<CANNON.Body, CANNON.Vec3>();
  for (const { body } of bodyMeshPairs) {
    bodyInitialPositions.set(body, body.position.clone());
  }

  return { world, bodyMeshPairs, groundBody, originalPositions, bodyInitialPositions };
}

/**
 * Step the physics simulation and sync Three.js meshes
 */
export function stepPhysics(sim: PhysicsSimulation, dt: number): void {
  sim.world.step(1 / 60, dt, 3);

  for (const { body, meshes } of sim.bodyMeshPairs) {
    const bodyPos = body.position;
    const bodyQuat = body.quaternion;
    const initPos = sim.bodyInitialPositions.get(body);
    if (!initPos) continue;

    for (let i = 0; i < meshes.length; i++) {
      const mesh = meshes[i];
      const voxelId = mesh.userData.voxelId;
      const origData = sim.originalPositions.get(voxelId);
      if (!origData) continue;

      // Local offset from body's initial CoM
      const localOffset = new CANNON.Vec3(
        origData.position.x - initPos.x,
        origData.position.y - initPos.y,
        origData.position.z - initPos.z
      );

      // Rotate by body's current quaternion
      const rotatedOffset = bodyQuat.vmult(localOffset);

      mesh.position.set(
        bodyPos.x + rotatedOffset.x,
        bodyPos.y + rotatedOffset.y,
        bodyPos.z + rotatedOffset.z
      );

      // Body rotation * original mesh rotation
      mesh.quaternion.set(bodyQuat.x, bodyQuat.y, bodyQuat.z, bodyQuat.w);
      mesh.quaternion.multiply(origData.quaternion);
    }
  }
}

/**
 * Reset all meshes and destroy the physics world
 */
export function resetPhysics(sim: PhysicsSimulation, voxelMeshesGroup: THREE.Group): void {
  for (const child of voxelMeshesGroup.children) {
    const mesh = child as THREE.Mesh;
    const orig = sim.originalPositions.get(mesh.userData.voxelId);
    if (orig) {
      mesh.position.copy(orig.position);
      mesh.quaternion.copy(orig.quaternion);
    }
  }

  while (sim.world.bodies.length > 0) {
    sim.world.removeBody(sim.world.bodies[0]);
  }
}
