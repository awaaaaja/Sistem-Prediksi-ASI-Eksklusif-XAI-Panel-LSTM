import { NextRequest, NextResponse } from "next/server"
import { validateUpload, appendData } from "@/lib/actions/upload"

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const action = req.nextUrl.searchParams.get("action") || "append"

    if (action === "preview") {
      const result = await validateUpload(formData)
      return NextResponse.json({ success: true, ...result })
    }

    const result = await appendData(formData)
    return NextResponse.json(result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error"
    return NextResponse.json({ success: false, error: msg }, { status: 400 })
  }
}
