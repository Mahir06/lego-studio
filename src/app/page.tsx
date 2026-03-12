'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { initiateAnonymousSignIn } from '@/firebase/non-blocking-login';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader } from '@/components/ui/loader';
import { createWorld, GameMode } from '@/services/world-service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Cuboid, User, Timer, Globe, Layers, Puzzle, Zap, Boxes, ShieldCheck, Settings2, ArrowLeft, Sparkles, Trophy, Rocket } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { v4 as uuidv4 } from 'uuid';

const GAME_MODES: { id: GameMode; title: string; description: string; icon: any; color: string; bgColor: string; borderColor: string; disabled?: boolean }[] = [
  { id: 'brick-sprint', title: 'Brick Sprint', description: 'Collect bricks, then build a tall tower against the clock!', icon: Timer, color: 'text-orange-600', bgColor: 'bg-orange-100', borderColor: 'border-orange-300' },
  { id: 'sandbox', title: 'Free Build', description: 'No limits, just pure creative freedom with friends.', icon: Globe, color: 'text-blue-600', bgColor: 'bg-blue-100', borderColor: 'border-blue-300' },
  { id: 'isometric-build', title: 'Isometric Build', description: 'Build from a classic top-down isometric perspective.', icon: Layers, color: 'text-cyan-600', bgColor: 'bg-cyan-100', borderColor: 'border-cyan-300' },
  { id: 'puzzle-path', title: 'Puzzle Path', description: 'Build bridges and paths to solve platforming puzzles.', icon: Puzzle, color: 'text-green-600', bgColor: 'bg-green-100', borderColor: 'border-green-300', disabled: true },
  { id: 'speed-builder', title: 'Speed Builder', description: 'Replicate the model as fast as you can.', icon: Zap, color: 'text-yellow-600', bgColor: 'bg-yellow-100', borderColor: 'border-yellow-300', disabled: true },
  { id: 'tower-defense', title: 'Tower Defense', description: 'Build defenses to stop the incoming voxels.', icon: Boxes, color: 'text-purple-600', bgColor: 'bg-purple-100', borderColor: 'border-purple-300', disabled: true },
];

