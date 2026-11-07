import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: mode === 'test' ? {
    alias: { '@clerk/react': fileURLToPath(new URL('./clerk-stub.tsx', import.meta.url)) },
  } : undefined,
}));
