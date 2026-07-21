import { PrismaClient } from "@prisma/client"
import { parse, startOfMonth } from "date-fns"
import * as fs from "fs"
import * as path from "path"

const prisma = new PrismaClient()

const KECAMATAN_DATA = [
  { nama: "Koto Tangah", latitude: -0.8872, longitude: 100.3620 },
  { nama: "Padang Utara", latitude: -0.9200, longitude: 100.3580 },
  { nama: "Kuranji", latitude: -0.9070, longitude: 100.3870 },
  { nama: "Padang Timur", latitude: -0.9370, longitude: 100.3700 },
  { nama: "Padang Barat", latitude: -0.9520, longitude: 100.3510 },
  { nama: "Padang Selatan", latitude: -0.9640, longitude: 100.3480 },
  { nama: "Lubuk Begalung", latitude: -0.9690, longitude: 100.3930 },
  { nama: "Lubuk Kilangan", latitude: -0.9810, longitude: 100.4300 },
  { nama: "Nanggalo", latitude: -0.9020, longitude: 100.3750 },
  { nama: "Pauh", latitude: -0.9170, longitude: 100.4080 },
  { nama: "Bungus Teluk Kabung", latitude: -0.9980, longitude: 100.3930 },
]

const PUSKESMAS_DATA = [
  { kode: "PKM01", nama: "AIR DINGIN", kecamatan: "Koto Tangah", latitude: -0.8880, longitude: 100.3600 },
  { kode: "PKM02", nama: "ANAK AIR", kecamatan: "Koto Tangah", latitude: -0.8850, longitude: 100.3650 },
  { kode: "PKM03", nama: "IKUR KOTO", kecamatan: "Koto Tangah", latitude: -0.8850, longitude: 100.3700 },
  { kode: "PKM04", nama: "LB.BUAYA", kecamatan: "Koto Tangah", latitude: -0.8830, longitude: 100.3550 },
  { kode: "PKM05", nama: "TUNGGUL HITAM", kecamatan: "Koto Tangah", latitude: -0.8860, longitude: 100.3580 },
  { kode: "PKM06", nama: "AMBACANG", kecamatan: "Kuranji", latitude: -0.9050, longitude: 100.3850 },
  { kode: "PKM07", nama: "BELIMBING", kecamatan: "Kuranji", latitude: -0.9100, longitude: 100.3900 },
  { kode: "PKM08", nama: "KURANJI", kecamatan: "Kuranji", latitude: -0.9080, longitude: 100.3880 },
  { kode: "PKM09", nama: "LUBUK BEGALUNG", kecamatan: "Lubuk Begalung", latitude: -0.9700, longitude: 100.3950 },
  { kode: "PKM10", nama: "PEGAMBIRAN", kecamatan: "Lubuk Begalung", latitude: -0.9650, longitude: 100.3900 },
  { kode: "PKM11", nama: "LUBUK KILANGAN", kecamatan: "Lubuk Kilangan", latitude: -0.9820, longitude: 100.4330 },
  { kode: "PKM12", nama: "LAPAI", kecamatan: "Nanggalo", latitude: -0.9000, longitude: 100.3730 },
  { kode: "PKM13", nama: "NANGGALO", kecamatan: "Nanggalo", latitude: -0.9030, longitude: 100.3760 },
  { kode: "PKM14", nama: "PADANG PASIR", kecamatan: "Padang Barat", latitude: -0.9500, longitude: 100.3580 },
  { kode: "PKM15", nama: "PEMANCUNGAN", kecamatan: "Padang Selatan", latitude: -0.9750, longitude: 100.3600 },
  { kode: "PKM16", nama: "RAWANG", kecamatan: "Padang Selatan", latitude: -0.9660, longitude: 100.3500 },
  { kode: "PKM17", nama: "SEBERANG PADANG", kecamatan: "Padang Selatan", latitude: -0.9600, longitude: 100.3620 },
  { kode: "PKM18", nama: "ANDALAS", kecamatan: "Padang Timur", latitude: -0.9380, longitude: 100.3680 },
  { kode: "PKM19", nama: "PARAK KARAKAH", kecamatan: "Padang Timur", latitude: -0.9350, longitude: 100.3720 },
  { kode: "PKM20", nama: "AIR TAWAR", kecamatan: "Padang Utara", latitude: -0.9180, longitude: 100.3560 },
  { kode: "PKM21", nama: "ALAI", kecamatan: "Padang Utara", latitude: -0.9220, longitude: 100.3600 },
  { kode: "PKM22", nama: "ULAK KARANG", kecamatan: "Padang Utara", latitude: -0.9150, longitude: 100.3550 },
  { kode: "PKM23", nama: "BUNGUS", kecamatan: "Bungus Teluk Kabung", latitude: -1.0000, longitude: 100.4150 },
  { kode: "PKM24", nama: "PAUH", kecamatan: "Pauh", latitude: -0.8712, longitude: 100.5051 },
]

