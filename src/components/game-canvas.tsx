'use client';

import * as THREE from 'three';
import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { PLATE_TOTAL_HEIGHT, LoadedBlock, Voxel, PlayerData, ChatMessage, ModelTemplate, ControllerState, WorldData } from '@/lib/voxel-types';
import { WORLD_HEIGHT, WORLD_WIDTH, WORLD_DEPTH } from '@/lib/world-constants';
import { Hud } from '@/components/ui/hud';
import { Loader } from '@/components/ui/loader';
import { InventoryModal } from '@/components/ui/inventory-modal';
import { ColorPickerModal } from '@/components/ui/color-picker-modal';
import { ControllerModal } from '@/components/ui/controller-modal';
import { EventLog } from '@/components/ui/event-log';
import { generateAllBlockGeometries } from '@/lib/world';
import { throttle } from 'lodash';
import { useFirebase, useMemoFirebase } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useDoc } from '@/firebase/firestore/use-doc';
import { addDocumentNonBlocking, deleteDocumentNonBlocking, setDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { collection, doc, serverTimestamp, query, orderBy, writeBatch, getDocs } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { LogOut, Volume2, VolumeX, Play, Timer, Trophy, Info, Sparkles, Hammer, Eye, ShieldAlert, Users, CheckCircle2, Circle, RotateCcw, FastForward } from 'lucide-react';
import { NameTag } from '@/components/ui/name-tag';
import { sendChatMessage } from '@/services/chat-service';
import { exportModelLocally, importModelLocally } from '@/services/template-service';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { createPhysicsWorld, stepPhysics, resetPhysics, PhysicsSimulation } from '@/lib/physics-engine';
import defaultBridgeData from '@/lib/default-bridge.json';

const Instructions = ({ worldId, isIsometric, isFacilitator }: { worldId: string, isIsometric: boolean, isFacilitator: boolean }) => (
  <div
    className="absolute top-4 left-4 bg-black/60 text-white p-4 rounded-2xl text-sm pointer-events-none z-10 backdrop-blur-md border border-white/10 space-y-3 max-w-[260px]"
  >
    <div>
      <p className="text-[10px] font-extrabold uppercase tracking-widest text-white/50 mb-1">🌍 World ID</p>
      <p className="font-mono bg-white/10 px-2.5 py-1.5 rounded-xl text-sm font-bold tracking-wide">{worldId}</p>
      {isFacilitator && <p className="text-[10px] mt-1.5 text-primary font-extrabold uppercase tracking-widest">👑 Facilitator Mode</p>}
      {!isFacilitator && <p className="text-[10px] mt-1.5 text-white/60 font-semibold">Share with friends to join!</p>}
    </div>
    <div className="border-t border-white/10 pt-3">
      <p className="text-[10px] font-extrabold uppercase tracking-widest text-white/50 mb-2">🎮 Controls</p>
      <div className="space-y-1 text-[11px]">
        {!isIsometric && <p><kbd className="bg-white/15 px-1.5 py-0.5 rounded-md font-bold text-[10px]">Click</kbd> Lock Controls</p>}
        <p><kbd className="bg-white/15 px-1.5 py-0.5 rounded-md font-bold text-[10px]">WASD</kbd> {isIsometric ? 'Pan View' : 'Move'}</p>
        {!isFacilitator ? (
          <>
            <p><kbd className="bg-white/15 px-1.5 py-0.5 rounded-md font-bold text-[10px]">LMB</kbd> Break / Select A</p>
            <p><kbd className="bg-white/15 px-1.5 py-0.5 rounded-md font-bold text-[10px]">RMB</kbd> Place / Select B</p>
            <p><kbd className="bg-white/15 px-1.5 py-0.5 rounded-md font-bold text-[10px]">↑↓←→</kbd> Nudge Block</p>
            <p><kbd className="bg-white/15 px-1.5 py-0.5 rounded-md font-bold text-[10px]">R</kbd> Rotate</p>
            <p><kbd className="bg-white/15 px-1.5 py-0.5 rounded-md font-bold text-[10px]">I</kbd> Inventory &nbsp; <kbd className="bg-white/15 px-1.5 py-0.5 rounded-md font-bold text-[10px]">C</kbd> Colors</p>
          </>
        ) : (
          <p className="text-primary/80 italic font-semibold">Spectating only. WASD to fly.</p>
        )}
        <p><kbd className="bg-white/15 px-1.5 py-0.5 rounded-md font-bold text-[10px]">T</kbd> Chat</p>
      </div>
    </div>
  </div>
);

const createPlayerMesh = (playerData: PlayerData): THREE.Group => {
  const playerGroup = new THREE.Group();
  playerGroup.name = 'model';

  const yellowMaterial = new THREE.MeshStandardMaterial({ color: '#F2CD37', metalness: 0.1, roughness: 0.7 });
  const redMaterial = new THREE.MeshStandardMaterial({ color: '#C91A09', metalness: 0.1, roughness: 0.7 });
  const blueMaterial = new THREE.MeshStandardMaterial({ color: '#0055BF', metalness: 0.1, roughness: 0.7 });

  const hipGeom = new THREE.BoxGeometry(1.2, 0.25, 0.5);
  const hips = new THREE.Mesh(hipGeom, blueMaterial);
  hips.position.y = 0.7 + 0.25 / 2;

  const torsoGeom = new THREE.BoxGeometry(1.2, 0.8, 0.5);
  const torso = new THREE.Mesh(torsoGeom, redMaterial);
  const hipTopY = hips.position.y + 0.25 / 2;
  torso.position.y = hipTopY + 0.8 / 2;

  const headGroup = new THREE.Group();
  headGroup.name = 'headGroup';

  const headHeight = 0.45;
  const headRadius = 0.4;
  const headGeometry = new THREE.CylinderGeometry(headRadius, headRadius, headHeight, 32);

  const canvas = document.createElement('canvas');
  const textureAspectRatio = (2 * Math.PI * headRadius) / headHeight;
  canvas.height = 128;
  canvas.width = Math.round(canvas.height * textureAspectRatio);
  const context = canvas.getContext('2d');
  if (context) {
    context.fillStyle = '#F2CD37';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = 'black';
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    context.beginPath();
    context.arc(cx - 20, cy - 5, 8, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(cx + 20, cy - 5, 8, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(cx, cy + 10, 25, 0.2 * Math.PI, 0.8 * Math.PI);
    context.lineWidth = 5;
    context.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.offset.x = 0.5;

  const faceMaterial = new THREE.MeshStandardMaterial({ map: texture, metalness: 0.1, roughness: 0.7 });
  const head = new THREE.Mesh(headGeometry, faceMaterial);
  headGroup.add(head);

  const headStudGeom = new THREE.CylinderGeometry(headRadius * 0.5, headRadius * 0.5, 0.1, 32);
  const headStud = new THREE.Mesh(headStudGeom, yellowMaterial);
  headStud.position.y = headHeight / 2 + 0.05;
  headGroup.add(headStud);
  
  const torsoTopY = torso.position.y + 0.8 / 2;
  headGroup.position.y = torsoTopY + headHeight / 2;
  
  const legGeom = new THREE.BoxGeometry(0.5, 0.7, 0.5);
  
  const leftLegMesh = new THREE.Mesh(legGeom, blueMaterial);
  leftLegMesh.position.y = -0.35;
  const leftLeg = new THREE.Group();
  leftLeg.name = "leftLeg";
  leftLeg.add(leftLegMesh);
  const hipBottomY = hips.position.y - 0.25 / 2;
  leftLeg.position.set(-0.3, hipBottomY, 0);

  const rightLegMesh = new THREE.Mesh(legGeom, blueMaterial);
  rightLegMesh.position.y = -0.35;
  const rightLeg = new THREE.Group();
  rightLeg.name = "rightLeg";
  rightLeg.add(rightLegMesh);
  rightLeg.position.set(0.3, hipBottomY, 0);

  const armGeom = new THREE.CylinderGeometry(0.18, 0.18, 0.8, 16);
  
  const leftArmMesh = new THREE.Mesh(armGeom, redMaterial);
  leftArmMesh.position.y = -0.4;
  const leftArm = new THREE.Group();
  leftArm.name = "leftArm";
  leftArm.add(leftArmMesh);
  const shoulderY = torsoTopY - 0.1;
  const shoulderX = 1.2 / 2;
  leftArm.position.set(-shoulderX, shoulderY, 0);

  const rightArmMesh = new THREE.Mesh(armGeom, redMaterial);
  rightArmMesh.position.y = -0.4;
  const rightArm = new THREE.Group();
  rightArm.name = "rightArm";
  rightArm.add(rightArmMesh);
  rightArm.position.set(shoulderX, shoulderY, 0);

  const handGeom = new THREE.TorusGeometry(0.15, 0.08, 16, 24, Math.PI * 1.5);
  const leftHand = new THREE.Mesh(handGeom, yellowMaterial);
  leftHand.position.y = -0.4;
  leftHand.rotation.z = Math.PI / 2;
  leftArmMesh.add(leftHand);

  const rightHand = new THREE.Mesh(handGeom, yellowMaterial);
  rightHand.position.y = -0.4;
  rightHand.rotation.z = Math.PI / 2;
  rightArmMesh.add(rightHand);

  playerGroup.add(headGroup, torso, hips, leftLeg, rightLeg, leftArm, rightArm);
  playerGroup.scale.set(1.2, 1.2, 1.2);
  
  return playerGroup;
};

interface GameCanvasProps {
    worldId: string;
    playerName: string;
}

export default function GameCanvas({ worldId, playerName }: GameCanvasProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const mountRef = useRef<HTMLDivElement>(null);

  // Tab-specific session ID
  const [playerSessionId] = useState(() => {
    const urlPid = searchParams.get('pid');
    const storagePid = sessionStorage.getItem('remote-play-session-id');
    const finalPid = urlPid || storagePid || uuidv4();
    sessionStorage.setItem('remote-play-session-id', finalPid);
    return finalPid;
  });

  const [allBlocks, setAllBlocks] = useState<LoadedBlock[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<number>(1);
  const [selectedColor, setSelectedColor] = useState<string>('#9FC3E9');
  const [isInventoryOpen, setInventoryOpen] = useState(false);
  const [isColorPickerOpen, setColorPickerOpen] = useState(false);
  const [isControllerModalOpen, setControllerModalOpen] = useState(false);
  const [isChatting, setIsChatting] = useState(false);
  const [ghostBlock, setGhostBlock] = useState<{ position: THREE.Vector3; rotationY: number; visible: boolean; typeId: number; isPlaceable: boolean; } | null>(null);
  const [ghostNudge, setGhostNudge] = useState({ x: 0, y: 0, z: 0 });
  
  const { firestore, auth, user } = useFirebase();
  const [playerColor, setPlayerColor] = useState<string>('#CCCCCC');
  const [isMuted, setIsMuted] = useState(false);
  const [localPlayerData, setLocalPlayerData] = useState<PlayerData | null>(null);

  // Phase Instruction State
  const [phaseModalOpen, setPhaseModalOpen] = useState(false);
  const prevPhaseRef = useRef<string | null>(null);
  const [showResults, setShowResults] = useState(true);
  const [isResetting, setIsResetting] = useState(false);

  // Selection & Templates
  const [isSelectionMode, setSelectionMode] = useState(false);
  const [selectionA, setSelectionA] = useState<THREE.Vector3 | null>(null);
  const [selectionB, setSelectionB] = useState<THREE.Vector3 | null>(null);
  const [importedModel, setImportedModel] = useState<ModelTemplate | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const physicsSimRef = useRef<PhysicsSimulation | null>(null);
  const physicsFrameRef = useRef<number | null>(null);
  
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const placeSoundRef = useRef<HTMLAudioElement | null>(null);
  const breakSoundRef = useRef<HTMLAudioElement | null>(null);

  // Firestore Data
  const worldDocRef = useMemoFirebase(() => firestore ? doc(firestore, 'worlds', worldId) : null, [firestore, worldId]);
  const { data: worldData, isLoading: worldDataLoading } = useDoc<WorldData>(worldDocRef);

  const voxelsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'worlds', worldId, 'voxels') : null, [firestore, worldId]);
  const { data: voxels, isLoading: voxelsLoading } = useCollection<Omit<Voxel, 'id' | 'worldId'>>(voxelsQuery);
  
  const playersQuery = useMemoFirebase(() => firestore ? collection(firestore, 'worlds', worldId, 'players') : null, [firestore, worldId]);
  const { data: players, isLoading: playersLoading } = useCollection<PlayerData>(playersQuery);

  const messagesQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, 'worlds', worldId, 'messages'), orderBy('timestamp', 'asc')) : null, 
    [firestore, worldId]
  );
  const { data: messages, isLoading: messagesLoading } = useCollection<Omit<ChatMessage, 'id'>>(messagesQuery);

  // Controller Integration
  const controllerRef = useMemoFirebase(() => 
    firestore && playerSessionId ? doc(firestore, 'worlds', worldId, 'controllers', playerSessionId) : null,
    [firestore, worldId, playerSessionId]
  );
  const { data: remoteController } = useDoc<ControllerState>(controllerRef);
  const remoteInputRef = useRef<ControllerState | null>(null);
  const lastActionARef = useRef(false);
  const lastActionBRef = useRef(false);

  // Timers & Phases
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (remoteController) {
      remoteInputRef.current = remoteController;
    }
  }, [remoteController]);

  const isOwner = useMemo(() => {
    if (worldDataLoading || !worldData || !user?.uid) return false;
    return worldData.ownerId === user.uid;
  }, [worldData, worldDataLoading, user?.uid]);

  const isFacilitator = useMemo(() => {
    if (worldDataLoading || !worldData) return false;
    if (worldData.gameMode === 'bridge-test' && isOwner) return true;
    if (worldData.facilitatorMode && isOwner && worldData.facilitatorSessionId === playerSessionId) {
      return true;
    }
    return false;
  }, [worldData, worldDataLoading, isOwner, playerSessionId]);

  const ghostBlockRef = useRef(ghostBlock);
  const ghostNudgeRef = useRef(ghostNudge);
  const selectedBlockIdRef = useRef(selectedBlockId);
  const selectedColorRef = useRef(selectedColor);
  const isInventoryOpenRef = useRef(isInventoryOpen);
  const isColorPickerOpenRef = useRef(isColorPickerOpen);
  const isControllerModalOpenRef = useRef(isControllerModalOpen);
  const isChattingRef = useRef(isChatting);
  const isMutedRef = useRef(isMuted);
  const isSelectionModeRef = useRef(isSelectionMode);
  const selectionARef = useRef(selectionA);
  const selectionBRef = useRef(selectionB);
  const importedModelRef = useRef(importedModel);
  const worldDataRef = useRef(worldData);
  const localPlayerDataRef = useRef(localPlayerData);
  const voxelsRef = useRef(voxels);
  const timeRemainingRef = useRef(timeRemaining);
  
  useEffect(() => { ghostBlockRef.current = ghostBlock; }, [ghostBlock]);
  useEffect(() => { ghostNudgeRef.current = ghostNudge; }, [ghostNudge]);
  useEffect(() => { selectedBlockIdRef.current = selectedBlockId; }, [selectedBlockId]);
  useEffect(() => { selectedColorRef.current = selectedColor; }, [selectedColor]);
  const getBlockRef = useRef<(id: number) => LoadedBlock | undefined>(() => undefined);
  useEffect(() => { isInventoryOpenRef.current = isInventoryOpen; }, [isInventoryOpen]);
  useEffect(() => { isColorPickerOpenRef.current = isColorPickerOpen; }, [isColorPickerOpen]);
  useEffect(() => { isControllerModalOpenRef.current = isControllerModalOpen; }, [isControllerModalOpen]);
  useEffect(() => { isChattingRef.current = isChatting; }, [isChatting]);
  useEffect(() => { isSelectionModeRef.current = isSelectionMode; }, [isSelectionMode]);
  useEffect(() => { selectionARef.current = selectionA; }, [selectionA]);
  useEffect(() => { selectionBRef.current = selectionB; }, [selectionB]);
  useEffect(() => { importedModelRef.current = importedModel; }, [importedModel]);
  useEffect(() => { worldDataRef.current = worldData; }, [worldData]);
  useEffect(() => { localPlayerDataRef.current = localPlayerData; }, [localPlayerData]);
  useEffect(() => { voxelsRef.current = voxels; }, [voxels]);
  useEffect(() => { timeRemainingRef.current = timeRemaining; }, [timeRemaining]);

  useEffect(() => {
    if (!worldData?.gameState?.phase) return;
    
    if (worldData.gameState.phase !== prevPhaseRef.current) {
        if (worldData.gameState.phase !== 'waiting' && !isFacilitator) {
            setPhaseModalOpen(true);
        }
        // Auto-simulate when bridging phase starts (for non-facilitators)
        if (worldData.gameState.phase === 'bridging') {
            const delay = worldData.gameMode === 'bridge-test' ? 500 : 3000;
            setTimeout(() => {
                const mount = mountRef.current;
                if (!mount || !(mount as any).__THREE__) return;
                const { scene } = (mount as any).__THREE__;
                const voxelMeshesGroup = scene.getObjectByName('voxelMeshes') as THREE.Group;
                if (!voxelMeshesGroup || !voxelsRef.current) return;
                const currentGetBlock = getBlockRef.current;
                const sim = createPhysicsWorld(voxelsRef.current, currentGetBlock, voxelMeshesGroup);
                physicsSimRef.current = sim;
                setIsSimulating(true);
                let lastTime = performance.now();
                const physicsLoop = () => {
                    const now = performance.now();
                    const dt = Math.min((now - lastTime) / 1000, 0.05);
                    lastTime = now;
                    stepPhysics(sim, dt);
                    physicsFrameRef.current = requestAnimationFrame(physicsLoop);
                };
                physicsFrameRef.current = requestAnimationFrame(physicsLoop);
            }, delay);
        }
        prevPhaseRef.current = worldData.gameState.phase;
    }
  }, [worldData?.gameState?.phase, isFacilitator]);

  const handleStartGame = useCallback(() => {
    if (!worldDocRef) return;
    updateDocumentNonBlocking(worldDocRef, {
      'gameState.phase': 'collecting',
      'gameState.phaseStartTime': serverTimestamp(),
      'gameState.hasBridgeBeenPlaced': false
    });
  }, [worldDocRef]);

  const handleNextPhase = useCallback(() => {
    if (!worldDocRef || !worldDataRef.current) return;
    const currentPhase = worldDataRef.current.gameState?.phase;
    let nextPhase: string = 'waiting';
    
    if (currentPhase === 'collecting') {
        nextPhase = 'building';
        // Clear uncollected heap bricks immediately
        if (voxelsRef.current && firestore) {
          voxelsRef.current.forEach(v => {
            if (v.isHeap) {
              deleteDocumentNonBlocking(doc(firestore, 'worlds', worldId, 'voxels', v.id));
            }
          });
        }
    }
    else if (currentPhase === 'building') nextPhase = 'bridging';
    else if (currentPhase === 'bridging') nextPhase = 'finished';
    
    updateDocumentNonBlocking(worldDocRef, {
      'gameState.phase': nextPhase,
      'gameState.phaseStartTime': serverTimestamp()
    });
  }, [worldDocRef, firestore, worldId]);

  const handleResetGame = useCallback(async () => {
    if (!firestore || !worldDocRef || !isFacilitator) return;
    
    setIsResetting(true);
    try {
        // Clear all voxels except ground (y=0)
        const voxelsSnap = await getDocs(collection(firestore, 'worlds', worldId, 'voxels'));
        const docsToDelete = voxelsSnap.docs.filter(d => d.data().y > 0);
        
        for (let i = 0; i < docsToDelete.length; i += 400) {
            const batch = writeBatch(firestore);
            const chunk = docsToDelete.slice(i, i + 400);
            chunk.forEach(d => batch.delete(d.ref));
            await batch.commit();
        }

        const playersSnap = await getDocs(collection(firestore, 'worlds', worldId, 'players'));
        const playersBatch = writeBatch(firestore);
        playersSnap.docs.forEach(pDoc => {
          playersBatch.update(pDoc.ref, { inventory: [], isReady: false });
        });
        await playersBatch.commit();

        const worldBatch = writeBatch(firestore);
        worldBatch.update(worldDocRef, {
          'gameState.phase': 'waiting',
          'gameState.phaseStartTime': null,
          'gameState.hasBridgeBeenPlaced': false
        });

        if (worldDataRef.current?.gameMode === 'brick-sprint') {
            const heapColors = ['#C91A09', '#0055BF', '#F2CD37', '#FFFFFF', '#FE8A18'];
            const possibleBlockIds = [1, 2, 8, 9, 12];
            for (let i = 0; i < 60; i++) {
                const x = Math.floor(Math.random() * (WORLD_WIDTH - 2)) + 1;
                const z = Math.floor(Math.random() * (WORLD_DEPTH - 2)) + 1;
                const typeId = possibleBlockIds[Math.floor(Math.random() * possibleBlockIds.length)];
                const color = heapColors[Math.floor(Math.random() * heapColors.length)];
                const voxelRef = doc(collection(firestore, 'worlds', worldId, 'voxels'));
                worldBatch.set(voxelRef, {
                    x, y: 1, z, typeId, rotation: Math.floor(Math.random() * 4), color, isHeap: true
                });
            }
        }

        await worldBatch.commit();
        toast({ title: "Game Restarted", description: "World reset and returned to lobby." });
        setShowResults(false);
        setPhaseModalOpen(false);
    } catch (error) {
        console.error("Reset failed:", error);
        toast({ title: "Reset Failed", variant: "destructive", description: "Could not clear the world. Try again." });
    } finally {
        setIsResetting(false);
    }
  }, [firestore, worldId, worldDocRef, isFacilitator, toast]);

  // Peer-to-Peer Auto Start Logic
  useEffect(() => {
    if (worldDataLoading || !worldData || worldData.facilitatorMode || !isOwner) return;
    if (worldData.gameState?.phase !== 'waiting') return;
    
    if (players && players.length > 0) {
        const allReady = players.every(p => p.isReady);
        if (allReady) {
            handleStartGame();
        }
    }
  }, [players, worldData, worldDataLoading, isOwner, handleStartGame]);

  // Phase Logic / Timers
  useEffect(() => {
    if (!worldData?.gameState?.phase || !worldData?.gameState?.phaseStartTime) return;
    
    const startTime = (worldData.gameState.phaseStartTime as any).toMillis?.() || Date.now();
    const phaseDurations: Record<string, number> = {
      'collecting': worldData.config?.collectingDuration || 60,
      'building': worldData.config?.buildingDuration || 180,
    };
    
    const duration = phaseDurations[worldData.gameState.phase];
    if (!duration) {
      setTimeRemaining(null);
      return;
    }

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, duration - elapsed);
      setTimeRemaining(remaining);
      
      // Auto-advance (Only if NOT in facilitator mode)
      if (remaining === 0 && isOwner && !worldDataRef.current?.facilitatorMode) {
        if (worldData.gameState?.phase === 'collecting') {
          // Cleanup heap bricks when time expires
          if (voxelsRef.current && firestore) {
            voxelsRef.current.forEach(v => {
              if (v.isHeap) {
                deleteDocumentNonBlocking(doc(firestore, 'worlds', worldId, 'voxels', v.id));
              }
            });
          }

          updateDocumentNonBlocking(worldDocRef!, { 
            'gameState.phase': 'building', 
            'gameState.phaseStartTime': serverTimestamp() 
          });
        } else if (worldData.gameState?.phase === 'building') {
          updateDocumentNonBlocking(worldDocRef!, { 
            'gameState.phase': 'finished', 
            'gameState.phaseStartTime': serverTimestamp() 
          });
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [worldData?.gameState?.phase, worldData?.gameState?.phaseStartTime, isOwner, worldDocRef, firestore, worldId, worldData?.config]);

  useEffect(() => {
    isMutedRef.current = isMuted;
    const music = musicRef.current;
    if (!music) return;
    if (isMuted) {
      music.pause();
    } else if (music.paused) {
      music.play().catch(e => {});
    }
  }, [isMuted]);

  useEffect(() => {
    setPlayerColor('#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'));
  }, []);
  
  useEffect(() => {
    if (!firestore || !user || !playerName || !playerColor || !playerSessionId || worldDataLoading) return;

    const selfPlayerDocRef = doc(firestore, 'worlds', worldId, 'players', playerSessionId);
    
    const newPlayerData: Omit<PlayerData, 'id'> = {
        uid: playerSessionId,
        authUid: user.uid,
        worldId: worldId,
        playerName: isFacilitator ? `${playerName} (Facilitator)` : playerName,
        position: { x: WORLD_WIDTH / 2, y: PLATE_TOTAL_HEIGHT * 40, z: WORLD_DEPTH / 2 },
        rotation: { y: 0, x: 0 },
        color: playerColor,
        lastSeen: serverTimestamp(),
        inventory: [],
        isReady: false
    };
    setDocumentNonBlocking(selfPlayerDocRef, newPlayerData, { merge: true });

    return () => {
        deleteDocumentNonBlocking(selfPlayerDocRef);
    };
  }, [firestore, user, worldId, playerName, playerColor, playerSessionId, isFacilitator, worldDataLoading]);

  useEffect(() => {
      if (players && playerSessionId) {
          const ownData = players.find(p => p.id === playerSessionId);
          if (ownData) {
              setLocalPlayerData(ownData as PlayerData);
          }
      }
  }, [players, playerSessionId]);

  useEffect(() => {
    musicRef.current = new Audio('/sounds/music.mp3');
    musicRef.current.loop = true;
    placeSoundRef.current = new Audio('/sounds/place.mp3');
    breakSoundRef.current = new Audio('/sounds/break.mp3');

    const playOnFirstInteraction = () => {
        if (!isMutedRef.current && musicRef.current?.paused) {
            musicRef.current.play().catch(e => {});
        }
        window.removeEventListener('click', playOnFirstInteraction);
        window.removeEventListener('keydown', playOnFirstInteraction);
    };

    window.addEventListener('click', playOnFirstInteraction);
    window.addEventListener('keydown', playOnFirstInteraction);

    return () => {
      window.removeEventListener('click', playOnFirstInteraction);
      window.removeEventListener('keydown', playOnFirstInteraction);
      musicRef.current?.pause();
    };
  }, []);

  const handleMuteToggle = () => {
    setIsMuted(prevIsMuted => !prevIsMuted);
  };

  const handleToggleReady = () => {
    if (!firestore || !playerSessionId) return;
    const selfPlayerDocRef = doc(firestore, 'worlds', worldId, 'players', playerSessionId);
    updateDocumentNonBlocking(selfPlayerDocRef, { isReady: !localPlayerData?.isReady });
  };
  
  const getBlock = useCallback((id: number): LoadedBlock | undefined => {
    return allBlocks.find(b => b.id === id);
  }, [allBlocks]);

  useEffect(() => { getBlockRef.current = getBlock; }, [getBlock]);

  // Load bridge as importedModel for facilitator to manually position
  const handleLoadBridge = useCallback(() => {
    const bridgeModel = worldDataRef.current?.gameState?.bridgeModel || defaultBridgeData;
    setImportedModel(bridgeModel as ModelTemplate);
    setGhostNudge({ x: 0, y: 0, z: 0 });
    // Reset ghost rotation so the bridge doesn't inherit random brick rotation
    setGhostBlock(prev => prev ? { ...prev, rotationY: 0 } : { position: new THREE.Vector3(0,0,0), typeId: 1, rotationY: 0, visible: false, isPlaceable: true });
    toast({ title: '🌉 Bridge Loaded', description: 'Position the bridge over the towers. Right-click to place. Use arrow keys to nudge.' });
  }, [toast]);

  // After bridge is placed, start bridging phase + auto-sim
  const handleStartBridging = useCallback(() => {
    if (!worldDocRef) return;
    updateDocumentNonBlocking(worldDocRef, {
      'gameState.phase': 'bridging',
      'gameState.phaseStartTime': serverTimestamp()
    });
  }, [worldDocRef]);

  const handleUploadBridge = useCallback(async (file: File) => {
    if (!worldDocRef) return;
    try {
      const model = await importModelLocally(file);
      updateDocumentNonBlocking(worldDocRef, {
        'gameState.bridgeModel': {
          name: model.name,
          version: model.version,
          voxels: model.voxels
        }
      });
      toast({ title: '🌉 Bridge Uploaded', description: `"${model.name}" loaded as the bridge model.` });
    } catch {
      toast({ title: 'Upload Error', description: 'Invalid bridge model file.', variant: 'destructive' });
    }
  }, [worldDocRef, toast]);
  
  const handleUndoBridge = useCallback(async () => {
    if (!worldDocRef || !firestore) return;
    // 1. Remove all bridge voxels
    const bridgeVoxels = voxels.filter(v => v.isBridge);
    const batch = writeBatch(firestore);
    for (const v of bridgeVoxels) {
      batch.delete(doc(collection(firestore, 'worlds', worldId, 'voxels'), v.id));
    }
    
    // 2. Reset hasBridgeBeenPlaced
    batch.update(worldDocRef, {
      'gameState.hasBridgeBeenPlaced': false
    });
    
    await batch.commit();
    toast({ title: 'Bridge Undone', description: 'The bridge has been removed. You may place it again.' });
  }, [worldDocRef, firestore, voxels, worldId, toast]);
  
  const isCellOccupied = useMemo(() => {
    const occupiedCells = new Set<string>();
    if (!voxels) return () => false;

    voxels.forEach(v => {
        const blockDef = getBlock(v.typeId);
        if (!blockDef) return;
        
        const isRotated90 = Math.round(v.rotation) % 2 !== 0;
        const blockWidth = isRotated90 ? blockDef.depth : blockDef.width;
        const blockDepth = isRotated90 ? blockDef.width : blockDef.depth;

        for (let x_offset = 0; x_offset < blockWidth; x_offset++) {
            for (let z_offset = 0; z_offset < blockDepth; z_offset++) {
                for (let y_offset = 0; y_offset < blockDef.heightInPlates; y_offset++) {
                    occupiedCells.add(`${v.x + x_offset}|${v.y + y_offset}|${v.z + z_offset}`);
                }
            }
        }
    });
    return (x: number, y: number, z: number): boolean => occupiedCells.has(`${x}|${y}|${z}`);
  }, [voxels, getBlock]);

  const isCellOccupiedRef = useRef(isCellOccupied);
  useEffect(() => { isCellOccupiedRef.current = isCellOccupied; }, [isCellOccupied]);


  const checkPlaceability = useCallback((position: THREE.Vector3, blockId: number, rotation: number): boolean => {
    const newBlockDef = getBlock(blockId);
    if (!newBlockDef) return false;

    const isRotated90 = Math.round(rotation / (Math.PI / 2)) % 2 !== 0;
    const newBlockWidth = isRotated90 ? newBlockDef.depth : newBlockDef.width;
    const newBlockDepth = isRotated90 ? newBlockDef.width : newBlockDef.depth;
    
    const { x: startX, y: startY, z: startZ } = position;
    
    if (startX < 0 || startX + newBlockWidth > WORLD_WIDTH || 
        startY < 0 || startY + newBlockDef.heightInPlates > WORLD_HEIGHT ||
        startZ < 0 || startZ + newBlockDepth > WORLD_DEPTH) {
      return false;
    }

    let hasSupport = (startY === 0);

    for (let x_offset = 0; x_offset < newBlockWidth; x_offset++) {
        for (let z_offset = 0; z_offset < newBlockDepth; z_offset++) {
            const currentX = startX + x_offset;
            const currentZ = startZ + z_offset;

            for (let y_offset = 0; y_offset < newBlockDef.heightInPlates; y_offset++) {
                const currentY = startY + y_offset;
                if (isCellOccupiedRef.current(currentX, currentY, currentZ)) {
                    return false; 
                }
            }

            if (startY > 0 && !hasSupport) {
                if (isCellOccupiedRef.current(currentX, startY - 1, currentZ)) {
                    hasSupport = true;
                }
            }
        }
    }

    return hasSupport;
  }, [getBlock]);
  
  const previousPlayersRef = useRef<PlayerData[]>([]);
  const eventLog = useMemo((): ChatMessage[] => {
    const currentPlayers = (players || []) as PlayerData[];
    const previousPlayers = previousPlayersRef.current;
    const newLocalEvents: ChatMessage[] = [];
    currentPlayers.forEach(p => {
        if (!previousPlayers.some(prev => prev.uid === p.uid)) {
            newLocalEvents.push({
                id: `join-${p.uid}-${Date.now()}`,
                uid: p.uid,
                playerName: p.playerName,
                text: `${p.playerName} has joined the world.`,
                timestamp: serverTimestamp(),
                isEvent: true
            });
        }
    });
    previousPlayersRef.current = currentPlayers;
    const allEvents = [...(messages?.map(m => ({ ...m, isEvent: false })) || []), ...newLocalEvents];
    return allEvents;
  }, [messages, players]);

  useEffect(() => {
    const loaded = generateAllBlockGeometries();
    setAllBlocks(loaded);
    if (loaded.length > 0) {
      setSelectedBlockId(loaded[0].id);
    }
  }, []);

  const isLoading = voxelsLoading || playersLoading || messagesLoading || worldDataLoading || allBlocks.length === 0 || isResetting;

  const getVoxelCoordinates = useCallback((pos: THREE.Vector3) => ({
    x: Math.floor(pos.x),
    y: Math.floor(pos.y / PLATE_TOTAL_HEIGHT),
    z: Math.floor(pos.z),
  }), []);

  const getNewBlockPosition = useCallback((intersection: THREE.Intersection): THREE.Vector3 | null => {
      const newBlockPos = intersection.point.clone().add(intersection.face.normal.clone().multiplyScalar(0.1));
      const newBlockGridCoords = getVoxelCoordinates(newBlockPos);
      return new THREE.Vector3(newBlockGridCoords.x, newBlockGridCoords.y, newBlockGridCoords.z);
  }, [getVoxelCoordinates]);

  const handleActionA = useCallback((mouseEvent?: { x: number, y: number }) => {
      if (isFacilitator) return;
      const gameMode = worldDataRef.current?.gameMode;
      const phase = worldDataRef.current?.gameState?.phase;
      const remaining = timeRemainingRef.current;
      const isTimeUp = remaining !== null && remaining <= 0;

      // Interaction Guards
      if (gameMode === 'brick-sprint') {
          if (phase === 'waiting' || phase === 'finished' || isTimeUp) return;
      }

      const mount = mountRef.current;
      if (!mount || !(mount as any).__THREE__) return;
      const { camera, voxelMeshes } = (mount as any).__THREE__;

      const raycaster = new THREE.Raycaster();
      if (mouseEvent) {
          raycaster.setFromCamera(mouseEvent, camera);
      } else {
          raycaster.setFromCamera({ x: 0, y: 0 }, camera);
      }
      const intersects = raycaster.intersectObjects(voxelMeshes.children, true);

      if (isSelectionModeRef.current && intersects.length > 0) {
          const intersect = intersects[0];
          const coords = getVoxelCoordinates(intersect.point.clone().sub(intersect.face.normal.clone().multiplyScalar(0.1)));
          setSelectionA(new THREE.Vector3(coords.x, coords.y, coords.z));
      } else if (intersects.length > 0) {
          const intersect = intersects[0];
          const voxelIdToRemove = intersect.object.userData.voxelId;
          const isHeap = intersect.object.userData.isHeap;
          
          if (gameMode === 'brick-sprint' && phase === 'collecting') {
            if (isHeap && voxelIdToRemove) {
              const currentInventory = localPlayerDataRef.current?.inventory || [];
              const maxAllowed = worldDataRef.current?.config?.maxBlocks || 25;
              if (currentInventory.length >= maxAllowed) {
                toast({ title: "Inventory Full", description: `You can only carry ${maxAllowed} blocks!`, variant: "destructive" });
                return;
              }
              const voxel = voxelsRef.current?.find(v => v.id === voxelIdToRemove);
              if (voxel) {
                updateDocumentNonBlocking(doc(firestore!, 'worlds', worldId, 'players', playerSessionId), {
                  inventory: [...currentInventory, voxel.typeId]
                });
                deleteDocumentNonBlocking(doc(firestore!, 'worlds', worldId, 'voxels', voxelIdToRemove));
                if (!isMutedRef.current && placeSoundRef.current) placeSoundRef.current.play().catch(e => {});
              }
            }
            return;
          }

          if (voxelIdToRemove) {
              const voxel = voxelsRef.current?.find(v => v.id === voxelIdToRemove);
              if (gameMode === 'brick-sprint' && phase === 'building') {
                if (voxel?.placedBy !== user?.uid) return;
              }
              if (!isMutedRef.current && breakSoundRef.current) breakSoundRef.current.play().catch(e => {});
              deleteDocumentNonBlocking(doc(firestore!, 'worlds', worldId, 'voxels', voxelIdToRemove));
          }
      }
  }, [isFacilitator, firestore, worldId, playerSessionId, user, toast, getVoxelCoordinates, voxelsQuery]);

  const handleActionB = useCallback((mouseEvent?: { x: number, y: number }) => {
      if (isFacilitator && !importedModelRef.current) return;
      const gameMode = worldDataRef.current?.gameMode;
      const phase = worldDataRef.current?.gameState?.phase;
      const remaining = timeRemainingRef.current;
      const isTimeUp = remaining !== null && remaining <= 0;

      // Interaction Guards
      if (gameMode === 'brick-sprint' && !isFacilitator) {
          if (phase !== 'building' || isTimeUp) return;
      }

      const mount = mountRef.current;
      if (!mount || !(mount as any).__THREE__) return;
      const { camera, voxelMeshes } = (mount as any).__THREE__;

      const raycaster = new THREE.Raycaster();
      if (mouseEvent) {
          raycaster.setFromCamera(mouseEvent, camera);
      } else {
          raycaster.setFromCamera({ x: 0, y: 0 }, camera);
      }
      const intersects = raycaster.intersectObjects(voxelMeshes.children, true);

      if (isSelectionModeRef.current && intersects.length > 0) {
          const intersect = intersects[0];
          const coords = getVoxelCoordinates(intersect.point.clone().sub(intersect.face.normal.clone().multiplyScalar(0.1)));
          setSelectionB(new THREE.Vector3(coords.x, coords.y, coords.z));
      } else if (importedModelRef.current) {
          const model = importedModelRef.current;
          const currentGhostBlock = ghostBlockRef.current;
          if (currentGhostBlock && currentGhostBlock.visible) {
              // Determine long axis for bridge placement chunking
              const minZ = Math.min(...model.voxels.map(v=>v.z));
              const maxZ = Math.max(...model.voxels.map(v=>v.z));
              const minX = Math.min(...model.voxels.map(v=>v.x));
              const maxX = Math.max(...model.voxels.map(v=>v.x));
              const useX = (maxX - minX) > (maxZ - minZ);

              model.voxels.forEach(v => {
                  const val = useX ? v.x : v.z;
                  const segment = Math.floor(val / 4);

                  const newVoxel = {
                      x: currentGhostBlock.position.x + v.x,
                      y: currentGhostBlock.position.y + v.y,
                      z: currentGhostBlock.position.z + v.z,
                      typeId: v.typeId,
                      // The geometry is already rotated by the 'r' key logic, so the face rotation 
                      // should be the voxel's current rotation + the ghost block's visual rotation
                      rotation: v.rotation,
                      color: v.color,
                      placedBy: user?.uid,
                      isBridge: isFacilitator ? true : undefined,
                      bridgeSegment: isFacilitator ? segment : undefined
                  };
                  addDocumentNonBlocking(voxelsQuery!, newVoxel);
              });
              
              if (isFacilitator && worldDocRef) {
                  updateDocumentNonBlocking(worldDocRef, {
                      'gameState.hasBridgeBeenPlaced': true
                  });
              }
              setImportedModel(null);
              setGhostNudge({ x: 0, y: 0, z: 0 });
              if (!isMutedRef.current && placeSoundRef.current) placeSoundRef.current.play().catch(e => {});
          }
      } else {
          const currentGhostBlock = ghostBlockRef.current;
          if (currentGhostBlock && currentGhostBlock.visible && currentGhostBlock.isPlaceable) {
              if (gameMode === 'brick-sprint') {
                  const inv = localPlayerDataRef.current?.inventory || [];
                  const blockIdx = inv.indexOf(currentGhostBlock.typeId);
                  if (blockIdx === -1) {
                      toast({ title: "Out of Bricks", description: "You don't have this brick in your inventory!", variant: "destructive" });
                      return;
                  }
                  const newInv = [...inv];
                  newInv.splice(blockIdx, 1);
                  updateDocumentNonBlocking(doc(firestore!, 'worlds', worldId, 'players', playerSessionId), {
                      inventory: newInv
                  });
              }

              if (!isMutedRef.current && placeSoundRef.current) placeSoundRef.current.play().catch(e => {});
              const newVoxel: Omit<Voxel, 'id' | 'worldId'> = {
                  x: currentGhostBlock.position.x,
                  y: currentGhostBlock.position.y,
                  z: currentGhostBlock.position.z,
                  typeId: currentGhostBlock.typeId,
                  rotation: Math.round(currentGhostBlock.rotationY / (Math.PI / 2)) % 4,
                  color: selectedColorRef.current,
                  placedBy: user?.uid
              };
              addDocumentNonBlocking(voxelsQuery!, newVoxel);
              setGhostNudge({ x: 0, y: 0, z: 0 });
          }
      }
  }, [isFacilitator, firestore, worldId, playerSessionId, user, toast, getVoxelCoordinates, voxelsQuery]);

  const handleActionARef = useRef(handleActionA);
  const handleActionBRef = useRef(handleActionB);
  useEffect(() => { handleActionARef.current = handleActionA; }, [handleActionA]);
  useEffect(() => { handleActionBRef.current = handleActionB; }, [handleActionB]);
  
  const throttledUpdatePlayerPosition = useMemo(
    () =>
      throttle((camera: THREE.Camera) => {
        if (!user || !firestore || !localPlayerDataRef.current || !playerSessionId) return;
        const playerRef = doc(firestore, 'worlds', worldId, 'players', playerSessionId);
        const playerData: Partial<Omit<PlayerData, 'id'>> = {
          position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
          rotation: { y: camera.rotation.y, x: camera.rotation.x },
          lastSeen: serverTimestamp(),
        };
        updateDocumentNonBlocking(playerRef, playerData);
      }, 2000),
    [user, firestore, worldId, playerSessionId]
  );
  
  useEffect(() => {
    if (isLoading || !firestore || !user) return;
    
    const mount = mountRef.current;
    if (!mount || mount.childElementCount > 0) return;

    const isIsometric = worldDataRef.current?.gameMode === 'isometric-build';
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 200, 600);

    let camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
    const aspect = window.innerWidth / window.innerHeight;

    if (isIsometric) {
        const d = 15;
        camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 0.1, 1000);
        camera.position.set(20, 20, 20);
        camera.lookAt(WORLD_WIDTH / 2, 0, WORLD_DEPTH / 2);
    } else {
        camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
        camera.rotation.order = 'YXZ'; 
        camera.position.set(WORLD_WIDTH / 2, PLATE_TOTAL_HEIGHT * 40, WORLD_DEPTH / 2);
    }

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    mount.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(150, 200, 100);
    scene.add(directionalLight);

    const voxelMeshes = new THREE.Group();
    voxelMeshes.name = 'voxelMeshes';
    scene.add(voxelMeshes);

    const playerMeshes = new THREE.Group();
    playerMeshes.name = 'playerMeshes';
    scene.add(playerMeshes);

    const keys: { [key: string]: boolean } = {};
    const clock = new THREE.Clock();
    let isPointerLocked = false;
    let ghostBlockMesh: THREE.Mesh | null = null;
    let importedModelGroup: THREE.Group | null = null;
    let lastBasePos: THREE.Vector3 | null = null;
    
    const updateGhostBlockMesh = (blockId: number) => {
        if (isFacilitator) return;
        if (ghostBlockMesh) scene.remove(ghostBlockMesh);
        const block = getBlock(blockId);
        if (block) {
            const ghostMaterial = new THREE.MeshStandardMaterial({ color: '#A0A5A9', transparent: true, opacity: 0.6 });
            ghostBlockMesh = new THREE.Mesh(block.geometry, ghostMaterial);
            scene.add(ghostBlockMesh);
            setGhostBlock(prev => ({ ...(prev ?? { position: new THREE.Vector3(), rotationY: 0, visible: false, isPlaceable: false }), typeId: blockId }));
        }
    };
    
    if(allBlocks.length > 0 && !isFacilitator) {
        updateGhostBlockMesh(selectedBlockIdRef.current);
    }

    const onMouseDown = (event: MouseEvent) => {
        if (!isIsometric && !isPointerLocked && !isFacilitator) return;
        event.preventDefault();
        
        const mouse = (isIsometric || isFacilitator) ? {
            x: (event.clientX / window.innerWidth) * 2 - 1,
            y: -(event.clientY / window.innerHeight) * 2 + 1
        } : undefined;

        if (event.button === 0) handleActionARef.current(mouse);
        if (event.button === 2) handleActionBRef.current(mouse);
    };

    const onPointerLockChange = () => { isPointerLocked = document.pointerLockElement === renderer.domElement; };
    const onMouseMove = (event: MouseEvent) => {
      if (isPointerLocked && !isIsometric) {
        camera.rotation.y -= event.movementX * 0.002;
        camera.rotation.x -= event.movementY * 0.002;
        camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));
      }
    };
    
    const onKeyDown = (event: KeyboardEvent) => {
      if (isChattingRef.current) return;
      if (isIsometric || isPointerLocked) keys[event.code] = true;

      // Calculate relative directions based on camera rotation
      const angle = (camera.rotation.y % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      const dir = Math.round(angle / (Math.PI / 2)) % 4;
      
      let f = { x: 0, z: -1 }; // Forward
      let r = { x: 1, z: 0 };  // Right
      
      if (dir === 1) { // Looking West
        f = { x: -1, z: 0 };
        r = { x: 0, z: -1 };
      } else if (dir === 2) { // Looking South
        f = { x: 0, z: 1 };
        r = { x: -1, z: 0 };
      } else if (dir === 3) { // Looking East
        f = { x: 1, z: 0 };
        r = { x: 0, z: 1 };
      }

      switch (event.key.toLowerCase()) {
        case 'i': if(!isFacilitator) setInventoryOpen(o => !o); break;
        case 'c': if(!isFacilitator) setColorPickerOpen(o => !o); break;
        case 't': event.preventDefault(); setIsChatting(true); break;
        case 'r':
          if (importedModelRef.current) {
              setImportedModel(prev => {
                  if (!prev) return prev;
                  // Rotate all voxels 90 degrees around origin
                  const rotatedVoxels = prev.voxels.map(v => ({
                      ...v,
                      x: -v.z,
                      z: v.x,
                      rotation: (v.rotation + 1) % 4
                  }));
                  // Re-center if min coordinates shifted
                  const minX = Math.min(...rotatedVoxels.map(v => v.x));
                  const minZ = Math.min(...rotatedVoxels.map(v => v.z));
                  const normalizedVoxels = rotatedVoxels.map(v => ({
                      ...v,
                      x: v.x - minX,
                      z: v.z - minZ
                  }));
                  return { ...prev, voxels: normalizedVoxels };
              });
              // Force recreation of the group mesh
              if (importedModelGroup) {
                  scene.remove(importedModelGroup);
                  importedModelGroup = null;
              }
          } else if (!isFacilitator) {
              setGhostBlock(prev => prev ? ({ ...prev, rotationY: (prev.rotationY + Math.PI / 2) % (Math.PI * 2) }) : null);
          }
          break;
        case 'arrowup':
          event.preventDefault();
          if (!isFacilitator || importedModelRef.current) setGhostNudge(p => ({ ...p, x: p.x + f.x, z: p.z + f.z }));
          break;
        case 'arrowdown':
          event.preventDefault();
          if (!isFacilitator || importedModelRef.current) setGhostNudge(p => ({ ...p, x: p.x - f.x, z: p.z - f.z }));
          break;
        case 'arrowleft':
          event.preventDefault();
          if (!isFacilitator || importedModelRef.current) setGhostNudge(p => ({ ...p, x: p.x - r.x, z: p.z - r.z }));
          break;
        case 'arrowright':
          event.preventDefault();
          if (!isFacilitator || importedModelRef.current) setGhostNudge(p => ({ ...p, x: p.x + r.x, z: p.z + r.z }));
          break;
        case 'escape':
            if (importedModelRef.current) setImportedModel(null);
            setGhostNudge({ x: 0, y: 0, z: 0 });
            break;
      }
    };
    const onKeyUp = (event: KeyboardEvent) => { keys[event.code] = false; };
    const onWindowResize = () => {
      const aspect = window.innerWidth / window.innerHeight;
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.aspect = aspect;
      } else {
        const d = 15;
        camera.left = -d * aspect;
        camera.right = d * aspect;
        camera.top = d;
        camera.bottom = -d;
      }
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    const lockPointer = () => {
      if (!isIsometric && !isInventoryOpenRef.current && !isColorPickerOpenRef.current && !isChattingRef.current && !isControllerModalOpenRef.current) {
        renderer.domElement.requestPointerLock();
      }
    };
    
    document.addEventListener('pointerlockchange', onPointerLockChange);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('click', lockPointer);
    renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('resize', onWindowResize);

    let mouseX = 0;
    let mouseY = 0;
    const updateMousePos = (e: MouseEvent) => {
        mouseX = (e.clientX / window.innerWidth) * 2 - 1;
        mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    if (isIsometric || isFacilitator) window.addEventListener('mousemove', updateMousePos);

    let animationFrameId: number;
    const animate = () => {
        animationFrameId = requestAnimationFrame(animate);
        const delta = clock.getDelta();
        
        const remoteInput = remoteInputRef.current;
        if (remoteInput && !isIsometric) {
            if (remoteInput.look.x !== 0 || remoteInput.look.y !== 0) {
              camera.rotation.y -= remoteInput.look.x * 2.0 * delta;
              camera.rotation.x += remoteInput.look.y * 2.0 * delta;
              camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));
            }
            if (remoteInput.actionA && !lastActionARef.current) handleActionARef.current();
            if (remoteInput.actionB && !lastActionBRef.current) handleActionBRef.current();
            lastActionARef.current = remoteInput.actionA;
            lastActionBRef.current = remoteInput.actionB;
        }

        const speed = 15.0 * delta * (keys['ShiftLeft'] || keys['ShiftRight'] ? 2 : 1);
        
        if (isIsometric) {
            const panSpeed = speed * 0.5;
            const forward = new THREE.Vector3(-1, 0, -1).normalize();
            const right = new THREE.Vector3(1, 0, -1).normalize();
            if (keys['KeyW']) camera.position.addScaledVector(forward, panSpeed);
            if (keys['KeyS']) camera.position.addScaledVector(forward, -panSpeed);
            if (keys['KeyD']) camera.position.addScaledVector(right, panSpeed);
            if (keys['KeyA']) camera.position.addScaledVector(right, -panSpeed);
        } else {
            const euler = new THREE.Euler(0, camera.rotation.y, 0, 'YXZ');
            const forward = new THREE.Vector3(0, 0, -1).applyEuler(euler);
            const right = new THREE.Vector3(1, 0, 0).applyEuler(euler);
            const moveX = (keys['KeyD'] ? 1 : 0) - (keys['KeyA'] ? 1 : 0) + (remoteInput?.move.x || 0);
            const moveZ = (keys['KeyS'] ? 1 : 0) - (keys['KeyW'] ? 1 : 0) - (remoteInput?.move.y || 0);
            if (moveX !== 0) camera.position.addScaledVector(right, moveX * speed);
            if (moveZ !== 0) camera.position.addScaledVector(forward, -moveZ * speed);
            if (keys['Space'] || remoteInput?.jump) camera.position.y += speed;
            if (keys['ControlLeft']) camera.position.y -= speed;
            camera.position.y = Math.max(camera.position.y, PLATE_TOTAL_HEIGHT);
        }
        
        throttledUpdatePlayerPosition(camera);

        const raycaster = new THREE.Raycaster();
        if (isIsometric || isFacilitator) raycaster.setFromCamera({ x: mouseX, y: mouseY }, camera);
        else raycaster.setFromCamera({ x: 0, y: 0 }, camera);
        const intersects = raycaster.intersectObjects(voxelMeshes.children, true);

        if (importedModelRef.current) {
            if (!importedModelGroup) {
                importedModelGroup = new THREE.Group();
                importedModelRef.current.voxels.forEach(v => {
                    const blockDef = getBlock(v.typeId);
                    if (blockDef) {
                        const material = new THREE.MeshStandardMaterial({ color: v.color, transparent: true, opacity: 0.5 });
                        const mesh = new THREE.Mesh(blockDef.geometry, material);
                        mesh.position.set(v.x, v.y * PLATE_TOTAL_HEIGHT, v.z);
                        mesh.rotation.y = v.rotation * (Math.PI / 2);
                        importedModelGroup?.add(mesh);
                    }
                });
                scene.add(importedModelGroup);
            }
            if (intersects.length > 0) {
                const basePos = getNewBlockPosition(intersects[0]);
                if (basePos) {
                    let currentNudge = ghostNudgeRef.current;
                    if (!lastBasePos || !basePos.equals(lastBasePos)) {
                        lastBasePos = basePos.clone();
                    }
                    const finalPos = basePos.clone().add(new THREE.Vector3(currentNudge.x, currentNudge.y, currentNudge.z));
                    importedModelGroup.position.set(finalPos.x, finalPos.y * PLATE_TOTAL_HEIGHT, finalPos.z);
                    setGhostBlock(prev => ({ ...(prev ?? { rotationY: 0, typeId: 1 }), position: finalPos, visible: true, isPlaceable: true }));
                }
            } else {
                lastBasePos = null;
            }
        } else if (!isFacilitator) {
            if (importedModelGroup) {
                scene.remove(importedModelGroup);
                importedModelGroup = null;
            }
            if (ghostBlockRef.current?.typeId !== selectedBlockIdRef.current) updateGhostBlockMesh(selectedBlockIdRef.current);
            if (intersects.length > 0) {
                const basePos = getNewBlockPosition(intersects[0]);
                if (basePos) {
                    let currentNudge = ghostNudgeRef.current;
                    if (!lastBasePos || !basePos.equals(lastBasePos)) {
                        setGhostNudge({ x: 0, y: 0, z: 0 });
                        lastBasePos = basePos.clone();
                        currentNudge = { x: 0, y: 0, z: 0 };
                    }
                    const finalPos = basePos.clone().add(new THREE.Vector3(currentNudge.x, currentNudge.y, currentNudge.z));
                    const rotation = ghostBlockRef.current?.rotationY ?? 0;
                    const isPlaceable = checkPlaceability(finalPos, selectedBlockIdRef.current, rotation);
                    setGhostBlock(prev => ({...(prev ?? { rotationY: 0, typeId: selectedBlockIdRef.current }), position: finalPos, visible: true, isPlaceable: isPlaceable }));
                } else {
                    setGhostBlock(prev => prev ? { ...prev, visible: false } : null);
                    lastBasePos = null;
                }
            } else {
                setGhostBlock(prev => prev ? { ...prev, visible: false } : null);
                lastBasePos = null;
            }
        }

        const currentGhostBlock = ghostBlockRef.current;
        const isBuildingPhase = worldDataRef.current?.gameState?.phase === 'building' || worldDataRef.current?.gameMode === 'sandbox' || worldDataRef.current?.gameMode === 'isometric-build';
        if (ghostBlockMesh && currentGhostBlock?.visible && !importedModelRef.current && !isFacilitator && isBuildingPhase) {
            const blockDef = getBlock(currentGhostBlock.typeId);
            if (blockDef) {
                const rotation = currentGhostBlock.rotationY;
                const isRotated90 = Math.round(rotation / (Math.PI / 2)) % 2 !== 0;
                const blockWidth = isRotated90 ? blockDef.depth : blockDef.width;
                const blockDepth = isRotated90 ? blockDef.width : blockDef.depth;
                const blockHeight = blockDef.heightInPlates * PLATE_TOTAL_HEIGHT;
                ghostBlockMesh.position.set(currentGhostBlock.position.x + blockWidth / 2, currentGhostBlock.position.y * PLATE_TOTAL_HEIGHT + blockHeight / 2, currentGhostBlock.position.z + blockDepth / 2);
                ghostBlockMesh.rotation.y = rotation;
                (ghostBlockMesh.material as THREE.MeshStandardMaterial).color.set(currentGhostBlock.isPlaceable ? '#A0A5A9' : '#FF0000');
                ghostBlockMesh.visible = true;
            }
        } else if (ghostBlockMesh) ghostBlockMesh.visible = false;

        renderer.render(scene, camera);
    };

    animate();
    (mount as any).__THREE__ = { scene, camera, voxelMeshes };

    return () => {
      cancelAnimationFrame(animationFrameId);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      if (isIsometric) window.removeEventListener('mousemove', updateMousePos);
      if (mount) {
        renderer.domElement.removeEventListener('mousedown', onMouseDown);
        renderer.domElement.removeEventListener('click', lockPointer);
        if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      }
    };
  }, [isLoading, firestore, user, worldId]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !mount.__THREE__ || !voxels) return;
    const { scene } = (mount as any).__THREE__;
    const voxelMeshesGroup = scene.getObjectByName('voxelMeshes') as THREE.Group;
    if (!voxelMeshesGroup) return;
    const firestoreVoxelIds = new Set(voxels.map(v => v.id));
    voxelMeshesGroup.children = voxelMeshesGroup.children.filter(child => {
        if (!firestoreVoxelIds.has(child.userData.voxelId)) {
            (child as THREE.Mesh).geometry.dispose();
            return false;
        }
        return true;
    });
    const existingVoxelIds = new Set(voxelMeshesGroup.children.map(c => c.userData.voxelId));
    voxels.forEach(voxel => {
        if (existingVoxelIds.has(voxel.id)) return;
        const blockData = getBlock(voxel.typeId);
        if (blockData) {
            const material = new THREE.MeshStandardMaterial({ 
              color: voxel.color, 
              metalness: 0.1, 
              roughness: 0.8,
              transparent: voxel.isHeap,
              opacity: voxel.isHeap ? 0.7 : 1.0
            });
            const brick = new THREE.Mesh(blockData.geometry, material);
            brick.rotation.y = voxel.rotation * (Math.PI / 2);
            const isRotated90 = Math.round(voxel.rotation) % 2 !== 0;
            const blockWidth = isRotated90 ? blockData.depth : blockData.width;
            const blockDepth = isRotated90 ? blockData.width : blockData.depth;
            brick.position.set(voxel.x + blockWidth / 2, voxel.y * PLATE_TOTAL_HEIGHT + (blockData.heightInPlates * PLATE_TOTAL_HEIGHT) / 2, voxel.z + blockDepth / 2);
            brick.userData = { voxelId: voxel.id, isHeap: voxel.isHeap };
            voxelMeshesGroup.add(brick);
        }
    });
  }, [voxels, getBlock]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !mount.__THREE__ || !players || !playerSessionId) return;
    const { scene } = (mount as any).__THREE__;
    const playerMeshesGroup = scene.getObjectByName('playerMeshes') as THREE.Group;
    const remotePlayerIds = new Set(players.map(p => p.id).filter(id => id !== playerSessionId));
    playerMeshesGroup.children = playerMeshesGroup.children.filter(child => remotePlayerIds.has(child.name));
    players.forEach(player => {
        if (player.id === playerSessionId) return;
        let playerMesh = playerMeshesGroup.getObjectByName(player.id) as THREE.Group;
        if (!playerMesh) {
            playerMesh = new THREE.Group();
            playerMesh.name = player.id;
            playerMesh.add(createPlayerMesh(player as PlayerData));
            const nameTag = new NameTag(player.playerName);
            nameTag.position.y = 2.8;
            playerMesh.add(nameTag);
            playerMeshesGroup.add(playerMesh);
        }
        playerMesh.position.set(player.position.x, player.position.y, player.position.z);
        playerMesh.rotation.y = player.rotation.y;
    });
  }, [players, playerSessionId]);

  const handleExport = () => {
    if (!selectionA || !selectionB || !voxels) return;
    const minX = Math.min(selectionA.x, selectionB.x);
    const minY = Math.min(selectionA.y, selectionB.y);
    const minZ = Math.min(selectionA.z, selectionB.z);
    const maxX = Math.max(selectionA.x, selectionB.x);
    const maxY = minY + 50; 
    const maxZ = Math.max(selectionA.z, selectionB.z);

    const selectionVoxels = voxels.filter(v => 
        v.x >= minX && v.x <= maxX &&
        v.y >= minY && v.y <= maxY &&
        v.z >= minZ && v.z <= maxZ
    ).map(v => ({
        ...v,
        x: v.x - minX,
        y: v.y - minY,
        z: v.z - minZ
    }));

    if (selectionVoxels.length === 0) {
        toast({ title: "Export Failed", description: "No blocks found in selection volume.", variant: "destructive" });
        return;
    }

    exportModelLocally("My Model", selectionVoxels);
    toast({ title: "Model Exported", description: `${selectionVoxels.length} blocks saved from 50-layer volume.` });
  };

  const handleImport = async (file: File) => {
    try {
        const model = await importModelLocally(file);
        setImportedModel(model);
        setSelectionMode(false);
        setGhostNudge({ x: 0, y: 0, z: 0 });
        toast({ title: "Model Loaded", description: `Right-click to place "${model.name}". Press ESC to cancel.` });
    } catch (e) {
        toast({ title: "Import Error", description: "Failed to parse model file.", variant: "destructive" });
    }
  };

  const isFinished = worldData?.gameState?.phase === 'finished';
  const isIsometric = worldData?.gameMode === 'isometric-build';
  const isSandbox = worldData?.gameMode === 'sandbox';

  const handleToggleSimulate = useCallback(() => {
    const mount = mountRef.current;
    if (!mount || !(mount as any).__THREE__) return;
    const { scene } = (mount as any).__THREE__;
    const voxelMeshesGroup = scene.getObjectByName('voxelMeshes') as THREE.Group;
    if (!voxelMeshesGroup) return;

    if (isSimulating) {
      // STOP simulation
      if (physicsFrameRef.current) cancelAnimationFrame(physicsFrameRef.current);
      if (physicsSimRef.current) {
        resetPhysics(physicsSimRef.current, voxelMeshesGroup);
        physicsSimRef.current = null;
      }
      setIsSimulating(false);
    } else {
      // START simulation
      if (!voxels || voxels.length === 0) return;
      const sim = createPhysicsWorld(voxels, getBlock, voxelMeshesGroup);
      physicsSimRef.current = sim;
      setIsSimulating(true);

      let lastTime = performance.now();
      const physicsLoop = () => {
        const now = performance.now();
        const dt = Math.min((now - lastTime) / 1000, 0.05); // cap dt
        lastTime = now;
        stepPhysics(sim, dt);
        physicsFrameRef.current = requestAnimationFrame(physicsLoop);
      };
      physicsFrameRef.current = requestAnimationFrame(physicsLoop);
    }
  }, [isSimulating, voxels, getBlock]);

  if (isLoading) return <Loader />;

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      <div ref={mountRef} className="absolute inset-0" />
      
      {/* HUD OVERLAYS */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <Button variant="secondary" size="icon" className="rounded-full w-10 h-10 bg-black/50 border-2 border-white/20 text-white hover:bg-black/70 backdrop-blur-md" onClick={handleMuteToggle}>
          {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </Button>
        <Button variant="secondary" className="rounded-full bg-black/50 border-2 border-white/20 text-white hover:bg-black/70 backdrop-blur-md font-bold" onClick={() => router.push('/')}>
          <LogOut className="mr-2 h-4 w-4" /> Exit
        </Button>
      </div>

      {/* Phase Start Instructions Modal */}
      <Dialog open={phaseModalOpen} onOpenChange={setPhaseModalOpen}>
        <DialogContent className="max-w-md border-2 border-b-4 border-border shadow-2xl rounded-2xl bg-white">
          <DialogHeader className="items-center text-center">
            {worldData?.gameState?.phase === 'collecting' && (
                <>
                    <div className="w-20 h-20 bg-gradient-to-br from-orange-400 to-orange-500 rounded-3xl flex items-center justify-center mb-3 shadow-lg shadow-orange-500/30">
                        <Sparkles className="w-10 h-10 text-white animate-pulse" />
                    </div>
                    <DialogTitle className="text-3xl font-black uppercase tracking-tight text-orange-600">Phase 1: COLLECT!</DialogTitle>
                    <DialogDescription className="text-base font-semibold text-muted-foreground pt-2">
                        You have <span className="text-orange-600 font-extrabold">{worldData.config?.collectingDuration} seconds</span> to run around and collect bricks from the glowing heaps on the ground!
                        <br/><br/>
                        <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm font-bold inline-block">Max: {worldData?.config?.maxBlocks} bricks</span>
                    </DialogDescription>
                </>
            )}
            {worldData?.gameState?.phase === 'building' && (
                <>
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-blue-500 rounded-3xl flex items-center justify-center mb-3 shadow-lg shadow-blue-500/30">
                        <Hammer className="w-10 h-10 text-white animate-bounce" />
                    </div>
                    <DialogTitle className="text-3xl font-black uppercase tracking-tight text-blue-600">Phase 2: BUILD!</DialogTitle>
                    <DialogDescription className="text-base font-semibold text-muted-foreground pt-2">
                        <span className="bg-blue-100 text-blue-700 px-4 py-2 rounded-2xl text-xl font-extrabold inline-block mb-2">"{worldData?.gameState?.challenge}"</span>
                        <br/>
                        You have <span className="text-blue-600 font-extrabold">{Math.floor((worldData?.config?.buildingDuration || 0) / 60)} minutes</span>. Use ONLY the bricks you collected!
                    </DialogDescription>
                </>
            )}
            {worldData?.gameState?.phase === 'bridging' && (
                <>
                    <div className="w-20 h-20 bg-gradient-to-br from-purple-400 to-purple-600 rounded-3xl flex items-center justify-center mb-3 shadow-lg shadow-purple-500/30">
                        <span className="text-4xl">🌉</span>
                    </div>
                    <DialogTitle className="text-3xl font-black uppercase tracking-tight text-purple-600">Phase 3: BRIDGE TEST!</DialogTitle>
                    <DialogDescription className="text-base font-semibold text-muted-foreground pt-2">
                        A bridge is being placed across your towers!
                        <br/><br/>
                        <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-bold inline-block animate-pulse">⚡ Physics simulation starting {worldData?.gameMode === 'bridge-test' ? 'instantly' : 'in 3 seconds'}...</span>
                    </DialogDescription>
                </>
            )}
          </DialogHeader>
          <DialogFooter className="justify-center sm:justify-center pt-4">
            <Button size="lg" className="w-full font-extrabold text-lg" onClick={() => setPhaseModalOpen(false)}>
                🚀 GOT IT!
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Facilitator Admin Panel (Floating) */}
      {isFacilitator && (
        <div className="absolute top-24 left-4 z-30 pointer-events-auto">
          <div className="bg-black/70 text-white border-2 border-b-4 border-white/20 shadow-2xl w-64 overflow-hidden rounded-2xl backdrop-blur-md">
             <div className="bg-gradient-to-r from-primary to-emerald-400 px-4 py-2.5 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-white" />
                <span className="text-xs font-extrabold text-white uppercase tracking-wider">👑 Facilitator</span>
             </div>
             <div className="p-4 space-y-4">
                <div className="space-y-1">
                   <p className="text-[10px] font-extrabold uppercase tracking-widest text-white/40">Current Phase</p>
                   <p className="text-lg font-extrabold text-primary uppercase">{worldData.gameState?.phase}</p>
                </div>
                
                <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2">
                  <Users className="w-4 h-4 text-primary" />
                  <span className="text-sm font-bold">{players?.length || 0} Connected</span>
                </div>

                <div className="space-y-2 pt-3 border-t border-white/10">
                   {worldData.gameState?.phase === 'waiting' && worldData.gameMode === 'brick-sprint' && (
                     <Button className="w-full bg-gradient-to-r from-primary to-emerald-400 text-white hover:opacity-90 font-extrabold h-11 rounded-xl" onClick={handleStartGame}>
                        <Play className="mr-2 h-4 w-4" /> START ROUND
                     </Button>
                   )}
                   {worldData.gameState?.phase === 'collecting' && (
                     <Button className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:opacity-90 font-extrabold h-11 rounded-xl" onClick={handleNextPhase}>
                        <FastForward className="mr-2 h-4 w-4" /> NEXT PHASE
                     </Button>
                   )}
                   {worldData.gameState?.phase === 'building' && (
                     <>
                       <div className="bg-white/10 rounded-xl p-3 space-y-2">
                          <p className="text-[10px] font-extrabold uppercase tracking-widest text-white/40">🌉 Bridge Model</p>
                          <p className="text-xs text-white/60">{worldData?.gameState?.bridgeModel?.name || 'Default Bridge (built-in)'}</p>
                          <label className="block">
                            <span className="text-xs text-white/50">Upload custom bridge:</span>
                            <input type="file" accept=".rpv2,.json" className="mt-1 w-full text-xs text-white/70 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-white/20 file:text-white hover:file:bg-white/30" onChange={(e) => { if (e.target.files?.[0]) handleUploadBridge(e.target.files[0]); }} disabled={!!worldData?.gameState?.hasBridgeBeenPlaced}/>
                          </label>
                       </div>
                       
                       {worldData?.gameState?.hasBridgeBeenPlaced ? (
                         <Button className="w-full bg-slate-700 text-white hover:bg-slate-600 font-extrabold h-11 rounded-xl" onClick={handleUndoBridge}>
                            ↩ UNDO BRIDGE
                         </Button>
                       ) : (
                         <Button className="w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:opacity-90 font-extrabold h-11 rounded-xl" onClick={handleLoadBridge}>
                            🌉 PLACE BRIDGE
                         </Button>
                       )}
                       
                       {importedModel && (
                         <p className="text-xs text-center text-yellow-300 animate-pulse font-semibold">👆 Right-click on the world to place the bridge, then click "START SIMULATION"</p>
                       )}
                       <Button className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white hover:opacity-90 font-extrabold h-11 rounded-xl" onClick={handleStartBridging} disabled={!worldData?.gameState?.hasBridgeBeenPlaced}>
                          ⚡ START SIMULATION
                       </Button>
                     </>
                   )}
                   {worldData.gameState?.phase === 'bridging' && (
                     <Button className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:opacity-90 font-extrabold h-11 rounded-xl" onClick={handleNextPhase}>
                        <FastForward className="mr-2 h-4 w-4" /> END ROUND
                     </Button>
                   )}
                   <Button variant="outline" className="w-full border-white/20 text-white hover:bg-white/10 h-11 rounded-xl font-bold" onClick={handleResetGame} disabled={isResetting}>
                      <RotateCcw className={cn("mr-2 h-4 w-4", isResetting && "animate-spin")} /> RESTART
                   </Button>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Game Mode Phase UI */}
      {(worldData?.gameMode === 'brick-sprint' || worldData?.gameMode === 'bridge-test') && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 w-full max-w-xl px-4 pointer-events-none">
          <div className="bg-black/70 text-white backdrop-blur-md border-2 border-b-4 border-white/20 shadow-2xl rounded-2xl overflow-hidden">
            <div className="p-4 flex flex-col items-center gap-3">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3 bg-white/10 rounded-xl px-3 py-2">
                   <Timer className={cn("w-6 h-6", timeRemaining && timeRemaining < 10 ? "text-red-500 animate-pulse" : "text-primary")} />
                   <span className="text-3xl font-black font-mono">
                     {timeRemaining !== null ? `${Math.floor(timeRemaining / 60)}:${(timeRemaining % 60).toString().padStart(2, '0')}` : "--:--"}
                   </span>
                </div>
                <div className="flex flex-col items-end">
                   <span className="text-[10px] font-extrabold uppercase tracking-widest text-white/40">Phase</span>
                   <span className="text-lg font-extrabold uppercase text-primary">
                     {worldData.gameState?.phase === 'waiting' && 'Waiting'}
                     {worldData.gameState?.phase === 'collecting' && '⛏️ COLLECTING'}
                     {worldData.gameState?.phase === 'building' && '🔨 BUILDING'}
                     {worldData.gameState?.phase === 'bridging' && '🌉 BRIDGE TEST'}
                     {worldData.gameState?.phase === 'finished' && '🏆 GAME OVER'}
                   </span>
                </div>
              </div>
              
              <div className="w-full bg-white/10 p-3 rounded-xl text-center">
                 <p className="text-sm font-bold">
                   {worldData.gameState?.phase === 'waiting' && (
                        worldData.facilitatorMode 
                        ? 'Wait for the facilitator to start the workshop.'
                        : 'Click "Ready" to begin once everyone is joined!'
                   )}
                   {worldData.gameState?.phase === 'collecting' && (
                     timeRemaining === 0 
                     ? 'Collecting complete! Waiting for build phase.' 
                     : 'Click on the glowing bricks to pick them up!'
                   )}
                   {worldData.gameState?.phase === 'building' && (
                        <span className="flex items-center justify-center gap-2">
                            <Info className="w-4 h-4 text-primary" /> 
                            {timeRemaining === 0 
                              ? 'Building time is up!'
                              : worldData.gameState?.challenge}
                        </span>
                   )}
                   {worldData.gameState?.phase === 'bridging' && (
                     <span className="flex items-center justify-center gap-2">
                       <span className="animate-pulse">⚡</span> Bridge placed! Physics simulation {isSimulating ? 'is running...' : 'starting soon...'}
                     </span>
                   )}
                   {worldData.gameState?.phase === 'finished' && 'Check out the gallery of towers!'}
                 </p>
              </div>

              {worldData.gameState?.phase === 'waiting' && !isFacilitator && (
                <div className="mt-2 pointer-events-auto flex flex-col items-center gap-2">
                    {!worldData.facilitatorMode ? (
                        <Button 
                            className={cn("h-12 px-10 text-lg font-extrabold rounded-full shadow-lg transition-all", 
                                localPlayerData?.isReady ? "bg-gradient-to-r from-green-500 to-green-600 text-white" : "bg-gradient-to-r from-primary to-emerald-400 text-white")} 
                            onClick={handleToggleReady}
                        >
                            {localPlayerData?.isReady ? <CheckCircle2 className="mr-2" /> : <Circle className="mr-2" />}
                            {localPlayerData?.isReady ? "✅ READY!" : "I'M READY"}
                        </Button>
                    ) : (
                        <p className="text-white/60 text-xs italic animate-pulse font-semibold">Waiting for facilitator to start...</p>
                    )}
                    
                    {!worldData.facilitatorMode && (
                        <div className="flex gap-1.5 mt-1">
                           {players?.map(p => (
                               <div key={p.uid} title={p.playerName} className={cn("w-3.5 h-3.5 rounded-full border-2 border-white/20 transition-colors", p.isReady ? "bg-green-500" : "bg-white/20")} />
                           ))}
                        </div>
                    )}
                </div>
              )}

              {worldData.gameState?.phase === 'waiting' && isFacilitator && (
                <Button className="mt-2 pointer-events-auto bg-gradient-to-r from-primary to-emerald-400 text-white hover:opacity-90 font-extrabold px-8 h-12 rounded-full text-lg shadow-lg" onClick={handleStartGame}>
                  <Play className="mr-2 h-5 w-5" /> START BRICK SPRINT
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Finished Gallery Overlay */}
      {isFinished && showResults && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 pointer-events-auto p-8 overflow-auto backdrop-blur-lg">
          <div className="max-w-4xl w-full space-y-8 text-center">
            <div className="space-y-3">
              <div className="w-24 h-24 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-yellow-500/30">
                <Trophy className="w-12 h-12 text-white animate-bounce" />
              </div>
              <h1 className="text-6xl font-black text-white tracking-tighter">TIME'S UP!</h1>
              <p className="text-white/60 text-xl font-bold">Behold the towers of the realm 🏰</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pt-6">
              {players?.filter(p => !p.playerName.includes('(Facilitator)')).map(p => (
                <div key={p.uid} className="bg-white/10 border-2 border-b-4 border-white/15 rounded-2xl p-5 text-left backdrop-blur-sm hover:scale-105 transition-transform cursor-default">
                   <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-full border-2 border-white/30" style={{ backgroundColor: p.color }} />
                      <h3 className="text-xl font-extrabold text-white">{p.playerName}</h3>
                   </div>
                   <div className="space-y-1">
                        <p className="text-white/40 text-[10px] font-extrabold uppercase tracking-widest">Brick Count</p>
                        <p className="text-3xl font-black text-primary">{voxels?.filter(v => v.placedBy === p.uid).length || 0} <span className="text-sm text-white/40 font-bold">blocks</span></p>
                   </div>
                </div>
              ))}
            </div>

            <div className="pt-10 flex items-center justify-center gap-3 flex-wrap">
              <Button variant="outline" size="lg" className="h-14 px-8 text-lg font-extrabold rounded-full border-2 border-white/20 text-white hover:bg-white/10 gap-2" onClick={() => setShowResults(false)}>
                <Eye className="w-5 h-5" /> Spectate
              </Button>
              {isFacilitator && (
                <Button size="lg" className="h-14 px-8 text-lg font-extrabold rounded-full bg-gradient-to-r from-primary to-emerald-400 text-white hover:opacity-90 gap-2 shadow-lg" onClick={handleResetGame} disabled={isResetting}>
                   <RotateCcw className={cn("w-5 h-5", isResetting && "animate-spin")} /> Restart
                </Button>
              )}
              <Button variant="secondary" size="lg" className="h-14 px-8 text-lg font-extrabold rounded-full" onClick={() => router.push('/')}>Exit to Lobby</Button>
            </div>
          </div>
        </div>
      )}

      {/* Show Results Button (Floating) */}
      {isFinished && !showResults && (
        <div className="absolute bottom-24 right-4 z-20">
          <Button variant="secondary" size="lg" className="rounded-full gap-2 shadow-xl border-2 border-primary bg-background/80 backdrop-blur-sm hover:bg-background" onClick={() => setShowResults(true)}>
            <Trophy className="w-5 h-5 text-yellow-500" /> Show Results Gallery
          </Button>
        </div>
      )}

      <Instructions worldId={worldId} isIsometric={isIsometric} isFacilitator={isFacilitator} />
      <EventLog events={eventLog} isChatting={isChatting} onSendMessage={(text) => sendChatMessage(firestore!, worldId, { uid: user!.uid, playerName, text })} onChatStateChange={setIsChatting} />
      
      {!isFacilitator && (
        <Hud 
            allBlocks={allBlocks} 
            selectedBlockId={selectedBlockId} 
            onSelectBlock={setSelectedBlockId} 
            selectedColor={selectedColor} 
            isSelectionMode={isSelectionMode}
            setSelectionMode={setSelectionMode}
            onExport={handleExport}
            onImport={handleImport}
            hasSelection={!!selectionA && !!selectionB}
            isPlacingImport={!!importedModel}
            onOpenController={() => setControllerModalOpen(true)}
            inventory={localPlayerData?.inventory}
            maxBlocks={worldData?.config?.maxBlocks}
            isSandbox={isSandbox}
            isSimulating={isSimulating}
            onToggleSimulate={handleToggleSimulate}
        />
      )}
      
      <InventoryModal allBlocks={allBlocks} onSelectBlock={setSelectedBlockId} isOpen={isInventoryOpen} onOpenChange={setInventoryOpen} />
      <ColorPickerModal isOpen={isColorPickerOpen} onOpenChange={setColorPickerOpen} selectedColor={selectedColor} onColorSelect={setSelectedColor} />
      <ControllerModal isOpen={isControllerModalOpen} onOpenChange={setControllerModalOpen} worldId={worldId} playerId={playerSessionId} />
    </div>
  );
}
