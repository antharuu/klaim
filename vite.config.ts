import {defineConfig} from 'vite';
import {configDefaults} from 'vitest/config';
import * as path from 'path';

export default defineConfig({
    build: {
        lib: {
            entry: path.resolve(__dirname, 'src/index.ts'),
            name: 'klaim',
            fileName: format => {
                if (format === 'cjs') return `klaim.${format}`;
                return `klaim.${format}.js`;
            },
            formats: ['es', 'cjs', 'umd']
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
