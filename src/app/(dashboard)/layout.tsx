"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { motion } from "framer-motion"
import { ChartLine, UploadSimple, FileText, House, MapPin, List, X, Sun, Moon } from "@phosphor-icons/react/dist/ssr"
import { useTheme } from "@/components/ui/theme-provider"
import { ToastProvider } from "@/components/ui/toast"

const navItems = [
  { href: "/", label: "Dashboard", icon: House },
  { href: "/peta", label: "Peta GIS", icon: MapPin },
  { href: "/upload", label: "Upload Data", icon: UploadSimple },
  { href: "/laporan", label: "Laporan", icon: FileText },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { theme, toggle } = useTheme()

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/"
    return pathname.startsWith(href)
  }

  return (
    <div className="flex min-h-screen bg-theme">
      {/* Mobile hamburger */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed left-4 top-4 z-50 rounded-lg bg-theme-secondary p-2 shadow-lg lg:hidden border border-theme text-theme"
        aria-label={sidebarOpen ? "Tutup menu" : "Buka menu"}
      >
        {sidebarOpen ? <X size={20} /> : <List size={20} />}
      </button>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r
          glass transition-transform duration-300
          lg:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="flex items-center gap-3 border-b border-theme px-6 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500">
            <ChartLine size={20} weight="bold" className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-theme">ASI Eksklusif</h1>
            <p className="text-xs text-theme-secondary">Prediction System</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`
                  group relative flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm
                  transition-all duration-200
                  ${active
                    ? "bg-emerald-500/10 text-emerald-400 font-medium"
                    : "text-theme-secondary hover:bg-hover-theme hover:text-theme"
                  }
                `}
              >
                {active && (
                  <motion.div
                    layoutId="activeNav"
                    className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-emerald-500"
                  />
                )}
                <item.icon
                  size={18}
                  className={
                    active
                      ? "text-emerald-400"
                      : "text-theme-secondary group-hover:text-emerald-400 transition-colors"
                  }
                />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-theme px-4 py-3 space-y-2">
          <button
            onClick={toggle}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-theme-secondary hover:bg-hover-theme transition-colors"
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            {theme === "dark" ? "Mode Terang" : "Mode Gelap"}
          </button>
          <p className="px-3 text-xs text-muted">LSTM Panel v1.0</p>
        </div>
      </aside>

      <main className="flex-1 p-4 lg:p-6 lg:ml-64 pt-16 lg:pt-6">
        <ToastProvider>{children}</ToastProvider>
      </main>
    </div>
  )
}
