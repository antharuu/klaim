import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';

export default defineConfig({
    build: {
        lib: {
            entry: 'src/index.ts',
            name: 'klaim',
            fileName: format => `klaim.${format}.js`
        },
        rollupOptions: {
            external: [],
            output: {
                globals: {}
            }
        }
    },
    test: {
        globals: true,
        environment: 'jsdom',
        coverage: {
            provider: 'v8'
        },
        exclude: [...configDefaults.exclude, 'tests/e2e/**'],
    },
});
