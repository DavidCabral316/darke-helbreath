import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './tests', timeout: 120000, workers: 1, use: { baseURL: 'http://localhost:8080', headless: true, viewport: {width:1440,height:1000}, screenshot: 'only-on-failure', trace: 'retain-on-failure' }, reporter: 'list' });
