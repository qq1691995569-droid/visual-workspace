import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

try {
  document.documentElement.dataset.theme = localStorage.getItem('visual-workspace-theme') === 'dark' ? 'dark' : 'light'
} catch { document.documentElement.dataset.theme = 'light' }

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
