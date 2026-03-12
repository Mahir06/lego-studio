'use client';

import dynamic from 'next/dynamic';
import { Loader } from '@/components/ui/loader';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { useEffect } from 'react';
import { initiateAnonymousSignIn } from '@/firebase/non-blocking-login';
import { useToast } from '@/hooks/use-toast';

const GameCanvas = dynamic(() => import('@/components/game-canvas'), {
  ssr: false,
  loading: () => <Loader message="Loading World..." />,
});

export default function WorldPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  
  const worldId = Array.isArray(params.worldId) ? params.worldId[0] : params.worldId;
  const playerNameFromUrl = searchParams.get('playerName');

  const { auth, user, isUserLoading } = useFirebase();
  
  // Persisted player name
  const playerName = playerNameFromUrl || (typeof window !== 'undefined' ? localStorage.getItem('remote-play-player-name') : '');

  useEffect(() => {
    if (!isUserLoading && !user) {
      initiateAnonymousSignIn(auth);
    }
  }, [isUserLoading, user, auth]);

  useEffect(() => {
    if (!isUserLoading && (!playerName || !playerName.trim())) {
      toast({
        variant: "destructive",
        title: "Player Name Required",
        description: "You must enter a player name to join a world.",
      });
      router.replace('/');
    }
  }, [isUserLoading, playerName, router, toast]);
  
  if (!worldId) {
    return <Loader message="Getting World ID..." />;
  }
  
  if (isUserLoading || !user || !playerName) {
    return <Loader message="Authenticating..." />;
  }

  return <GameCanvas worldId={worldId} playerName={playerName} />;
}
