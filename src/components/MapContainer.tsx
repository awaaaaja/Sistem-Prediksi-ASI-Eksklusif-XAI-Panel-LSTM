"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import dynamic from "next/dynamic"
import L from "leaflet"
import { MapContainer as LeafletMap, TileLayer, GeoJSON, useMap } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css"
import "leaflet-defaulticon-compatibility"
import type { MapDataResponse, Segmen } from "@/types"
import { SEGMEN_THRESHOLDS } from "@/lib/constants"
import { MapLegend } from "@/components/map/MapLegend"
import { YearSelector } from "@/components/map/YearSelector"
import { KecamatanPopup } from "@/components/map/KecamatanPopup"

const SEGMEN_RGB: Record<Segmen, string> = {
  SANGAT_BAIK: "60,180,75",
  SEDANG: "255,225,25",
  RENDAH: "230,25,75",
}

function getSegmenColor(segmen: Segmen, alpha = 0.8) {
  return `rgba(${SEGMEN_RGB[segmen]}, ${alpha})`
}

function getSegmenColorSolid(segmen: Segmen) {
  if (segmen === "SANGAT_BAIK") return "#3cb44b"
  if (segmen === "SEDANG") return "#ffe119"
  return "#e6194b"
}

function getSegmen(nilai: number | null): Segmen {
  if (nilai === null || nilai === undefined) return "RENDAH"
  if (nilai >= SEGMEN_THRESHOLDS.SANGAT_BAIK) return "SANGAT_BAIK"
  if (nilai >= SEGMEN_THRESHOLDS.SEDANG) return "SEDANG"
  return "RENDAH"
}

function formatSegmen(s: Segmen) {
  if (s === "SANGAT_BAIK") return "Sangat Baik"
  if (s === "SEDANG") return "Sedang"
  return "Rendah"
}

function MapContent({ data, tahun }: { data: MapDataResponse; tahun: number }) {
  const map = useMap()

  useEffect(() => {
    if (data.kecamatan.features.length > 0) {
      const geo = L.geoJSON(data.kecamatan as any)
      map.fitBounds(geo.getBounds(), { padding: [50, 50] })
    }
  }, [map, data])

  const kecamatanDataMap = useMemo(() => {
    const m = new Map<string, any>()
    for (const f of data.kecamatan.features) {
      const props = f.properties as any
      m.set(props.nama || props.nm_kecamatan, props)
    }
    return m
  }, [data.kecamatan.features])

  const puskesmasByKecamatan = useMemo(() => {
    const m = new Map<string, any[]>()
    for (const f of data.puskesmas.features) {
      const props = f.properties as any
      const kec = props.kecamatan
      if (!m.has(kec)) m.set(kec, [])
      m.get(kec)!.push(props)
    }
    return m
  }, [data.puskesmas.features])

  return (
    <>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <GeoJSON
        key={`kecamatan-${tahun}`}
        data={data.kecamatan as any}
        style={(feature) => {
          const props = feature?.properties as any
          const segmen: Segmen = props?.segmen ?? "RENDAH"
          return {
            fillColor: getSegmenColor(segmen, 0.8),
            weight: 2.5,
            opacity: 1,
            color: "#ffffff",
            fillOpacity: 0.8,
          }
        }}
        onEachFeature={(feature, layer) => {
          const props = feature.properties as any
          const segmen: Segmen = props?.segmen ?? "RENDAH"
          layer.on({
            mouseover: (e) => {
              e.target.setStyle({ fillOpacity: 0.95, weight: 3.5 })
              e.target.bringToFront()
            },
            mouseout: (e) => {
              e.target.setStyle({ fillOpacity: 0.8, weight: 2.5 })
            },
          })
          layer.bindTooltip(
            `<strong>${props.nama || props.nm_kecamatan}</strong><br/>${formatSegmen(segmen)} — ${props.rata_cakupan?.toFixed(1) ?? "-"}%`,
            { sticky: true, className: "rounded-lg px-3 py-2 text-xs shadow-lg" }
          )
          const kecNama = props.nama || props.nm_kecamatan
          const kecData = kecamatanDataMap.get(kecNama)
          const pkmList = puskesmasByKecamatan.get(kecNama) ?? []
          const demografi = data.demografi?.[kecNama]
          layer.bindPopup(
            KecamatanPopup({
              nama: kecNama,
              segmen,
              rataCakupan: kecData?.rata_cakupan,
              puskesmasCount: kecData?.puskesmas_count ?? pkmList.length,
              puskesmasList: pkmList,
              penduduk: demografi?.penduduk,
              kepadatan: demografi?.kepadatan,
            }),
            { maxWidth: 340, className: "custom-popup" }
          )
        }}
      />
    </>
  )
}

