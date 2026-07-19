import dynamic from "next/dynamic"
import { MapPin } from "@phosphor-icons/react/dist/ssr"

const MapContainer = dynamic(() => import("@/components/MapContainer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[600px] items-center justify-center rounded-xl border border-theme bg-theme-secondary/50">
      <div className="text-theme-secondary">Memuat peta...</div>
    </div>
  ),
})

export default function PetaPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-theme">
          <MapPin size={28} className="text-emerald-400" weight="duotone" />
          Peta Sebaran ASI Eksklusif
        </h1>
        <p className="mt-1 text-theme-secondary">
          Visualisasi geografis cakupan ASI Eksklusif per Puskesmas dan Kecamatan se-Kota Padang — filter tahun untuk melihat perubahan segmen
        </p>
      </div>
      <MapContainer />
    </div>
  )
}
