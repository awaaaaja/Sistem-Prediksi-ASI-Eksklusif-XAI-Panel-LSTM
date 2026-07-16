import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const data = await prisma.puskesmas.findUnique({
    where: { id: Number(params.id) },
    include: { kecamatan: true },
  })
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  return NextResponse.json(data)
}
