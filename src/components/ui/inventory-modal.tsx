'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LoadedBlock } from '@/lib/voxel-types';
import { Blocks } from 'lucide-react';
import { BlockPreview } from './block-preview';

interface InventoryModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  allBlocks: LoadedBlock[];
  onSelectBlock: (id: number) => void;
}

export function InventoryModal({ isOpen, onOpenChange, allBlocks, onSelectBlock }: InventoryModalProps) {
  const handleBlockSelect = (id: number) => {
    onSelectBlock(id);
    onOpenChange(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[75vh] flex flex-col p-0 border-2 border-b-4 border-border shadow-2xl rounded-2xl bg-background">
        <DialogHeader className="p-6 pb-3">
          <DialogTitle className="text-2xl font-extrabold text-foreground flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-2xl flex items-center justify-center shadow-md">
              <Blocks className="w-5 h-5 text-white"/>
            </div>
            Block Inventory
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-grow px-6">
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4 py-4">
            {allBlocks.map((block) => (
              <div key={block.id} className="flex flex-col items-center gap-2 group">
                <Button
                  variant="outline"
                  className="w-24 h-24 flex items-center justify-center p-2 relative bg-card rounded-2xl border-2 border-b-4 border-border hover:border-primary hover:shadow-lg transition-all group-hover:scale-105"
                  onClick={() => handleBlockSelect(block.id)}
                >
                  <div className="flex items-center justify-center w-full h-full">
                     <BlockPreview block={block} />
                  </div>
                </Button>
                <p className="text-xs text-center truncate w-full text-muted-foreground font-bold">{block.name}</p>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
