import Link from "next/link"
import { ChartLine, UploadSimple, FileText, House } from "@phosphor-icons/react/dist/ssr"

const navItems = [
  { href: "/", label: "Dashboard", icon: House },
  { href: "/upload", label: "Upload Data", icon: UploadSimple },
  { href: "/laporan", label: "Laporan", icon: FileText },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="glass fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-white/5">
        <div className="flex items-center gap-3 border-b border-white/5 px-6 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500">
            <ChartLine size={20} weight="bold" className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white">ASI Eksklusif</h1>
            <p className="text-xs text-dark-400">Prediction System</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm text-dark-300 transition-all hover:bg-white/5 hover:text-white"
            >
              <item.icon size={18} className="text-dark-400 group-hover:text-emerald-400" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-white/5 px-6 py-4">
          <p className="text-xs text-dark-500">LSTM Panel v1.0</p>
        </div>
      </aside>
      <main className="ml-64 flex-1 p-6">{children}</main>
    </div>
  )
}
