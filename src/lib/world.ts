
import * as THREE from 'three';
import { PLATE_HEIGHT, STUD_HEIGHT } from './voxel-types';
import type { LoadedBlock, BlockDefinition } from './voxel-types';
import blockDefinitions from './custom-blocks.json';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const STUD_RADIUS = 0.3;
const STUD_SEGMENTS = 12;

function createStuds(width: number, depth: number): THREE.BufferGeometry[] {
    const studs: THREE.BufferGeometry[] = [];
    const studGeometry = new THREE.CylinderGeometry(STUD_RADIUS, STUD_RADIUS, STUD_HEIGHT, STUD_SEGMENTS);

    for (let i = 0; i < width; i++) {
        for (let j = 0; j < depth; j++) {
            const stud = studGeometry.clone();
            // Center the stud on the 1x1 grid cell
            stud.translate(-(width/2) + i + 0.5, 0, -(depth/2) + j + 0.5);
            studs.push(stud);
        }
    }
    studGeometry.dispose();
    return studs;
}

function createBaseGeometry(width: number, depth: number, height: number): THREE.BoxGeometry {
    return new THREE.BoxGeometry(width, height, depth);
}

function createRampGeometry(width: number, depth: number, height: number): THREE.BufferGeometry {
    const shape = new THREE.Shape();
    // Define the triangular profile of the ramp
    shape.moveTo(0, 0); // bottom front
    shape.lineTo(depth, 0); // bottom back
    shape.lineTo(depth, height); // top back
    shape.lineTo(0, 0); // close shape

    const extrudeSettings = { steps: 1, depth: width, bevelEnabled: false };
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

    // Re-center the geometry
    geometry.translate(-width/2, -height/2, -depth/2);
    
    // Rotate it to be a ramp instead of a weird wedge
    geometry.rotateY(-Math.PI / 2);
    geometry.rotateX(-Math.PI / 2);


    return geometry;
}


function createCornerGeometry(width: number, depth: number, height: number): THREE.BufferGeometry {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    return geometry;
}

function createOpenStudGeometry(width: number, depth: number, height: number): THREE.BufferGeometry {
    const outerRadius = 0.4;
    const innerRadius = 0.3;
    const shape = new THREE.Shape();
    shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);
    const holePath = new THREE.Path();
    holePath.absarc(0, 0, innerRadius, 0, Math.PI * 2, true);
    shape.holes.push(holePath);

    const extrudeSettings = {
        steps: 1,
        depth: height,
        bevelEnabled: false,
    };

    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.rotateX(Math.PI / 2);
    geometry.translate(0, -height/2, 0);
    return geometry;
}


export function generateBlockGeometry(blockDef: BlockDefinition): THREE.BufferGeometry {
    const bodyHeight = blockDef.heightInPlates * PLATE_HEIGHT;
    let finalGeometry: THREE.BufferGeometry;

    let baseGeom: THREE.BufferGeometry;
    let hasStuds = true;

    switch (blockDef.shape) {
        case 'ramp':
            baseGeom = createRampGeometry(blockDef.width, blockDef.depth, bodyHeight);
            hasStuds = false;
            break;
        case 'corner':
            baseGeom = createCornerGeometry(blockDef.width, blockDef.depth, bodyHeight);
            hasStuds = false; // For now
            break;
        case 'open-stud':
            baseGeom = createOpenStudGeometry(blockDef.width, blockDef.depth, bodyHeight);
            hasStuds = false;
            break;
        default: // 'plate' and 'brick'
            baseGeom = createBaseGeometry(blockDef.width, blockDef.depth, bodyHeight);
            break;
    }
    
    const geometriesToMerge: THREE.BufferGeometry[] = [baseGeom];

    if (hasStuds) {
        const studGeometries = createStuds(blockDef.width, blockDef.depth);
        studGeometries.forEach(stud => stud.translate(0, bodyHeight / 2, 0));
        geometriesToMerge.push(...studGeometries);
    }
    
    if (geometriesToMerge.length > 1) {
        finalGeometry = mergeGeometries(geometriesToMerge);
        geometriesToMerge.forEach(g => g.dispose());
    } else {
        finalGeometry = baseGeom;
    }

    return finalGeometry;
}


export function generateAllBlockGeometries(): LoadedBlock[] {
    const blockDefs = blockDefinitions.blocks as BlockDefinition[];
    const allLoaded: LoadedBlock[] = [];
    let blockIdCounter = 1;

    for (const blockDef of blockDefs) {
        const geometry = generateBlockGeometry(blockDef);
        allLoaded.push({
            id: blockIdCounter++,
            ...blockDef,
            geometry: geometry,
        });
    }
    return allLoaded;
}
