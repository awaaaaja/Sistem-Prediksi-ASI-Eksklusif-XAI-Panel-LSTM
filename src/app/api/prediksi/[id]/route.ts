import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const data = await prisma.prediksi.findMany({
    where: { puskesmasId: Number(params.id) },
    orderBy: { createdAt: "desc" },
    take: 20,
  })
  return NextResponse.json(data)
}
