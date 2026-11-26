import { useEffect, useState } from 'react'

export interface ToastMsg {
  id: number
  text: string
  /** Acción opcional, normalmente "Deshacer". */
  action?: { label: string; run: () => void | Promise<void> }
}

let current: ToastMsg | null = null
const listeners = new Set<(t: ToastMsg | null) => void>()
let timer: ReturnType<typeof setTimeout> | undefined

function emit(t: ToastMsg | null) {
  current = t
  listeners.forEach((l) => l(t))
}

/** Muestra un aviso breve abajo de la pantalla. */
export function toast(text: string, action?: ToastMsg['action']) {
  clearTimeout(timer)
  emit({ id: Date.now(), text, action })
  timer = setTimeout(() => emit(null), action ? 5000 : 2500)
}

export function dismissToast() {
  clearTimeout(timer)
  emit(null)
}

export function useToast(): ToastMsg | null {
  const [t, setT] = useState(current)
  useEffect(() => {
    listeners.add(setT)
    return () => {
      listeners.delete(setT)
    }
  }, [])
  return t
}
