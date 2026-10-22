import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { skillApi } from './server/skill-api.mjs'
import {adminEnabled, managementGate} from './server/admin-access.mjs'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const local = loadEnv(mode, process.cwd(), 'CANVAS_')
  for (const [key, value] of Object.entries(local)) if (process.env[key] === undefined) process.env[key] = value
  return {
  define: { 'import.meta.env.CANVAS_ADMIN_ENABLED': JSON.stringify(adminEnabled()) },
  plugins: [{name:'local-management-gate',configureServer(server){server.middlewares.use(managementGate)}},react(), skillApi()],
  server: { host: '127.0.0.1', fs: {deny:['.env','.env.*','*.{crt,pem}','**/.git/**','**/.canvas-data/**','**/.canvas-runtime/**','**/artifacts/**']}, watch: { ignored: ['**/.canvas-runtime/**', '**/.canvas-data/**', '**/artifacts/**'] } },
  }
})
