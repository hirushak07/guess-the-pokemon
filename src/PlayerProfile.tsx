import { useEffect, useState } from 'react';
import { useUser } from '@clerk/react';
import { useSupabase } from './useSupabase';

type SyncResult = { status: 'saved' | 'username_taken' | 'username_invalid'; username: string | null };

// Keeps the player's Supabase profile in step with Clerk through the sync_profile RPC, which
// always creates the row and decides on the server whether the username can be used.
// Verified scores never depend on it, so problems are reported quietly instead of blocking play.
export function PlayerProfile() {
  const { isLoaded, isSignedIn, user } = useUser();
  const supabase = useSupabase();
  const [problem, setProblem] = useState('');
  const id = isSignedIn ? user?.id : undefined;
  const username = isSignedIn ? user?.username ?? null : null;

  useEffect(() => {
    setProblem('');
    if (!isLoaded || !id) return;
    let cancelled = false;
    void supabase.rpc('sync_profile', { p_username: username }).then(({ data, error }) => {
      if (cancelled) return;
      const result = data as SyncResult | null;
      if (error || result?.status !== 'saved') {
        console.warn('Profile sync incomplete:', error ?? result);
        setProblem(error
          ? 'COULDN’T SYNC YOUR PROFILE. YOUR SCORES STILL SAVE.'
          : 'YOUR USERNAME ISN’T ON YOUR PROFILE YET. YOUR SCORES STILL SAVE.');
      }
    });
    return () => { cancelled = true; };
  }, [isLoaded, id, username, supabase]);

  return problem ? <div className="profile-status" role="status">{problem}</div> : null;
}
