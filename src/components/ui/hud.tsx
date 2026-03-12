'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { LoadedBlock } from '@/lib/voxel-types';
import { Button } from '@/components/ui/button';
import { BlockPreview } from './block-preview';
import { MousePointer2, Download, Upload, Box, Ghost, Smartphone, Backpack, FlaskConical, Square } from 'lucide-react';

interface HudProps {
  allBlocks: LoadedBlock[];
  selectedBlockId: number;
  onSelectBlock: (id: number) => void;
  selectedColor: string;
  isSelectionMode?: boolean;
  setSelectionMode?: (mode: boolean) => void;
  onExport?: () => void;
  onImport?: (file: File) => void;
  hasSelection?: boolean;
  isPlacingImport?: boolean;
  onOpenController?: () => void;
  inventory?: number[];
  maxBlocks?: number;
  isSandbox?: boolean;
  isSimulating?: boolean;
  onToggleSimulate?: () => void;
}

const Crosshair = () => (
  <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
    <div className="h-0.5 w-6 bg-white/75 rounded-full"></div>
    <div className="absolute h-6 w-0.5 bg-white/75 rounded-full"></div>
  </div>
);

export function Hud({ 
  allBlocks, 
  selectedBlockId, 
  onSelectBlock, 
  selectedColor, 
  isSelectionMode, 
  setSelectionMode, 
  onExport, 
  onImport, 
  hasSelection, 
  isPlacingImport,
  onOpenController,
  inventory,
  maxBlocks = 25,
  isSandbox = false,
  isSimulating = false,
  onToggleSimulate
}: HudProps) {
  const quickSelectBlocks = allBlocks.slice(0, 9);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = parseInt(event.key);
      if (!isNaN(key) && key >= 1 && key <= quickSelectBlocks.length) {
        const block = quickSelectBlocks[key - 1];
        if (block) {
          onSelectBlock(block.id);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSelectBlock, quickSelectBlocks]);

  // Inventory count display
  const inventoryCounts = inventory ? inventory.reduce((acc, id) => {
    acc[id] = (acc[id] || 0) + 1;
    return acc;
  }, {} as Record<number, number>) : null;

  return (
    <>
      <Crosshair />
      <div className="pointer-events-none fixed bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
        
        {/* Special Status Banner */}
        {isSelectionMode && (
          <div className="bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg animate-bounce flex items-center gap-2">
            <MousePointer2 className="w-4 h-4" /> SELECTION MODE: Left Click = A, Right Click = B
          </div>
        )}
        {isPlacingImport && (
          <div className="bg-purple-600 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg animate-pulse flex items-center gap-2">
            <Ghost className="w-4 h-4" /> STAMP MODE: Right Click to place model
          </div>
        )}

        {/* Toolbar */}
        <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-card/80 px-4 py-2 backdrop-blur-md shadow-xl border-2 border-b-4 border-white/30">
            <Button 
                variant={isSelectionMode ? "default" : "secondary"} 
                size="sm" 
                className="rounded-full gap-2"
                onClick={() => setSelectionMode?.(!isSelectionMode)}
            >
                <Box className="w-4 h-4" /> {isSelectionMode ? "Stop Selecting" : "Select Region"}
            </Button>
            
            {isSelectionMode && hasSelection && (
                <Button variant="outline" size="sm" className="rounded-full bg-green-600 text-white hover:bg-green-700 gap-2" onClick={onExport}>
                    <Download className="w-4 h-4" /> Export Model
                </Button>
            )}

            <Button variant="secondary" size="sm" className="rounded-full gap-2" onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-4 h-4" /> Import Model
            </Button>
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".rpv2,.json" 
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onImport?.(file);
                }}
            />

            <Button variant="secondary" size="sm" className="rounded-full gap-2 text-primary hover:bg-primary hover:text-white" onClick={onOpenController}>
                <Smartphone className="w-4 h-4" /> Connect Phone
            </Button>
            
            <div className="w-px h-6 bg-white/20 mx-2" />

            <Button 
                variant={isSimulating ? "default" : "secondary"} 
                size="sm" 
                className={cn("rounded-full gap-2", isSimulating && "bg-orange-500 hover:bg-orange-600 text-white animate-pulse")}
                onClick={onToggleSimulate}
            >
                {isSimulating ? <Square className="w-4 h-4" /> : <FlaskConical className="w-4 h-4" />}
                {isSimulating ? "Stop" : "Simulate"}
            </Button>
            
            <div className="w-px h-6 bg-white/20 mx-2" />
            
            <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full border-2 border-white shadow-inner" style={{ backgroundColor: selectedColor }} />
                <p className="text-white/80 text-xs font-bold uppercase tracking-wider hidden sm:block">Color</p>
            </div>
        </div>

        {/* Hotbar */}
        <div className="pointer-events-auto flex flex-col items-center gap-2">
          {inventory && !isSandbox && (
            <div className="flex items-center gap-2 bg-black/60 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/10">
              <Backpack className="w-3 h-3 text-primary" /> 
              Your Bricks: {inventory.length} / {maxBlocks}
            </div>
          )}
          <div className="flex items-center justify-center gap-2 rounded-2xl bg-card/70 p-2 backdrop-blur-md shadow-2xl border-2 border-b-4 border-white/20">
            {quickSelectBlocks.map((block, index) => {
              const count = inventoryCounts ? inventoryCounts[block.id] || 0 : null;
              const isDisabled = !isSandbox && inventory !== undefined && count === 0;

              return (
                <Button
                  key={block.id}
                  variant="outline"
                  size="icon"
                  className={cn(
                    'h-14 w-14 transition-all duration-200 relative p-1',
                    selectedBlockId === block.id ? 'border-4 border-primary bg-primary/20 scale-110 shadow-[0_0_15px_rgba(var(--primary),0.5)]' : 'border-2 border-border bg-card/80',
                    isDisabled && 'opacity-20 grayscale'
                  )}
                  onClick={() => onSelectBlock(block.id)}
                  aria-label={`Select ${block.name} block`}
                  disabled={isDisabled}
                >
                  <BlockPreview block={block} />
                  <span className="absolute top-0.5 right-1.5 text-[10px] font-black text-white/50">{index + 1}</span>
                  {!isSandbox && count !== null && count > 0 && (
                    <span className="absolute bottom-0.5 left-0.5 bg-primary text-black text-[8px] font-black px-1 rounded-sm">
                      x{count}
                    </span>
                  )}
                </Button>
              );
            })}
          </div>
        </div>
         <p className="text-white/50 text-[10px] font-bold uppercase tracking-[0.2em]">Press 'I' for Inventory • 'C' for Colors</p>
      </div>
    </>
  );
}
