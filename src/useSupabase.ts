import { useMemo, useRef } from 'react';
import { useSession } from '@clerk/react';
import { PostgrestClient } from '@supabase/postgrest-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
// New sb_publishable_/sb_secret_ keys only belong in the apikey header; legacy JWT keys also
// act as the anonymous bearer token. This matches what supabase-js sends.
const keyIsBearer = !/^sb_(publishable|secret)_/.test(key ?? '');

// The game only calls RPCs, so it uses Supabase's database client instead of the full SDK. The
// client stays the same object while Clerk's token is read per request, so refreshes never re-run effects.
export function useSupabase() {
  const { session } = useSession();
  const sessionRef = useRef(session);
  sessionRef.current = session;

  return useMemo(() => {
    if (!url || !key) throw new Error('Missing Supabase configuration');
    return new PostgrestClient(`${url.replace(/\/+$/, '')}/rest/v1`, {
      headers: { apikey: key },
      fetch: async (input, init) => {
        const headers = new Headers(init?.headers);
        const token = (await sessionRef.current?.getToken()) ?? (keyIsBearer ? key : null);
        if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
        return fetch(input, { ...init, headers });
      },
    });
  }, []);
}
