import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: { baseURL: 'http://127.0.0.1:5177', browserName: 'chromium', channel: process.env.PLAYWRIGHT_CHANNEL || undefined },
  // Always test this checkout, never a stale server left by another session.
  webServer: { command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5177 --strictPort', url: 'http://127.0.0.1:5177', reuseExistingServer: false },
});
