import type { Segmen } from "@/types"

const SEGMEN_COLORS: Record<Segmen, string> = {
  SANGAT_BAIK: "#10b981",
  SEDANG: "#f59e0b",
  RENDAH: "#ef4444",
}

const SEGMEN_LABELS: Record<Segmen, string> = {
  SANGAT_BAIK: "Sangat Baik",
  SEDANG: "Sedang",
  RENDAH: "Rendah",
}

interface KecamatanPopupProps {
  nama: string
  segmen: Segmen
  rataCakupan: number | null
  puskesmasCount: number
  puskesmasList: { nama: string; segmen: Segmen; id: number }[]
  penduduk?: number
  kepadatan?: number
}

export function KecamatanPopup({
  nama,
  segmen,
  rataCakupan,
  puskesmasCount,
  puskesmasList,
  penduduk,
  kepadatan,
}: KecamatanPopupProps) {
  const fmtPenduduk = penduduk ? penduduk.toLocaleString("id-ID") : null
  const fmtKepadatan = kepadatan ? kepadatan.toLocaleString("id-ID") : null

  const listHtml = puskesmasList
    .map(
      (p) =>
        `<li style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${SEGMEN_COLORS[p.segmen]};flex-shrink:0"></span>
          <a href="/puskesmas/${p.id}" style="color:#34d399;text-decoration:underline">${p.nama}</a>
        </li>`
    )
    .join("")

  return `
    <div style="min-width:220px;font-family:system-ui,sans-serif">
      <div style="font-size:15px;font-weight:700;margin-bottom:4px">Kec. ${nama}</div>
      <div style="font-size:13px;display:flex;align-items:center;gap:6px;margin-bottom:6px">
        <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${SEGMEN_COLORS[segmen]}"></span>
        <span style="font-weight:600;color:${SEGMEN_COLORS[segmen]}">${SEGMEN_LABELS[segmen]}</span>
        <span style="color:#94a3b8">| Rata: ${rataCakupan?.toFixed(1) ?? "-"}%</span>
      </div>
      <div style="font-size:12px;color:#94a3b8;margin-bottom:6px">
        Puskesmas: <strong style="color:#e2e8f0">${puskesmasCount}</strong>
        ${fmtPenduduk ? `| Penduduk: <strong style="color:#e2e8f0">${fmtPenduduk}</strong>` : ""}
        ${fmtKepadatan ? `| Kepadatan: <strong style="color:#e2e8f0">${fmtKepadatan}/km²</strong>` : ""}
      </div>
      ${
        puskesmasList.length > 0
          ? `<div style="font-size:12px;color:#94a3b8;margin-bottom:2px">Daftar Puskesmas:</div>
             <ul style="margin:0;padding-left:0;list-style:none;font-size:12px">${listHtml}</ul>`
          : ""
      }
    </div>
  `
}
