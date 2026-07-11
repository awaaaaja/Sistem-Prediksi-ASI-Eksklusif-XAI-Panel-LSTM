import { PrismaClient } from "@prisma/client"
import { addMonths, startOfMonth } from "date-fns"

const prisma = new PrismaClient()

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

async function main() {
  const puskesmasList = [
    { kode: "PKM01", nama: "Puskesmas A", kota: "Kota A" },
    { kode: "PKM02", nama: "Puskesmas B", kota: "Kota B" },
    { kode: "PKM03", nama: "Puskesmas C", kota: "Kota A" },
    { kode: "PKM04", nama: "Puskesmas D", kota: "Kota C" },
    { kode: "PKM05", nama: "Puskesmas E", kota: "Kota B" },
    { kode: "PKM06", nama: "Puskesmas F", kota: "Kota A" },
    { kode: "PKM07", nama: "Puskesmas G", kota: "Kota C" },
    { kode: "PKM08", nama: "Puskesmas H", kota: "Kota D" },
    { kode: "PKM09", nama: "Puskesmas I", kota: "Kota D" },
    { kode: "PKM10", nama: "Puskesmas J", kota: "Kota A" },
    { kode: "PKM11", nama: "Puskesmas K", kota: "Kota B" },
    { kode: "PKM12", nama: "Puskesmas L", kota: "Kota E" },
    { kode: "PKM13", nama: "Puskesmas M", kota: "Kota E" },
    { kode: "PKM14", nama: "Puskesmas N", kota: "Kota C" },
    { kode: "PKM15", nama: "Puskesmas O", kota: "Kota B" },
    { kode: "PKM16", nama: "Puskesmas P", kota: "Kota A" },
    { kode: "PKM17", nama: "Puskesmas Q", kota: "Kota D" },
    { kode: "PKM18", nama: "Puskesmas R", kota: "Kota E" },
    { kode: "PKM19", nama: "Puskesmas S", kota: "Kota C" },
    { kode: "PKM20", nama: "Puskesmas T", kota: "Kota A" },
    { kode: "PKM21", nama: "Puskesmas U", kota: "Kota B" },
    { kode: "PKM22", nama: "Puskesmas V", kota: "Kota D" },
    { kode: "PKM23", nama: "Puskesmas W", kota: "Kota E" },
    { kode: "PKM24", nama: "Puskesmas X", kota: "Kota C" },
  ]

  console.log("Seeding 24 Puskesmas...")
  for (const p of puskesmasList) {
    await prisma.puskesmas.upsert({
      where: { kode: p.kode },
      update: { nama: p.nama, kota: p.kota },
      create: { kode: p.kode, nama: p.nama, kota: p.kota },
    })
  }

  const startDate = startOfMonth(new Date("2021-01-01"))
  const months = 48

  console.log(`Seeding ${months} bulan data historis untuk 24 Puskesmas...`)
  for (let m = 0; m < months; m++) {
    const tanggal = addMonths(startDate, m)
    for (const p of puskesmasList) {
      const puskesmas = await prisma.puskesmas.findUnique({
        where: { kode: p.kode },
      })
      if (!puskesmas) continue

      const bayi = randomInt(30, 80)
      const asi = randomInt(25, 70)
      const persentase = Math.round((asi / bayi) * 1000) / 100

      const existing = await prisma.dataBulanan.findUnique({
        where: {
          puskesmasId_tanggal: {
            puskesmasId: puskesmas.id,
            tanggal,
          },
        },
      })

      if (!existing) {
        await prisma.dataBulanan.create({
          data: {
            puskesmasId: puskesmas.id,
            tanggal,
            jumlahBayi6Bulan: bayi,
            jumlahASIEksklusif: asi,
            persentaseCakupan: persentase,
          },
        })
      }
    }
  }

  console.log("Seed selesai!")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