export default function LobbyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [worldIdInput, setWorldIdInput] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [selectedMode, setSelectedMode] = useState<GameMode | null>(null);
  const [showModes, setShowModes] = useState(false);
  
  // Facilitator Settings
  const [isFacilitator, setIsFacilitator] = useState(false);
  const [customMaxBlocks, setCustomMaxBlocks] = useState(25);
  const [customCollectDuration, setCustomCollectDuration] = useState(60);
  const [customBuildDuration, setCustomBuildDuration] = useState(180);
  
  const { auth, firestore, user, isUserLoading } = useFirebase();

  useEffect(() => {
    if (!isUserLoading && !user) {
      initiateAnonymousSignIn(auth);
    }
    const savedName = localStorage.getItem('remote-play-player-name');
    if (savedName) {
      setPlayerName(savedName);
    }
  }, [isUserLoading, user, auth]);

  const handlePlayerNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setPlayerName(newName);
    localStorage.setItem('remote-play-player-name', newName);
  }

  const handleCreateWorld = async () => {
    if (!firestore || !auth || !playerName.trim() || !selectedMode) return;
    setLoading(true);
    try {
      let sessionId = sessionStorage.getItem('remote-play-session-id');
      if (!sessionId) {
        sessionId = uuidv4();
        sessionStorage.setItem('remote-play-session-id', sessionId);
      }

      const newWorldId = await createWorld(firestore, auth, selectedMode, isFacilitator, {
        maxBlocks: customMaxBlocks,
        collectingDuration: customCollectDuration,
        buildingDuration: customBuildDuration
      }, sessionId);

      router.push(`/world/${newWorldId}?playerName=${encodeURIComponent(playerName.trim())}&pid=${sessionId}`);
    } catch (error) {
      console.error("Error creating world:", error);
      setLoading(false);
    }
  };

  const handleJoinWorld = () => {
    if (worldIdInput.trim() && playerName.trim()) {
      setLoading(true);
      let sessionId = sessionStorage.getItem('remote-play-session-id');
      if (!sessionId) {
        sessionId = uuidv4();
        sessionStorage.setItem('remote-play-session-id', sessionId);
      }
      router.push(`/world/${worldIdInput.trim()}?playerName=${encodeURIComponent(playerName.trim())}&pid=${sessionId}`);
    }
  };
  
  if (isUserLoading || !user) {
    return <Loader message="Connecting..." />;
  }

  if (loading) {
    return <Loader message="Entering world..." />;
  }

  const isNameMissing = !playerName.trim();

  // ──────────────────────────────────────────
  // GAME MODE SELECTOR VIEW
  // ──────────────────────────────────────────
  if (showModes) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-sky-50 relative overflow-hidden">
        {/* Decorative floating shapes */}
        <div className="absolute top-10 left-10 w-20 h-20 bg-primary/10 rounded-full blur-xl animate-pulse" />
        <div className="absolute bottom-20 right-20 w-32 h-32 bg-secondary/10 rounded-full blur-xl animate-pulse delay-700" />
        <div className="absolute top-1/3 right-10 w-16 h-16 bg-accent/10 rounded-full blur-xl animate-pulse delay-300" />
        
        <div className="relative z-10 max-w-6xl mx-auto px-6 py-12">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-accent/20 text-accent-foreground px-4 py-1.5 rounded-full text-sm font-bold mb-4">
              <Sparkles className="w-4 h-4" /> Pick your adventure
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-foreground">Choose Your Game Mode</h1>
            <p className="text-muted-foreground mt-2 text-lg">Select how you want to play in your new world.</p>
          </div>
          
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Game Mode Grid */}
            <div className="flex-grow grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {GAME_MODES.map((mode) => (
                <button
                  key={mode.id} 
                  className={cn(
                    "text-left rounded-2xl border-2 border-b-4 p-5 transition-all duration-200 hover:scale-[1.03] hover:shadow-lg bg-white relative group",
                    selectedMode === mode.id ? `border-primary bg-primary/5 shadow-lg scale-[1.03]` : `${mode.borderColor} hover:border-primary/50`,
                    mode.disabled && "opacity-50 cursor-not-allowed grayscale pointer-events-none"
                  )}
                  onClick={() => !mode.disabled && setSelectedMode(mode.id)}
                  disabled={mode.disabled}
                >
                  <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110 group-hover:rotate-3", mode.bgColor)}>
                    <mode.icon className={cn("w-7 h-7", mode.color)} />
                  </div>
                  <h3 className="text-lg font-extrabold text-foreground">{mode.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{mode.description}</p>
                  {selectedMode === mode.id && (
                    <div className="absolute top-3 right-3 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    </div>
                  )}
                  {mode.disabled && (
                    <div className="absolute top-3 right-3">
                      <span className="bg-foreground/80 text-white text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-widest">Soon</span>
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* Facilitator Side Panel */}
            <div className="w-full lg:w-80 shrink-0">
              <div className="rounded-2xl border-2 border-b-4 border-border bg-white overflow-hidden">
                <div className="bg-gradient-to-r from-accent/20 to-accent/5 px-5 py-4 border-b-2 border-border">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-8 h-8 rounded-xl bg-accent/30 flex items-center justify-center">
                      <ShieldCheck className="w-5 h-5 text-accent-foreground" />
                    </div>
                    <h3 className="text-lg font-extrabold">Facilitator Mode</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">Conduct workshops and set custom rules.</p>
                </div>
                <div className="p-5 space-y-5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="facilitator-toggle" className="font-bold text-base">Enable Facilitator</Label>
                    <Switch 
                      id="facilitator-toggle" 
                      checked={isFacilitator} 
                      onCheckedChange={setIsFacilitator} 
                    />
                  </div>
                  
                  {isFacilitator && (
                    <div className="space-y-4 pt-4 border-t-2 border-border animate-in fade-in slide-in-from-top-2">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        <Settings2 className="w-3 h-3" /> Advanced Rules
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold">Max Bricks per Player</Label>
                        <Input type="number" value={customMaxBlocks} onChange={e => setCustomMaxBlocks(Number(e.target.value))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold">Collect Phase (sec)</Label>
                        <Input type="number" value={customCollectDuration} onChange={e => setCustomCollectDuration(Number(e.target.value))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold">Build Phase (sec)</Label>
                        <Input type="number" value={customBuildDuration} onChange={e => setCustomBuildDuration(Number(e.target.value))} />
                      </div>
                      <div className="bg-muted rounded-xl p-3 border-2 border-border">
                        <p className="text-xs text-muted-foreground font-semibold">
                          ⚠️ Facilitators can spectate but cannot build blocks.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="flex justify-between items-center pt-10 mt-10 border-t-2 border-border">
            <Button variant="ghost" onClick={() => setShowModes(false)} className="gap-2 text-base">
              <ArrowLeft className="w-5 h-5" /> Back to Lobby
            </Button>
            <Button size="lg" disabled={!selectedMode} onClick={handleCreateWorld} className="gap-2 text-lg px-8">
              <Rocket className="w-5 h-5" /> Create World
            </Button>
          </div>
        </div>
      </main>
    );
  }

  // ──────────────────────────────────────────
  // LOBBY / LANDING VIEW
  // ──────────────────────────────────────────
  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-sky-50 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative background shapes */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-primary/10 rounded-full blur-2xl" />
        <div className="absolute -bottom-20 -right-10 w-56 h-56 bg-secondary/10 rounded-full blur-2xl" />
        <div className="absolute top-1/4 right-1/4 w-24 h-24 bg-accent/10 rounded-full blur-2xl" />
        <div className="absolute bottom-1/3 left-1/4 w-20 h-20 bg-destructive/5 rounded-full blur-2xl" />
      </div>

      <div className="relative z-10 w-full max-w-md space-y-6">
        {/* Hero Section */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-primary to-emerald-400 rounded-3xl shadow-lg shadow-primary/30 mb-2 mx-auto">
            <Cuboid className="w-14 h-14 text-white" />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-foreground">Remote Play</h1>
          <div className="inline-flex items-center gap-1.5 bg-accent/20 text-accent-foreground px-3 py-1 rounded-full text-xs font-bold">
            <Sparkles className="w-3 h-3" /> v3 — Brick Sprint, Sandbox & More!
          </div>
        </div>

        {/* Main Card */}
        <div className="rounded-2xl border-2 border-b-4 border-border bg-white shadow-xl p-6 space-y-5">
          {/* Name Input */}
          <div className="space-y-2">
            <label htmlFor="playerName" className="text-sm font-bold text-foreground flex items-center gap-2">
              <User className="w-4 h-4 text-primary" /> Your Name
            </label>
            <Input
              id="playerName"
              type="text"
              value={playerName}
              onChange={handlePlayerNameChange}
              placeholder="Enter your name..."
              className="text-lg"
            />
          </div>

          {/* Play Button */}
          <Button onClick={() => setShowModes(true)} className="w-full h-14 text-lg gap-2" disabled={loading || isNameMissing}>
            <Trophy className="w-5 h-5" /> Play / Create World
          </Button>
          <p className="text-center text-xs text-muted-foreground font-semibold">Choose a game mode and start building.</p>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <hr className="flex-grow border-border border-t-2" />
            <span className="text-muted-foreground text-xs font-bold uppercase tracking-widest">or</span>
            <hr className="flex-grow border-border border-t-2" />
          </div>

          {/* Join Section */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                type="text"
                value={worldIdInput}
                onChange={(e) => setWorldIdInput(e.target.value)}
                placeholder="Enter World ID..."
                className="text-lg"
                disabled={loading}
              />
              <Button onClick={handleJoinWorld} className="shrink-0" disabled={loading || isNameMissing || !worldIdInput.trim()}>Join</Button>
            </div>
            <p className="text-center text-xs text-muted-foreground font-semibold">Join a friend's world with their ID.</p>
          </div>
        </div>

        {/* Error Banner */}
        {isNameMissing && (
          <div className="rounded-2xl border-2 border-b-4 border-destructive/30 bg-destructive/10 p-4 text-center">
            <p className="text-destructive text-sm font-bold">⚠️ Please enter a name to join or create a world.</p>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground font-semibold opacity-60">
          Built with ❤️ for LEGO At Play
        </p>
      </div>
    </main>
  );
}
