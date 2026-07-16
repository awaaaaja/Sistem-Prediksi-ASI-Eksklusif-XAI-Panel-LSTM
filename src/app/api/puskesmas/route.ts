import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const data = await prisma.puskesmas.findMany({
    orderBy: { kode: "asc" },
    include: { kecamatan: true },
  })
  return NextResponse.json(data)
}
