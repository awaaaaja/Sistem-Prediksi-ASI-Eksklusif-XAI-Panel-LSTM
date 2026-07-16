"use client"

import { createContext, useContext, useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle, XCircle, Info, X } from "@phosphor-icons/react/dist/ssr"

type ToastType = "success" | "error" | "info"

interface Toast {
  id: number
  type: ToastType
  message: string
}

const styles: Record<ToastType, { bg: string; border: string }> = {
  success: { bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  error:   { bg: "bg-red-500/10",     border: "border-red-500/20" },
  info:    { bg: "bg-cyan-500/10",    border: "border-cyan-500/20" },
}

const icons: Record<ToastType, React.ElementType> = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
}

const iconColors: Record<ToastType, string> = {
  success: "text-emerald-400",
  error: "text-red-400",
  info: "text-cyan-400",
}

interface ToastContextType {
  toast: (type: ToastType, message: string) => void
}

const ToastContext = createContext<ToastContextType>({ toast: () => {} })

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const idRef = useCallback(() => Date.now() + Math.random(), [])

  const addToast = useCallback((type: ToastType, message: string) => {
    const toastId = idRef()
    setToasts((prev) => [...prev, { id: toastId, type, message }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toastId))
    }, 5000)
  }, [idRef])

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => {
            const s = styles[t.type]
            const Icon = icons[t.type]
            const iconColor = iconColors[t.type]
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: 100 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 100 }}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur-xl min-w-[280px] ${s.bg} ${s.border}`}
              >
                <Icon size={18} className={iconColor} />
                <p className="flex-1 text-sm text-theme">{t.message}</p>
                <button onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))} className="text-theme-secondary hover:text-theme">
                  <X size={14} />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
