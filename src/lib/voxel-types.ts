
import * as THREE from 'three';
import { FieldValue } from 'firebase/firestore';

// Based on LEGO brick dimensions for correct ratios.
export const PLATE_HEIGHT = 0.2; 
export const STUD_HEIGHT = PLATE_HEIGHT * (9 / 16); 
export const PLATE_TOTAL_HEIGHT = PLATE_HEIGHT;

export interface BlockDefinition {
    name: string;
    shape: 'plate' | 'brick' | 'ramp' | 'corner' | 'open-stud';
    width: number;
    depth: number;
    heightInPlates: number;
}

export interface LoadedBlock extends BlockDefinition {
    id: number;
    geometry: THREE.BufferGeometry;
}

// Data structures for Firestore
export interface Voxel {
    id: string;
    worldId: string;
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

export interface PlayerData {
    uid: string; // This will be the player's session ID
    authUid: string; // The Firebase Auth user UID
    worldId: string;
    playerName: string;
    position: { x: number; y: number; z: number; };
    rotation: { y: number; x: number; };
    color: string;
    lastSeen: FieldValue;
    inventory?: number[];
    isReady?: boolean;
}

export interface ControllerState {
    move: { x: number; y: number };
    look: { x: number; y: number };
    jump: boolean;
    actionA: boolean;
    actionB: boolean;
    lastUpdated: number | FieldValue;
}

export interface WorldData {
    id: string;
    name: string;
    createdAt: FieldValue;
    ownerId: string;
    members: { [key: string]: 'owner' | 'editor' | 'viewer' };
    gameMode: 'sandbox' | 'brick-sprint' | 'isometric-build' | 'tower-defense' | 'puzzle-path' | 'speed-builder' | 'bridge-test';
    facilitatorMode?: boolean;
    config?: {
        maxBlocks: number;
        collectingDuration: number;
        buildingDuration: number;
    };
    gameState?: {
        phase: 'waiting' | 'collecting' | 'building' | 'bridging' | 'finished';
        phaseStartTime?: FieldValue;
        challenge?: string;
        bridgeModel?: {
            name: string;
            version: string;
            voxels: Omit<Voxel, 'id' | 'worldId'>[];
        };
        bridgeHeight?: number;
        hasBridgeBeenPlaced?: boolean;
    };
    facilitatorSessionId?: string;
}

export interface ChatMessage {
    id: string;
    uid: string;
    playerName: string;
    text: string;
    timestamp: FieldValue;
    isEvent?: boolean;
}

export interface ModelTemplate {
    name: string;
    version: string;
    voxels: Omit<Voxel, 'id' | 'worldId'>[];
}
