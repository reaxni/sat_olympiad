import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react(), {
    name: 'exclude-development-modules',
    apply: 'build',
    generateBundle(_, bundle) {
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') continue;
        for (const id of Object.keys(output.modules)) {
          const path = id.replaceAll('\\', '/');
          if (path.includes('/api/development/') || path.includes('/pages/ComponentPreview')) {
            this.error(`Development module leaked into production: ${path}`);
          }
        }
      }
    },
  }],
  build: { sourcemap: false },
});
