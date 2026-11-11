import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider } from '@clerk/react';
import App from './App';
// Self-hosted fonts load from the site itself instead of a render-blocking Google Fonts stylesheet.
import '@fontsource/press-start-2p/latin-400.css';
import '@fontsource/vt323/latin-400.css';
import './style.css';

// A tab left open across a deploy can ask for code-split files that no longer exist; reload for the new build.
window.addEventListener('vite:preloadError', () => window.location.reload());

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
  throw new Error('Missing Clerk publishable key');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider
      publishableKey={publishableKey}
      appearance={{
        variables: {
          colorPrimary: '#ffd36b',
          colorPrimaryForeground: '#17264a',
          colorBackground: '#203a76',
          colorForeground: '#fff8e8',
          colorMutedForeground: '#d4dff6',
          colorInput: '#13234d',
          colorInputForeground: '#fff8e8',
          colorBorder: '#7497e0',
          borderRadius: '0.5rem',
        },
        elements: {
          cardBox: 'pokepixel-auth-card',
          headerTitle: 'pokepixel-auth-title',
        },
      }}
    >
      <App />
    </ClerkProvider>
  </StrictMode>
);
