import { toISODate, todayISO } from './format'

export interface ReceiptGuess {
  /** Centavos. */
  amount?: number
  date?: string
  merchant?: string
  /** Nombre de categoría sugerida. */
  category?: string
}

const AMOUNT = /\$?\s*(\d{1,3}(?:,\d{3})+(?:\.\d{2})?|\d+\.\d{2})(?!\d)/g

const amountsIn = (line: string) => [...line.matchAll(AMOUNT)].map((m) => Math.round(Number.parseFloat(m[1].replace(/,/g, '')) * 100))

const CATEGORY_HINTS: [RegExp, string][] = [
  [/pemex|gasolin|oxxo gas|g500|\bbp\b|shell|mobil|hidrosina|arco/i, 'Gasolina'],
  [/walmart|bodega aurrer|soriana|chedraui|costco|sam'?s|h-?e-?b|la comer|superama|city market|oxxo|7-?eleven|circle k|super/i, 'Súper'],
  [/farmacia|benavides|guadalajara|similares|san pablo|hospital|cl[ií]nica/i, 'Salud'],
  [/restaur|cafe|caf[eé]|starbucks|taquer|tacos|pizza|burger|mcdonald|kfc|domino|sushi|cocina|bar\b/i, 'Comida'],
  [/cin[eé]polis|cinemex|ticketmaster/i, 'Entretenimiento'],
  [/liverpool|palacio de hierro|coppel|elektra|zara|h&m|amazon|mercado libre|sears|suburbia/i, 'Compras'],
  [/uber|didi|metro|autob[uú]s|ado\b|caseta|estacionamiento/i, 'Transporte'],
  [/cfe|telmex|totalplay|izzi|megacable|agua|naturgy/i, 'Servicios'],
]

export const guessCategory = (text: string) => CATEGORY_HINTS.find(([re]) => re.test(text))?.[1]

/** Saca monto total, fecha, comercio y categoría probable del texto de un ticket. */
export function parseReceipt(text: string): ReceiptGuess {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const guess: ReceiptGuess = {}

  // El total: la línea "TOTAL" (no subtotal); si no hay, el monto más grande.
  const totalLines = lines.filter((l) => /total/i.test(l) && !/sub\s*-?total/i.test(l))
  for (const l of totalLines) {
    const found = amountsIn(l)
    if (found.length) {
      guess.amount = found[found.length - 1]
      break
    }
  }
  if (!guess.amount) {
    const all = lines.flatMap(amountsIn).filter((a) => a < 10_000_000)
    if (all.length) guess.amount = Math.max(...all)
  }

  // Fecha en formato mexicano dd/mm/aaaa o aaaa-mm-dd.
  const today = todayISO()
  for (const l of lines) {
    const iso = l.match(/(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/)
    const dmy = l.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/)
    let date: string | undefined
    if (iso) date = toISODate(new Date(+iso[1], +iso[2] - 1, +iso[3]))
    else if (dmy) {
      const y = dmy[3].length === 2 ? 2000 + +dmy[3] : +dmy[3]
      if (+dmy[2] <= 12) date = toISODate(new Date(y, +dmy[2] - 1, +dmy[1]))
    }
    if (date && date <= today && date > '2000-01-01') {
      guess.date = date
      break
    }
  }

  guess.merchant = lines.find((l) => (l.match(/[a-záéíóúñ]/gi)?.length ?? 0) >= 3 && !/ticket|factura|rfc|fecha|hora|tel/i.test(l))?.slice(0, 40)

  guess.category = guessCategory(text)
  return guess
}

/** Reduce la foto para que el OCR sea más rápido en el iPhone. */
async function shrink(file: File, maxSide = 1600): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.filter = 'grayscale(1) contrast(1.4)'
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), 'image/jpeg', 0.9))
}

/** Lee el ticket con OCR en el propio teléfono. Necesita internet la primera vez para bajar el idioma. */
export async function scanReceipt(file: File, onProgress?: (p: number) => void): Promise<ReceiptGuess> {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('spa', 1, {
    logger: (m) => m.status === 'recognizing text' && onProgress?.(m.progress),
  })
  try {
    const { data } = await worker.recognize(await shrink(file))
    return parseReceipt(data.text)
  } finally {
    await worker.terminate()
  }
}
