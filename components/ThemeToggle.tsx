'use client'

import { useState } from 'react'
import { Sun, Moon, Palette } from 'lucide-react'
import { useTheme, type Theme } from './ThemeProvider'

const OPTIONS: { value: Theme; label: string; icon: React.ElementType }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark',  label: 'Dark',  icon: Moon },
  { value: 'fun',   label: 'Fun',   icon: Palette },
]

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const current = OPTIONS.find(o => o.value === theme) ?? OPTIONS[0]
  const Icon = current.icon

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        title="Change theme"
        className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
      >
        <Icon size={16} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-card border rounded-md shadow-md py-1 min-w-[110px]">
            {OPTIONS.map(({ value, label, icon: OptionIcon }) => (
              <button
                key={value}
                onClick={() => { setTheme(value); setOpen(false) }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted transition-colors ${
                  theme === value ? 'text-primary font-medium' : 'text-foreground'
                }`}
              >
                <OptionIcon size={13} />
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