function parseCSV(filePath: string): Record<string, string>[] {
  const content = fs.readFileSync(filePath, "utf-8").trim()
  const lines = content.split("\n").filter((l) => l.trim())
  if (lines.length < 2) return []

  const headers = lines[0].split(",").map((h) => h.trim())
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim())
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? ""
    })
    rows.push(row)
  }
  return rows
}

async function main() {
  console.log("=== SEED DATABASE SISTEM PREDIKSI ASI EKSKLUSIF ===")
  console.log("Kota Padang, Sumatera Barat")
  console.log()

  // 1. Hapus data lama
  console.log("Membersihkan data lama...")
  await prisma.indikatorSegmen.deleteMany()
  await prisma.shapValue.deleteMany()
  await prisma.prediksi.deleteMany()
  await prisma.dataBulanan.deleteMany()
  await prisma.puskesmas.deleteMany()
  await prisma.kecamatan.deleteMany()
  await prisma.uploadLog.deleteMany()

  // 2. Seed Kecamatan
  console.log("\nMenambahkan 11 Kecamatan...")
  const kecamatanMap = new Map<string, number>()
  for (const k of KECAMATAN_DATA) {
    const created = await prisma.kecamatan.create({
      data: {
        nama: k.nama,
        latitude: k.latitude,
        longitude: k.longitude,
      },
    })
    kecamatanMap.set(k.nama, created.id)
    console.log(`  ✓ ${k.nama}`)
  }

  // 3. Seed Puskesmas
  console.log("\nMenambahkan 24 Puskesmas...")
  const puskesmasMap = new Map<string, number>() // nama -> id
  for (const p of PUSKESMAS_DATA) {
    const kecId = kecamatanMap.get(p.kecamatan)
    const created = await prisma.puskesmas.create({
      data: {
        kode: p.kode,
        nama: p.nama,
        kecamatanId: kecId,
        latitude: p.latitude,
        longitude: p.longitude,
        alamat: `Puskesmas ${p.nama}, Kecamatan ${p.kecamatan}, Kota Padang`,
      },
    })
    puskesmasMap.set(p.nama, created.id)
    console.log(`  ✓ ${p.kode} - ${p.nama} (${p.kecamatan})`)
  }

  // 4. Seed Data Bulanan dari CSV
  console.log("\nMembaca data CSV...")
  const csvPath = path.join(__dirname, "..", "data_master_2021_2025_opsi_b.csv")
  if (!fs.existsSync(csvPath)) {
    console.error(`  ✗ File CSV tidak ditemukan: ${csvPath}`)
    console.log("\nSeed selesai dengan data dasar (kecamatan + puskesmas).")
    return
  }

  const rows = parseCSV(csvPath)
  console.log(`  ${rows.length} baris ditemukan`)

  let inserted = 0
  let skipped = 0
  let errors = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const namaPuskesmas = row["Puskesmas"]
    const tanggalStr = row["Tanggal"]
    const bayiStr = row["Jumlah_Bayi_6_Bulan"]
    const asiStr = row["Jumlah_ASI_Eksklusif"]
    const cakupanStr = row["Persentase_Cakupan"]

    if (!namaPuskesmas || !tanggalStr || !bayiStr || !asiStr) {
      skipped++
      continue
    }

    const puskesmasId = puskesmasMap.get(namaPuskesmas)
    if (!puskesmasId) {
      errors++
      if (errors <= 3) {
        console.log(`  ⚠ Puskesmas "${namaPuskesmas}" tidak ditemukan di mapping`)
      }
      continue
    }

    const parsedDate = parse(tanggalStr, "yyyy-MM-dd", new Date())
    const tanggal = startOfMonth(parsedDate)

    const jumlahBayi = parseFloat(bayiStr)
    const jumlahASI = parseFloat(asiStr)
    const persentase = cakupanStr ? parseFloat(cakupanStr) : null

    if (isNaN(jumlahBayi) || isNaN(jumlahASI)) {
      skipped++
      continue
    }

    try {
      await prisma.dataBulanan.upsert({
        where: {
          puskesmasId_tanggal: {
            puskesmasId,
            tanggal,
          },
        },
        update: {
          jumlahBayi6Bulan: jumlahBayi,
          jumlahASIEksklusif: jumlahASI,
          persentaseCakupan: persentase,
        },
        create: {
          puskesmasId,
          tanggal,
          jumlahBayi6Bulan: jumlahBayi,
          jumlahASIEksklusif: jumlahASI,
          persentaseCakupan: persentase,
        },
      })
      inserted++
    } catch (e) {
      errors++
    }
  }

  console.log(`\n  ✓ ${inserted} baris data berhasil dimasukkan`)
  if (skipped > 0) console.log(`  ⚠ ${skipped} baris dilewati`)
  if (errors > 0) console.log(`  ✗ ${errors} error`)

  // 5. Seed IndikatorSegmen (berdasarkan data terbaru per puskesmas)
  console.log("\nMenghitung Indikator Segmen...")
  const getSegmen = (nilai: number | null): string | null => {
    if (nilai === null || nilai === undefined) return null
    if (nilai >= 80) return "Tinggi"
    if (nilai >= 60) return "Sedang"
    return "Rendah"
  }

  let segmenInserted = 0
  const allPuskesmas = await prisma.puskesmas.findMany({ select: { id: true, nama: true } })

  for (const pkm of allPuskesmas) {
    const latestData = await prisma.dataBulanan.findMany({
      where: { puskesmasId: pkm.id },
      orderBy: { tanggal: "desc" },
      take: 12,
    })

    if (latestData.length === 0) continue

    // Seed every month's segment for historical data
    for (const d of latestData) {
      await prisma.indikatorSegmen.upsert({
        where: { puskesmasId_bulan: { puskesmasId: pkm.id, bulan: d.tanggal } },
        update: {
          nilai_aktual: d.persentaseCakupan,
          segmen_aktual: getSegmen(d.persentaseCakupan),
        },
        create: {
          puskesmasId: pkm.id,
          bulan: d.tanggal,
          nilai_aktual: d.persentaseCakupan,
          segmen_aktual: getSegmen(d.persentaseCakupan),
        },
      })
      segmenInserted++
    }
  }
  console.log(`  ${segmenInserted} segmen telah dibuat`)

  // 6. Verifikasi
  const totalKecamatan = await prisma.kecamatan.count()
  const totalPuskesmas = await prisma.puskesmas.count()
  const totalData = await prisma.dataBulanan.count()
  const avgCakupan = await prisma.dataBulanan.aggregate({
    _avg: { persentaseCakupan: true },
  })
  const totalSegmen = await prisma.indikatorSegmen.count()

  console.log("\n=== VERIFIKASI ===")
  console.log(`  Kecamatan     : ${totalKecamatan}`)
  console.log(`  Puskesmas     : ${totalPuskesmas}`)
  console.log(`  Data Bulanan  : ${totalData} baris`)
  console.log(`  Indikator Segmen : ${totalSegmen} baris`)
  console.log(`  Rata-rata Cakupan : ${avgCakupan._avg.persentaseCakupan?.toFixed(2) ?? "-"}%`)
  console.log("\nSeed selesai!")
}

main()
  .catch((e) => {
    console.error("Seed error:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
