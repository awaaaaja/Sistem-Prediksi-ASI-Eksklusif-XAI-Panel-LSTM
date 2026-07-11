import jsPDF from "jspdf"
import html2canvas from "html2canvas"

export async function generatePDF(
  elementId: string,
  filename: string = "laporan.pdf"
) {
  const element = document.getElementById(elementId)
  if (!element) return

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#0f172a",
    logging: false,
  })

  const imgData = canvas.toDataURL("image/png")
  const pdf = new jsPDF("p", "mm", "a4")
  const pdfWidth = pdf.internal.pageSize.getWidth()
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width

  let heightLeft = pdfHeight
  let position = 0
  const pageHeight = pdf.internal.pageSize.getHeight()

  pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight)
  heightLeft -= pageHeight

  while (heightLeft > 0) {
    position = heightLeft - pdfHeight
    pdf.addPage()
    pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight)
    heightLeft -= pageHeight
  }

  pdf.save(filename)
}

export function formatDate(): string {
  return new Date().toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}
