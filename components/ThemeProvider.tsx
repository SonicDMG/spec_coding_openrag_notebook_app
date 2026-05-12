'use client'

import { createContext, useContext, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark' | 'fun'

const ThemeContext = createContext<{ theme: Theme; setTheme: (t: Theme) => void }>({
  theme: 'light',
  setTheme: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.classList.remove('dark', 'theme-fun')
  if (theme === 'dark') root.classList.add('dark')
  if (theme === 'fun') root.classList.add('theme-fun')
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light')

  useEffect(() => {
    const saved = localStorage.getItem('theme') as Theme | null
    const resolved = (saved && ['light', 'dark', 'fun'].includes(saved))
      ? saved
      : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    setThemeState(resolved)
    applyTheme(resolved)
  }, [])

  function setTheme(t: Theme) {
    setThemeState(t)
    applyTheme(t)
    localStorage.setItem('theme', t)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

// Inline script content — run before first paint to avoid flash
export const themeScript = `
try {
  var t = localStorage.getItem('theme');
  if (t === 'dark') document.documentElement.classList.add('dark');
  else if (t === 'fun') document.documentElement.classList.add('theme-fun');
  else if (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.classList.add('dark');
} catch(e) {}
`
