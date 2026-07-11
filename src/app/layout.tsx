import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Sistem Prediksi ASI Eksklusif + XAI Panel LSTM",
  description:
    "Prediksi cakupan ASI Eksklusif 24 Puskesmas dengan LSTM Panel + XAI SHAP",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id" className="dark">
      <body className={`${inter.className} antialiased`}>{children}</body>
    </html>
  )
}
