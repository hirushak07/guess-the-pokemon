import { defineConfig } from '@playwright/test';

const port = process.env.PLAYWRIGHT_PORT || '5177';
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests',
  use: { baseURL, browserName: 'chromium', channel: process.env.PLAYWRIGHT_CHANNEL || undefined },
  // Always test this checkout, never a stale server left by another session.
  webServer: { command: `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${port} --strictPort --config tests/vite.config.mts --mode test`, url: baseURL, reuseExistingServer: false, env: {
    VITE_CLERK_PUBLISHABLE_KEY: 'test',
    VITE_SUPABASE_URL: 'https://example.supabase.co',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'test',
  } },
});
