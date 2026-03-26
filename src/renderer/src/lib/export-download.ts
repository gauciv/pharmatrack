export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()

  window.setTimeout(() => {
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }, 1000)
}

export function downloadTextFile(content: string, fileName: string, mimeType: string): void {
  downloadBlob(new Blob([content], { type: mimeType }), fileName)
}

export function downloadPdf(doc: { output: (type: 'arraybuffer') => ArrayBuffer }, fileName: string): void {
  const buffer = doc.output('arraybuffer')
  downloadBlob(new Blob([buffer], { type: 'application/pdf' }), fileName)
}
