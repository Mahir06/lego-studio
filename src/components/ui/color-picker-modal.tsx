
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { colorPresets } from '@/lib/colors';
import { cn } from '@/lib/utils';
import { Paintbrush } from 'lucide-react';

interface ColorPickerModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  selectedColor: string;
  onColorSelect: (color: string) => void;
}

export function ColorPickerModal({ isOpen, onOpenChange, selectedColor, onColorSelect }: ColorPickerModalProps) {
  const [customColor, setCustomColor] = useState(selectedColor);

  const handlePresetSelect = (color: string) => {
    onColorSelect(color);
    onOpenChange(false);
  };
  
  const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomColor(e.target.value);
  };

  const handleCustomColorApply = () => {
    onColorSelect(customColor);
    onOpenChange(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[60vh] flex flex-col p-0 border-2 border-b-4 border-border shadow-2xl rounded-2xl bg-background">
        <DialogHeader className="p-6 pb-3">
          <DialogTitle className="text-2xl font-extrabold text-foreground flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-pink-400 to-purple-500 rounded-2xl flex items-center justify-center shadow-md">
              <Paintbrush className="w-5 h-5 text-white"/>
            </div>
            Choose a Color
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-grow px-6">
            <p className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground mb-3">🎨 Presets</p>
            <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 gap-3">
                {colorPresets.map((preset) => (
                <button
                    key={preset.name}
                    title={preset.name}
                    className={cn(
                        'w-full aspect-square rounded-xl border-2 transition-all duration-150 hover:scale-110 hover:z-10 hover:shadow-lg',
                        selectedColor.toLowerCase() === preset.hex.toLowerCase()
                            ? 'border-primary ring-2 ring-primary ring-offset-2 scale-110'
                            : 'border-border'
                    )}
                    style={{ backgroundColor: preset.hex }}
                    onClick={() => handlePresetSelect(preset.hex)}
                />
                ))}
            </div>
        </ScrollArea>
        <DialogFooter className="bg-muted/50 p-5 flex-col sm:flex-row gap-3 rounded-b-2xl border-t-2 border-border">
            <div className="flex-grow flex items-center gap-3">
                <label htmlFor="custom-color" className="text-sm font-extrabold text-foreground shrink-0">Custom</label>
                <div className="relative w-full">
                    <Input
                        id="custom-color"
                        type="text"
                        value={customColor}
                        onChange={handleCustomColorChange}
                        className="pl-12"
                    />
                    <Input
                        type="color"
                        value={customColor}
                        onChange={handleCustomColorChange}
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 p-0 border-none cursor-pointer bg-transparent"
                    />
                </div>
            </div>
            <Button onClick={handleCustomColorApply} className="h-12 px-6 font-extrabold text-base">
                Apply Color
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
