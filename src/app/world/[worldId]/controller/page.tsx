
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { initiateAnonymousSignIn } from '@/firebase/non-blocking-login';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Loader } from '@/components/ui/loader';
import { Smartphone, MousePointer2, Box, RotateCw } from 'lucide-react';

export default function ControllerPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { auth, firestore, user, isUserLoading } = useFirebase();

  const worldId = Array.isArray(params.worldId) ? params.worldId[0] : params.worldId;
  const playerId = searchParams.get('pid');

  const [inputState, setInputState] = useState({
    move: { x: 0, y: 0 },
    look: { x: 0, y: 0 },
    jump: false,
    actionA: false,
    actionB: false,
  });

  const lastUpdateRef = useRef(0);
  const prevStateRef = useRef(inputState);
  
  // Joystick Refs
  const joystickBaseRef = useRef<HTMLDivElement>(null);
  const lookAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isUserLoading && !user) {
      initiateAnonymousSignIn(auth);
    }
  }, [isUserLoading, user, auth]);

  const syncInput = useCallback((newState: typeof inputState, force: boolean = false) => {
    if (!firestore || !worldId || !playerId || !user) return;

    const now = Date.now();
    if (!force && now - lastUpdateRef.current < 50) return; 
    
    lastUpdateRef.current = now;

    const controllerRef = doc(firestore, 'worlds', worldId, 'controllers', playerId);
    setDocumentNonBlocking(controllerRef, {
      ...newState,
      lastUpdated: now,
    }, { merge: true });
  }, [firestore, worldId, playerId, user]);

  useEffect(() => {
    const hasChanged = 
      inputState.jump !== prevStateRef.current.jump ||
      inputState.actionA !== prevStateRef.current.actionA ||
      inputState.actionB !== prevStateRef.current.actionB ||
      inputState.move.x !== prevStateRef.current.move.x ||
      inputState.move.y !== prevStateRef.current.move.y ||
      inputState.look.x !== prevStateRef.current.look.x ||
      inputState.look.y !== prevStateRef.current.look.y;

    if (hasChanged) {
      syncInput(inputState, true);
      prevStateRef.current = inputState;
    }
  }, [inputState, syncInput]);

  const handleJoystickTouch = (e: React.TouchEvent) => {
    if (!joystickBaseRef.current) return;
    const touch = e.touches[0];
    const rect = joystickBaseRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = touch.clientX - centerX;
    const dy = touch.clientY - centerY;
    const distance = Math.min(Math.sqrt(dx * dx + dy * dy), rect.width / 2);
    const angle = Math.atan2(dy, dx);
    
    const x = (Math.cos(angle) * distance) / (rect.width / 2);
    const y = -(Math.sin(angle) * distance) / (rect.height / 2);
    
    setInputState(prev => ({ ...prev, move: { x, y } }));
  };

  const handleLookTouch = (e: React.TouchEvent) => {
    if (!lookAreaRef.current) return;
    const touch = e.touches[0];
    const rect = lookAreaRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = touch.clientX - centerX;
    const dy = touch.clientY - centerY;
    
    const x = dx / (rect.width / 2);
    const y = -dy / (rect.height / 2);
    
    setInputState(prev => ({ ...prev, look: { x, y } }));
  };

  if (isUserLoading || !user) return <Loader message="Connecting Controller..." />;
  if (!worldId || !playerId) return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-sky-50 flex items-center justify-center p-8">
      <div className="rounded-2xl border-2 border-b-4 border-destructive/30 bg-white p-8 text-center shadow-lg">
        <p className="text-xl font-extrabold text-destructive">Invalid Controller Link</p>
        <p className="text-sm text-muted-foreground mt-2 font-semibold">Please scan the QR code from the game again.</p>
      </div>
    </div>
  );

  return (
    <main className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 flex items-center justify-between p-4 select-none overflow-hidden touch-none text-white">
      
      {/* Landscape Warning */}
      <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center p-8 text-center sm:hidden landscape:hidden">
        <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mb-4">
          <RotateCw className="w-8 h-8 text-primary animate-spin" style={{ animationDuration: '3s' }} />
        </div>
        <h2 className="text-2xl font-extrabold">Rotate Your Phone</h2>
        <p className="text-slate-400 mt-2 font-semibold">Landscape mode is required for the controller.</p>
      </div>

      {/* Left: Movement Joystick */}
      <div className="w-1/3 h-full flex items-center justify-center">
        <div 
          ref={joystickBaseRef}
          className="w-48 h-48 rounded-full bg-slate-800/60 border-4 border-slate-700 flex items-center justify-center relative shadow-inner"
          onTouchMove={handleJoystickTouch}
          onTouchEnd={() => setInputState(prev => ({ ...prev, move: { x: 0, y: 0 } }))}
        >
          <div 
            className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-emerald-400 shadow-2xl shadow-primary/30 absolute pointer-events-none transition-transform duration-75"
            style={{ 
              transform: `translate(${inputState.move.x * 60}px, ${-inputState.move.y * 60}px)` 
            }}
          />
          <div className="text-[10px] font-black uppercase text-slate-500 pointer-events-none tracking-widest">Move</div>
        </div>
      </div>

      {/* Center: Jump & Info */}
      <div className="flex flex-col items-center justify-center gap-6">
        <div className="flex flex-col items-center gap-1 opacity-40">
           <Smartphone className="w-5 h-5" />
           <span className="text-[8px] font-extrabold tracking-[0.2em] uppercase">Remote Play</span>
        </div>

        <Button 
          className="w-32 h-20 rounded-2xl bg-slate-800 hover:bg-slate-700 active:bg-primary border-2 border-b-4 border-slate-600 active:translate-y-1 active:border-b-0 transition-all"
          onTouchStart={(e) => { e.preventDefault(); setInputState(p => ({ ...p, jump: true })); }}
          onTouchEnd={(e) => { e.preventDefault(); setInputState(p => ({ ...p, jump: false })); }}
        >
          <span className="font-black text-xl">JUMP</span>
        </Button>
      </div>

      {/* Right: Look Swipe Area & Action Buttons */}
      <div className="w-2/5 h-full flex flex-col items-end justify-between py-4">
        
        {/* Actions Row */}
        <div className="flex gap-4 mb-4">
          <Button 
            className="w-24 h-24 rounded-full bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 active:scale-95 flex flex-col items-center justify-center gap-1 shadow-2xl border-b-4 border-red-800"
            onTouchStart={(e) => { e.preventDefault(); setInputState(p => ({ ...p, actionA: true })); }}
            onTouchEnd={(e) => { e.preventDefault(); setInputState(p => ({ ...p, actionA: false })); }}
          >
            <Box className="w-8 h-8" />
            <span className="text-[10px] font-extrabold tracking-wider">BREAK</span>
          </Button>

          <Button 
            className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 active:scale-95 flex flex-col items-center justify-center gap-1 shadow-2xl border-b-4 border-blue-800"
            onTouchStart={(e) => { e.preventDefault(); setInputState(p => ({ ...p, actionB: true })); }}
            onTouchEnd={(e) => { e.preventDefault(); setInputState(p => ({ ...p, actionB: false })); }}
          >
            <MousePointer2 className="w-8 h-8" />
            <span className="text-[10px] font-extrabold tracking-wider">PLACE</span>
          </Button>
        </div>

        {/* Swipe-to-Look Area */}
        <div 
          ref={lookAreaRef}
          className="w-full flex-grow bg-slate-800/30 border-2 border-b-4 border-slate-700 rounded-3xl flex items-center justify-center relative group"
          onTouchMove={handleLookTouch}
          onTouchEnd={() => setInputState(prev => ({ ...prev, look: { x: 0, y: 0 } }))}
        >
          <div className="text-[10px] font-extrabold uppercase text-slate-600 pointer-events-none flex flex-col items-center gap-2 tracking-widest">
            <div className="flex gap-2">
               <div className="w-1.5 h-1.5 rounded-full bg-slate-600 animate-ping" />
               <div className="w-1.5 h-1.5 rounded-full bg-slate-600 animate-ping" style={{ animationDelay: '150ms' }} />
            </div>
            Look Swipe
          </div>
          {(inputState.look.x !== 0 || inputState.look.y !== 0) && (
             <div 
               className="absolute w-8 h-8 rounded-full border-2 border-primary/40 bg-primary/10 pointer-events-none"
               style={{ 
                 transform: `translate(${inputState.look.x * 80}px, ${-inputState.look.y * 80}px)` 
               }}
             />
          )}
        </div>
      </div>

    </main>
  );
}
