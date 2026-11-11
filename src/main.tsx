
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider } from '@clerk/react';
import App from './App';
import './style.css';

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
