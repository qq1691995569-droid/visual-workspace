import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
const FunctionAdmin=lazy(()=>import('./FunctionAdmin'))

try {
  document.documentElement.dataset.theme = localStorage.getItem('visual-workspace-theme') === 'dark' ? 'dark' : 'light'
} catch { document.documentElement.dataset.theme = 'light' }

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {location.pathname==='/admin' ? import.meta.env.CANVAS_ADMIN_ENABLED ? <Suspense fallback={<p>正在加载管理后台…</p>}><FunctionAdmin/></Suspense> : <p>页面不存在</p> : <App />}
  </StrictMode>,
)
