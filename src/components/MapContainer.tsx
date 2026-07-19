"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import dynamic from "next/dynamic"
import L from "leaflet"
import { MapContainer as LeafletMap, TileLayer, Marker, Popup, GeoJSON, useMap } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css"
import "leaflet-defaulticon-compatibility"
import type { MapDataResponse, Segmen } from "@/types"
import { SEGMEN_THRESHOLDS } from "@/lib/constants"
import { MapLegend } from "@/components/map/MapLegend"
import { YearSelector } from "@/components/map/YearSelector"
import { KecamatanPopup } from "@/components/map/KecamatanPopup"

const SEGMEN_COLORS: Record<Segmen, string> = {
  SANGAT_BAIK: "#10b981",
  SEDANG: "#f59e0b",
  RENDAH: "#ef4444",
}

const SEGMEN_RGB: Record<Segmen, string> = {
  SANGAT_BAIK: "16,185,129",
  SEDANG: "245,158,11",
  RENDAH: "239,68,68",
}

function getSegmenColor(segmen: Segmen, alpha = 0.35) {
  return `rgba(${SEGMEN_RGB[segmen]}, ${alpha})`
}

function getSegmenColorSolid(segmen: Segmen) {
  return SEGMEN_COLORS[segmen]
}

function getSegmen(nilai: number | null): Segmen {
  if (nilai === null || nilai === undefined) return "RENDAH"
  if (nilai >= SEGMEN_THRESHOLDS.SANGAT_BAIK) return "SANGAT_BAIK"
  if (nilai >= SEGMEN_THRESHOLDS.SEDANG) return "SEDANG"
  return "RENDAH"
}

function MapContent({ data, tahun }: { data: MapDataResponse; tahun: number }) {
  const map = useMap()

  useEffect(() => {
    if (data.puskesmas.features.length > 0) {
      const coords = data.puskesmas.features.map((f: any) => f.geometry.coordinates as number[])
      const valid = coords.filter((c: number[]) => c[0] !== 0 && c[1] !== 0)
      if (valid.length > 0) {
        const bounds = valid.reduce(
          (b: any, c: number[]) => ({
            minLat: Math.min(b.minLat, c[1]),
            maxLat: Math.max(b.maxLat, c[1]),
            minLng: Math.min(b.minLng, c[0]),
            maxLng: Math.max(b.maxLng, c[0]),
          }),
          { minLat: Infinity, maxLat: -Infinity, minLng: Infinity, maxLng: -Infinity }
        )
        map.fitBounds(
          [
            [bounds.minLat, bounds.minLng],
            [bounds.maxLat, bounds.maxLng],
          ],
          { padding: [50, 50] }
        )
      }
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
            fillColor: getSegmenColor(segmen, 0.4),
            weight: 2,
            opacity: 0.8,
            color: "rgba(255,255,255,0.6)",
            fillOpacity: 0.4,
          }
        }}
        onEachFeature={(feature, layer) => {
          const props = feature.properties as any
          const segmen: Segmen = props?.segmen ?? "RENDAH"
          layer.on({
            mouseover: (e) => {
              e.target.setStyle({ fillOpacity: 0.7, weight: 3 })
              e.target.bringToFront()
            },
            mouseout: (e) => {
              e.target.setStyle({ fillOpacity: 0.4, weight: 2 })
            },
          })
          layer.bindTooltip(props.nama || props.nm_kecamatan, {
            sticky: true,
            className: "rounded-lg px-2 py-1 text-xs shadow-lg",
          })
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
            { maxWidth: 320, className: "custom-popup" }
          )
        }}
      />

      {data.puskesmas.features.map((f: any) => {
        const pc = f.geometry.coordinates as number[]
        if (pc[0] === 0 && pc[1] === 0) return null
        const props = f.properties as any
        const segmen: Segmen = props.segmen ?? "RENDAH"
        return (
          <Marker
            key={`pkm-${props.kode}`}
            position={[pc[1], pc[0]]}
            icon={L.divIcon({
              className: "custom-marker",
              html: `<div style="
                width: 14px; height: 14px;
                background: ${getSegmenColorSolid(segmen)};
                border: 2px solid white;
                border-radius: 50%;
                box-shadow: 0 0 6px ${getSegmenColorSolid(segmen)};
              "></div>`,
              iconSize: [14, 14],
              iconAnchor: [7, 7],
            })}
          >
            <Popup>
              <div className="text-sm min-w-[180px]">
                <strong className="text-base">{props.nama}</strong>
                <br />
                <span className="text-gray-400">{props.kecamatan}</span>
                <br />
                Cakupan: {props.rata_cakupan?.toFixed(1) ?? "-"}%
                <br />
                Segmen: <span style={{ color: getSegmenColorSolid(segmen), fontWeight: 600 }}>
                  {segmen === "SANGAT_BAIK" ? "Sangat Baik (\u226580%)" : segmen === "SEDANG" ? "Sedang (50-79%)" : "Rendah (<50%)"}
                </span>
                <br />
                <a
                  href={`/puskesmas/${props.id}`}
                  className="text-emerald-400 hover:text-emerald-300 underline mt-1 inline-block"
                >
                  Detail &rarr;
                </a>
              </div>
            </Popup>
          </Marker>
        )
      })}
    </>
  )
}

export default function MapWrapper() {
  const [data, setData] = useState<MapDataResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tahun, setTahun] = useState<number>(0)

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

  const stats = useMemo(() => {
    if (!data) return null
    return data.stats
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
              {stats?.segmenDominan === "SANGAT_BAIK"
                ? "Sangat Baik"
                : stats?.segmenDominan === "SEDANG"
                  ? "Sedang"
                  : "Rendah"}
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

      <div className="relative h-[600px] overflow-hidden rounded-xl border border-theme">
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
    </div>
  )
}
