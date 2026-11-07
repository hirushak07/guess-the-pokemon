import type { ReactNode } from 'react';

// Gameplay tests run signed out and offline, without loading a live Clerk tenant.
export const ClerkProvider = ({ children }: { children: ReactNode }) => children;
export const Show = ({ when, children }: { when: string; children: ReactNode }) =>
  when === 'signed-out' ? children : null;
export const SignInButton = ({ children }: { children: ReactNode }) => children;
export const SignUpButton = SignInButton;
export const UserButton = () => null;
export const useUser = () => ({ isLoaded: true, isSignedIn: false });
export const useSession = () => ({ session: null });
