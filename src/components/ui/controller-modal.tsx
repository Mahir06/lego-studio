'use client';

import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Smartphone, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ControllerModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  worldId: string;
  playerId: string;
}

export function ControllerModal({ isOpen, onOpenChange, worldId, playerId }: ControllerModalProps) {
  const [origin, setOrigin] = React.useState('');

  React.useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const controllerUrl = `${origin}/world/${worldId}/controller?pid=${playerId}`;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-4 border-stone-200 shadow-2xl rounded-2xl bg-background/95 backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <Smartphone className="w-8 h-8 text-primary" />
            Connect Controller
          </DialogTitle>
          <DialogDescription>
            Scan this QR code with your phone to use it as a remote controller for your character.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center justify-center p-6 space-y-6">
          <div className="p-4 bg-white rounded-xl shadow-inner border-2 border-stone-100">
            {origin && (
              <QRCodeSVG
                value={controllerUrl}
                size={200}
                level="H"
                includeMargin={true}
              />
            )}
          </div>
          <div className="w-full space-y-2">
            <p className="text-xs text-center text-muted-foreground break-all bg-muted p-2 rounded border border-border">
              {controllerUrl}
            </p>
            <Button
              variant="outline"
              className="w-full gap-2 rounded-xl"
              onClick={() => window.open(controllerUrl, '_blank')}
            >
              <ExternalLink className="w-4 h-4" /> Open in New Tab (Demo)
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
