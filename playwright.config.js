import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 0,
  use: { baseURL: 'http://127.0.0.1:4173', launchOptions: { args: ['--no-sandbox'] } },
  reporter: [['list'], ['json', { outputFile: 'e2e/reports/last-run.json' }]],
});
