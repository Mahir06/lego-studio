
import { collection, addDoc, serverTimestamp, writeBatch, doc, Firestore } from 'firebase/firestore';
import { Auth } from 'firebase/auth';
import { WORLD_WIDTH, WORLD_DEPTH } from '@/lib/world-constants';

export type GameMode = 'sandbox' | 'brick-sprint' | 'isometric-build' | 'tower-defense' | 'puzzle-path' | 'speed-builder' | 'bridge-test';

interface WorldConfig {
    maxBlocks: number;
    collectingDuration: number;
    buildingDuration: number;
}

export async function createWorld(
    db: Firestore, 
    auth: Auth, 
    gameMode: GameMode = 'sandbox', 
    facilitatorMode: boolean = false,
    config?: WorldConfig,
    facilitatorSessionId?: string
): Promise<string> {
    if (!auth.currentUser) {
        throw new Error("User must be authenticated to create a world.");
    }
    const uid = auth.currentUser.uid;

    const worldRef = await addDoc(collection(db, 'worlds'), {
        name: gameMode === 'bridge-test' ? 'Bridge Integrity Test' : (gameMode === 'isometric-build' ? 'Isometric Creation' : (gameMode === 'brick-sprint' ? 'Brick Sprint Challenge' : 'New World')),
        createdAt: serverTimestamp(),
        ownerId: uid,
        facilitatorSessionId: facilitatorSessionId || null,
        members: {
            [uid]: 'owner'
        },
        gameMode: gameMode,
        facilitatorMode: facilitatorMode,
        config: config || {
            maxBlocks: 25,
            collectingDuration: 60,
            buildingDuration: 180
        },
        gameState: {
            phase: gameMode === 'bridge-test' ? 'bridging' : 'waiting',
            challenge: gameMode === 'bridge-test' ? 'Test your bridge integrity!' : (gameMode === 'brick-sprint' ? 'Build the TALLEST steady tower you can!' : '')
        }
    });

    const batch = writeBatch(db);
    const groundBlockId = 1; // 1x1 Plate

    // Create floor
    for (let x = 0; x < WORLD_WIDTH; x++) {
        for (let z = 0; z < WORLD_DEPTH; z++) {
            const voxelData = {
                x,
                y: 0,
                z,
                typeId: groundBlockId,
                rotation: 0,
                color: '#237841',
            };
            const voxelRef = doc(collection(db, 'worlds', worldRef.id, 'voxels'));
            batch.set(voxelRef, voxelData);
        }
    }

    // Pre-build towers for Bridge Test
    if (gameMode === 'bridge-test') {
        const towerColor = '#555555';
        const towerTypeId = 12; // 2x2 Brick (3 plates high)
        // Tower A
        for (let y = 1; y < 15; y += 3) {
            const voxelRef = doc(collection(db, 'worlds', worldRef.id, 'voxels'));
            batch.set(voxelRef, { x: 1, y, z: 2, typeId: towerTypeId, rotation: 0, color: towerColor });
        }
        // Tower B
        for (let y = 1; y < 15; y += 3) {
            const voxelRef = doc(collection(db, 'worlds', worldRef.id, 'voxels'));
            batch.set(voxelRef, { x: 1, y, z: 38, typeId: towerTypeId, rotation: 0, color: towerColor });
        }
    }

    // For Brick Sprint, scatter some blocks on the floor as the "heap"
    if (gameMode === 'brick-sprint') {
        const heapColors = ['#C91A09', '#0055BF', '#F2CD37', '#FFFFFF', '#FE8A18'];
        const possibleBlockIds = [1, 2, 8, 9, 12]; // Assumed common block IDs
        
        for (let i = 0; i < 60; i++) {
            const x = Math.floor(Math.random() * (WORLD_WIDTH - 2)) + 1;
            const z = Math.floor(Math.random() * (WORLD_DEPTH - 2)) + 1;
            const typeId = possibleBlockIds[Math.floor(Math.random() * possibleBlockIds.length)];
            const color = heapColors[Math.floor(Math.random() * heapColors.length)];
            
            const voxelData = {
                x,
                y: 1, // Above ground
                z,
                typeId,
                rotation: Math.floor(Math.random() * 4),
                color,
                isHeap: true
            };
            const voxelRef = doc(collection(db, 'worlds', worldRef.id, 'voxels'));
            batch.set(voxelRef, voxelData);
        }
    }

    await batch.commit();

    return worldRef.id;
}
