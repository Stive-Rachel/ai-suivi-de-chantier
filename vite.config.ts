import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
    coverage: {
      exclude: [
        'src/initialData.json',
        'src/main.tsx',
        'src/App.tsx',
        'src/vite-env.d.ts',
        'node_modules/**',
        '**/*.test.*',
        '**/__tests__/**',
      ],
    },
  },
})
