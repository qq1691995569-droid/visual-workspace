import { useLayoutEffect, useState } from 'react'
import { ControlButton } from '@xyflow/react'
import { Moon, Sun } from 'lucide-react'

const storageKey = 'visual-workspace-theme'
export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try { return localStorage.getItem(storageKey) === 'dark' ? 'dark' : 'light' } catch { return 'light' }
  })
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem(storageKey, theme) } catch { /* Theme still works without storage. */ }
  }, [theme])
  const label = theme === 'light' ? '切换深色主题' : '切换浅色主题'
  return <ControlButton className="theme-toggle" title={label} aria-label={label} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
    {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
  </ControlButton>
}
