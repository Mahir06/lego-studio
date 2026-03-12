
'use client';

import { useEffect, useRef, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { ChatMessage } from '@/lib/voxel-types';
import { Input } from './input';
import { MessageCircle } from 'lucide-react';

interface EventLogProps {
  events: ChatMessage[];
  className?: string;
  isChatting: boolean;
  onSendMessage: (message: string) => void;
  onChatStateChange: (isChatting: boolean) => void;
}

export function EventLog({ events, className, isChatting, onSendMessage, onChatStateChange }: EventLogProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');


  useEffect(() => {
    const scrollEl = (scrollAreaRef.current?.childNodes[0] as HTMLElement);
    if (scrollEl) {
        // Scroll to bottom if user is already near the bottom
        const isScrolledToBottom = scrollEl.scrollHeight - scrollEl.clientHeight <= scrollEl.scrollTop + 100;
        if (isScrolledToBottom) {
            scrollEl.scrollTop = scrollEl.scrollHeight;
        }
    }
  }, [events]);

  useEffect(() => {
    if (isChatting) {
      inputRef.current?.focus();
    }
  }, [isChatting]);

  const handleSend = () => {
    if (message.trim()) {
      onSendMessage(message);
    }
    setMessage('');
    onChatStateChange(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setMessage('');
      onChatStateChange(false);
    }
  };

  return (
    <div
      className={cn(
        'absolute top-24 right-4 w-96 max-w-[40vw] h-[40vh] bg-black/60 text-white rounded-2xl backdrop-blur-md flex flex-col border border-white/10 overflow-hidden',
        className
      )}
    >
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10 bg-white/5">
        <MessageCircle className="w-4 h-4 text-primary" />
        <h2 className="text-xs font-extrabold uppercase tracking-widest text-white/70">World Log</h2>
      </div>
      <ScrollArea className="flex-grow px-2" ref={scrollAreaRef}>
        <div className="flex flex-col gap-1.5 p-2">
          {events.map((event) => (
            <div key={event.id}>
              {event.isEvent ? (
                <p className="text-white/40 italic text-xs font-semibold">
                  {event.text}
                </p>
              ) : (
                <p className="text-sm">
                  <span className="font-extrabold text-primary mr-1">{event.playerName}:</span>{event.text}
                </p>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
      {isChatting && (
        <div className="p-2 border-t border-white/10 bg-white/5">
            <Input
              ref={inputRef}
              type="text"
              placeholder="Press Enter to send..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-9 bg-black/50 text-white border-white/20 placeholder:text-white/40 text-sm rounded-xl"
            />
        </div>
      )}
    </div>
  );
}
