/// <reference types="vitest/config" />
import path from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'
import { apiDev } from './vite-api-dev.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Server-only vars for the dev /api middleware. Not exposed to the browser: only VITE_* is (envPrefix).
  const env = loadEnv(mode, import.meta.dirname, 'UPSTOX_')
  if (env.UPSTOX_ANALYTICS_TOKEN) process.env.UPSTOX_ANALYTICS_TOKEN = env.UPSTOX_ANALYTICS_TOKEN
  return {
  plugins: [react(), tailwindcss(), apiDev()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  test: {
    include: ['src/**/*.test.ts', 'api/**/*.test.ts'],
  },
  }
})
