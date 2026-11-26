/** Reduce una foto y la convierte a data URL JPEG para guardarla junto al movimiento. */
export async function photoToDataURL(file: Blob, maxSide = 1000, quality = 0.72): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()
  return canvas.toDataURL('image/jpeg', quality)
}

/** "Viaje CDMX" → "viaje-cdmx" */
export function normalizeTag(raw: string): string {
  return raw
    .trim()
    .replace(/^#+/, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}_-]/gu, '')
    .slice(0, 24)
}
