import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { skillApi } from './server/skill-api.mjs'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const local = loadEnv(mode, process.cwd(), 'CANVAS_')
  for (const [key, value] of Object.entries(local)) if (process.env[key] === undefined) process.env[key] = value
  return {
  plugins: [react(), skillApi()],
  server: { host: '127.0.0.1', watch: { ignored: ['**/.canvas-runtime/**', '**/.canvas-data/**', '**/artifacts/**'] } },
  }
})