export default function MapWrapper() {
  const [data, setData] = useState<MapDataResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tahun, setTahun] = useState<number>(0)
  const [sidebarKec, setSidebarKec] = useState<string | null>(null)

  const fetchData = useCallback(async (t: number) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/map/data?tahun=${t || 0}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const d = await res.json()
      setData(d)
      if (d.tahunTersedia?.length > 0 && t === 0) {
        setTahun(Math.max(...d.tahunTersedia))
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(tahun)
  }, [tahun, fetchData])

  const stats = useMemo(() => data?.stats ?? null, [data])

  const sortedKecamatan = useMemo(() => {
    if (!data) return []
    return data.kecamatan.features
      .map((f: any) => {
        const p = f.properties as any
        const segmen: Segmen = p.segmen ?? "RENDAH"
        return {
          nama: p.nama || p.nm_kecamatan,
          rataCakupan: p.rata_cakupan,
          segmen,
          puskesmasCount: p.puskesmas_count ?? 0,
        }
      })
      .sort((a: any, b: any) => (b.rataCakupan ?? 0) - (a.rataCakupan ?? 0))
  }, [data])

  const [activeSegmen, setActiveSegmen] = useState<Segmen | null>(null)

  if (loading && !data) {
    return (
      <div className="flex h-[600px] items-center justify-center rounded-xl border border-theme bg-theme-secondary/50">
        <div className="animate-pulse text-theme-secondary">Memuat peta...</div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="flex h-[600px] items-center justify-center rounded-xl border border-theme bg-theme-secondary/50">
        <div className="text-red-400">Gagal memuat data: {error}</div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
          <div className="glass rounded-xl px-4 py-3 text-center">
            <div className="text-xs text-theme-secondary">Kecamatan</div>
            <div className="text-xl font-bold text-theme">{stats?.totalKecamatan}</div>
          </div>
          <div className="glass rounded-xl px-4 py-3 text-center">
            <div className="text-xs text-theme-secondary">Puskesmas</div>
            <div className="text-xl font-bold text-theme">{stats?.totalPuskesmas}</div>
          </div>
          <div className="glass rounded-xl px-4 py-3 text-center">
            <div className="text-xs text-theme-secondary">Rata-rata Kota</div>
            <div className="text-xl font-bold text-theme">
              {stats?.rataCakupanKota.toFixed(1)}%
            </div>
          </div>
          <div className="glass rounded-xl px-4 py-3 text-center">
            <div className="text-xs text-theme-secondary">Segmen Dominan</div>
            <div
              className="text-xl font-bold"
              style={{ color: getSegmenColorSolid(stats?.segmenDominan ?? "RENDAH") }}
            >
              {formatSegmen(stats?.segmenDominan ?? "RENDAH")}
            </div>
          </div>
        </div>
        <YearSelector
          tahunTersedia={data.tahunTersedia}
          tahun={tahun}
          onChange={setTahun}
          loading={loading}
        />
      </div>

      <div className="flex gap-4">
        <div className="relative h-[600px] flex-1 overflow-hidden rounded-xl border border-theme">
          <MapLegend activeSegmen={activeSegmen} onHover={setActiveSegmen} />

          <LeafletMap
            center={[-0.93, 100.38]}
            zoom={12}
            className="h-full w-full"
            zoomControl={false}
          >
            <MapContent data={data} tahun={tahun} />
          </LeafletMap>
        </div>

        <div className="w-72 shrink-0 overflow-y-auto rounded-xl border border-theme bg-theme-secondary/30 p-4 max-h-[600px]">
          <h3 className="mb-3 text-sm font-semibold text-theme">Data per Kecamatan</h3>
          <div className="space-y-2">
            {sortedKecamatan.map((k: any) => (
              <button
                key={k.nama}
                onClick={() => setSidebarKec(sidebarKec === k.nama ? null : k.nama)}
                className={`w-full rounded-lg border p-3 text-left text-sm transition-colors ${
                  sidebarKec === k.nama
                    ? "border-emerald-500/30 bg-emerald-500/10"
                    : "border-theme bg-theme-secondary/50 hover:bg-theme-secondary"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-theme">{k.nama}</span>
                  <span className="text-xs text-muted">{k.puskesmasCount} pkm</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: getSegmenColorSolid(k.segmen) }}
                  />
                  <span className="text-xs text-theme-secondary">
                    {formatSegmen(k.segmen)} — {k.rataCakupan?.toFixed(1) ?? "-"}%
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
