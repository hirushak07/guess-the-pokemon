
import { useMemo } from 'react';
import { useSession } from '@clerk/react';
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export function useSupabase() {
  const { session } = useSession();

  return useMemo(() => {
    if (!url || !key) {
      throw new Error('Missing Supabase configuration');
    }

    return createClient(url, key, {
      accessToken: async () => {
        return (await session?.getToken()) ?? null;
      },
    });
  }, [session]);
}
