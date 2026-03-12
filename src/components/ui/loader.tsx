import { cn } from '@/lib/utils';
import { Cuboid } from 'lucide-react';

export function Loader({ className, message = "Loading..." }: { className?: string, message?: string }) {
  return (
    <div className={cn("pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-b from-emerald-50 via-white to-sky-50", className)}>
        <div className="flex flex-col items-center gap-5">
            <div className="relative">
              <div className="w-20 h-20 bg-gradient-to-br from-primary to-emerald-400 rounded-3xl flex items-center justify-center shadow-lg shadow-primary/30 animate-bounce">
                <Cuboid className="w-10 h-10 text-white" />
              </div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <p className="text-lg font-extrabold text-foreground">{message}</p>
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2.5 h-2.5 rounded-full bg-secondary animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2.5 h-2.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
        </div>
    </div>
  );
}
