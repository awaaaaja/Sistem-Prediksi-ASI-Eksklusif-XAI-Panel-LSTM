"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import L from "leaflet"
import { MapContainer as LeafletMap, TileLayer, Marker, Popup, GeoJSON, useMap } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css"
import "leaflet-defaulticon-compatibility"
import type { MapDataResponse, Segmen, GeoFeature } from "@/types"

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

const SEGMEN_LABELS: Record<Segmen, string> = {
  SANGAT_BAIK: "Sangat Baik (\u226580%)",
  SEDANG: "Sedang (60-79%)",
  RENDAH: "Rendah (<60%)",
}

const PUSKESMAS_BORDER: Record<Segmen, string> = {
  SANGAT_BAIK: "#059669",
  SEDANG: "#d97706",
  RENDAH: "#dc2626",
}

function createFallbackPolygons(kecamatan: { features: GeoFeature[] }): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: kecamatan.features.map((k) => {
      const coords = k.geometry.coordinates as number[]
      const radius = 0.022
      const points: number[][] = []
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 - Math.PI / 2
        points.push([
          coords[0] + radius * Math.cos(angle),
          coords[1] + radius * Math.sin(angle),
        ])
      }
      points.push(points[0])
      return {
        type: "Feature",
        properties: { ...k.properties },
        geometry: { type: "Polygon", coordinates: [points] },
      }
    }),
  } as unknown as GeoJSON.FeatureCollection
}

function getSegmenColor(segmen: Segmen, alpha = 0.35) {
  return `rgba(${SEGMEN_RGB[segmen]}, ${alpha})`
}

