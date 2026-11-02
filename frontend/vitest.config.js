import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  plugins: [svelte()],
  define: { __APP_BUILD__: JSON.stringify('test-build') },
  resolve: { conditions: ['browser'], alias: { $shared: fileURLToPath(new URL('../shared', import.meta.url)) } },
  test: { environment: 'node', include: ['tests/**/*.test.js'] },
});
