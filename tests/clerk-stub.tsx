import { useSyncExternalStore, type ReactNode } from 'react';

const authEvent = 'test-auth-change';
const player = { id: 'user_test_owner', username: 'trainer' };
const session = { getToken: async () => 'test-session-token' };
const signedIn = () => sessionStorage.getItem('test-signed-in') === 'yes';

function subscribe(callback: () => void) {
  window.addEventListener(authEvent, callback);
  return () => window.removeEventListener(authEvent, callback);
}

export const ClerkProvider = ({ children }: { children: ReactNode }) => children;
export function Show({ when, children }: { when: string; children: ReactNode }) {
  const { isSignedIn } = useUser();
  return when === (isSignedIn ? 'signed-in' : 'signed-out') ? children : null;
}
export const SignInButton = ({ children }: { children: ReactNode }) => children;
export const SignUpButton = SignInButton;
export const UserButton = () => <button onClick={() => {
  sessionStorage.removeItem('test-signed-in');
  window.dispatchEvent(new Event(authEvent));
}}>Test sign out</button>;
export function useUser() {
  const isSignedIn = useSyncExternalStore(subscribe, signedIn);
  return { isLoaded: true, isSignedIn, user: isSignedIn ? player : null };
}
export const useSession = () => ({ session: useUser().isSignedIn ? session : null });
