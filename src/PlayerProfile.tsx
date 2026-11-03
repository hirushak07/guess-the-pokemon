
import { useEffect, useState } from 'react';
import { useUser } from '@clerk/react';
import { useSupabase } from './useSupabase';

export function PlayerProfile() {
  const { isLoaded, isSignedIn, user } = useUser();
  const supabase = useSupabase();
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;

    let cancelled = false;

    async function syncProfile() {
      const { error } = await supabase
        .from('profiles')
        .upsert(
          {
            id: user!.id,
            username: user!.username,
          },
          { onConflict: 'id' }
        );

      if (!cancelled) {
        setStatus(
          error ? `Profile sync failed: ${error.message}` : 'Profile saved!'
        );
      }
    }

    void syncProfile();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, user?.id, user?.username, supabase]);

  if (!isSignedIn) return null;

  return <div className="profile-status">{status}</div>;
}
