"use client"

import { createContext, useContext, useEffect, useState } from "react"

type Theme = "dark" | "light"

interface ThemeContextType {
  theme: Theme
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  toggle: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark")
  const [mounted, setMounted] = useState(false)

  const toggle = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"))
  }

  useEffect(() => {
    const saved = localStorage.getItem("asi-theme") as Theme | null
    if (saved) setTheme(saved)
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    localStorage.setItem("asi-theme", theme)
    const root = document.documentElement
    root.classList.remove("dark", "light")
    root.classList.add(theme)
  }, [theme, mounted])

  if (!mounted) {
    return <div style={{ visibility: "hidden" }}>{children}</div>
  }

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
