'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  onChatStateChange: (isChatting: boolean) => void;
}

export function ChatInput({ onSendMessage, onChatStateChange }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onChatStateChange(true);
    inputRef.current?.focus();
    
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            closeChat();
        }
    };
    
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      onChatStateChange(false);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onChatStateChange]);

  const closeChat = () => {
    setMessage('');
    onChatStateChange(false);
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      onSendMessage(message);
    }
    closeChat();
  };

  return (
    <div className="absolute bottom-24 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4">
      <form onSubmit={handleSubmit}>
        <Input
          ref={inputRef}
          type="text"
          placeholder="Type a message and press Enter..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onBlur={closeChat}
          className="h-12 text-lg bg-black/50 text-white border-white/30 placeholder:text-white/50"
        />
      </form>
    </div>
  );
}
