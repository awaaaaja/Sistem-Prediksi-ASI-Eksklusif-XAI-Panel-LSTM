import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const data = await prisma.dataBulanan.findMany({
    where: { puskesmasId: Number(params.id) },
    orderBy: { tanggal: "asc" },
    take: 48,
  })
  return NextResponse.json(data)
}