function MapContent({ data }: { data: MapDataResponse }) {
  const map = useMap()
  const [geoData, setGeoData] = useState<GeoJSON.FeatureCollection | null>(null)

  useEffect(() => {
    fetch("/data/kecamatan-padang.geo.json")
      .then((r) => {
        if (!r.ok) throw new Error("not found")
        return r.json()
      })
      .then(setGeoData)
      .catch(() => {
        setGeoData(createFallbackPolygons(data.kecamatan))
      })
  }, [data.kecamatan])

  useEffect(() => {
    if (data.puskesmas.features.length > 0) {
      const coords = data.puskesmas.features.map((f) => f.geometry.coordinates as number[])
      const bounds = coords.reduce(
        (b, c) => ({
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
  }, [map, data])

  return (
    <>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {geoData && (
        <GeoJSON
          key={JSON.stringify(geoData)}
          data={geoData}
          style={(feature) => {
            const props = feature?.properties as GeoJSON.GeoJsonProperties & { segmen?: Segmen }
            const warna = props?.segmen
              ? getSegmenColor(props.segmen, 0.4)
              : "rgba(148,163,184,0.2)"
            return {
              fillColor: warna,
              weight: 2,
              opacity: 0.8,
              color: "rgba(255,255,255,0.6)",
              fillOpacity: 0.4,
            }
          }}
          onEachFeature={(feature, layer) => {
            const props = feature.properties as GeoJSON.GeoJsonProperties & {
              nama: string; segmen?: Segmen; rata_cakupan?: number; puskesmas_count?: number
            }
            layer.on({
              mouseover: (e) => {
                e.target.setStyle({ fillOpacity: 0.7, weight: 3 })
                e.target.bringToFront()
              },
              mouseout: (e) => {
                e.target.setStyle({ fillOpacity: 0.4, weight: 2 })
              },
              click: () => {
                layer.bindPopup(`
                  <strong>Kec. ${props.nama}</strong><br/>
                  Rata-rata: ${props.rata_cakupan?.toFixed(1) ?? "-"}%<br/>
                  Puskesmas: ${props.puskesmas_count ?? "-"}
                `).openPopup()
              },
            })
            if (props.segmen) {
              layer.bindTooltip(props.nama, {
                sticky: true,
                className: "rounded-lg px-2 py-1 text-xs shadow-lg",
              })
            }
          }}
        />
      )}

      {data.puskesmas.features.map((f) => {
        const pc = f.geometry.coordinates as number[]
        return (
          <Marker
            key={`pkm-${f.properties.kode}`}
            position={[pc[1], pc[0]]}
            icon={L.divIcon({
              className: "custom-marker",
              html: `<div style="
                width: 14px; height: 14px;
                background: ${SEGMEN_COLORS[f.properties.segmen]};
                border: 2px solid white;
                border-radius: 50%;
                box-shadow: 0 0 6px ${SEGMEN_COLORS[f.properties.segmen]};
              "></div>`,
              iconSize: [14, 14],
              iconAnchor: [7, 7],
            })}
          >
            <Popup>
              <div className="text-sm min-w-[180px]">
                <strong className="text-base">{f.properties.nama}</strong>
                <br />
                <span className="text-dark-400">{f.properties.kecamatan}</span>
                <br />
                Cakupan: {f.properties.rata_cakupan?.toFixed(1) ?? "-"}%
                <br />
                Segmen: <span style={{ color: SEGMEN_COLORS[f.properties.segmen], fontWeight: 600 }}>
                  {SEGMEN_LABELS[f.properties.segmen]}
                </span>
                <br />
                <a
                  href={`/puskesmas/${f.properties.id}`}
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

  useEffect(() => {
    fetch("/api/map/data")
      .then((r) => r.json())
      .then((d) => {
        setData(d)
        setLoading(false)
      })
      .catch((e) => {
        setError(e.message)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="flex h-[600px] items-center justify-center rounded-xl border border-theme bg-theme-secondary/50">
        <div className="text-theme-secondary">Memuat peta...</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex h-[600px] items-center justify-center rounded-xl border border-theme bg-theme-secondary/50">
        <div className="text-red-400">Gagal memuat data: {error}</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <div className="glass rounded-xl px-4 py-3 text-center">
          <div className="text-xs text-theme-secondary">Kecamatan</div>
          <div className="text-xl font-bold text-theme">{data.stats.totalKecamatan}</div>
        </div>
        <div className="glass rounded-xl px-4 py-3 text-center">
          <div className="text-xs text-theme-secondary">Puskesmas</div>
          <div className="text-xl font-bold text-theme">{data.stats.totalPuskesmas}</div>
        </div>
        <div className="glass rounded-xl px-4 py-3 text-center">
          <div className="text-xs text-theme-secondary">Rata-rata Kota</div>
          <div className="text-xl font-bold text-theme">
            {data.stats.rataCakupanKota.toFixed(1)}%
          </div>
        </div>
        <div className="glass rounded-xl px-4 py-3 text-center">
          <div className="text-xs text-theme-secondary">Segmen Dominan</div>
          <div
            className="text-xl font-bold"
            style={{ color: SEGMEN_COLORS[data.stats.segmenDominan] }}
          >
            {data.stats.segmenDominan === "SANGAT_BAIK"
              ? "Sangat Baik"
              : data.stats.segmenDominan === "SEDANG"
                ? "Sedang"
                : "Rendah"}
          </div>
        </div>
      </div>

      <div className="relative h-[600px] overflow-hidden rounded-xl border border-theme">
        <div className="absolute right-4 top-4 z-[999] rounded-lg bg-theme-secondary/90 px-3 py-2 text-xs shadow-lg backdrop-blur-sm border border-theme">
          <div className="mb-1 font-semibold text-theme">Legenda</div>
          <div className="space-y-1">
            {(["SANGAT_BAIK", "SEDANG", "RENDAH"] as Segmen[]).map((s) => (
              <div key={s} className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded-sm"
                  style={{ backgroundColor: SEGMEN_COLORS[s] }}
                />
                <span className="text-theme-secondary">{SEGMEN_LABELS[s]}</span>
              </div>
            ))}
            <div className="border-t border-theme pt-1 mt-1">
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-full border-2 border-white/60 bg-transparent" />
                <span className="text-muted">Puskesmas</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="inline-block h-3 w-3 rounded-sm border border-white/40"
                  style={{ background: "rgba(148,163,184,0.2)" }} />
                <span className="text-muted">Area Kecamatan</span>
              </div>
            </div>
          </div>
        </div>
        <LeafletMap
          center={[-0.93, 100.38]}
          zoom={12}
          className="h-full w-full"
          zoomControl={false}
        >
          <MapContent data={data} />
        </LeafletMap>
      </div>
    </div>
  )
}
