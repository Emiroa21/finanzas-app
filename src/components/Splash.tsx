import { useEffect, useState } from 'react'

const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
const MIN_MS = reduced ? 300 : 1500

function Bill({ i }: { i: number }) {
  return (
    <svg className="bill" style={{ animationDelay: `${i * 0.16}s`, top: 70 - i * 16 }} viewBox="0 0 120 60" width="132" height="66" aria-hidden="true">
      <rect x="1" y="1" width="118" height="58" rx="6" fill="#2f9e5b" stroke="#1d6b3c" strokeWidth="2" />
      <rect x="8" y="8" width="104" height="44" rx="4" fill="none" stroke="#bff0cf" strokeWidth="1.5" strokeDasharray="3 3" />
      <circle cx="60" cy="30" r="13" fill="#bff0cf" />
      <text x="60" y="36" textAnchor="middle" fontSize="17" fontWeight="800" fill="#1d6b3c">
        $
      </text>
    </svg>
  )
}

/** Pantalla de arranque: billetes que caen, nombre y barra de carga. */
export function Splash({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const [elapsed, setElapsed] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setElapsed(true), MIN_MS)
    return () => clearTimeout(t)
  }, [])
  useEffect(() => {
    if (elapsed && ready) onDone()
  }, [elapsed, ready, onDone])

  return (
    <div className="splash" role="status" aria-label="Abriendo Mis Finanzas">
      <div className="bills">
        {[0, 1, 2, 3].map((i) => (
          <Bill key={i} i={i} />
        ))}
      </div>
      <h1>
        Mis Finanzas<span>.</span>
      </h1>
      <p>Tus cuentas, gastos y metas en un solo lugar.</p>
      <span className="splash-bar">
        <span style={{ animationDuration: `${MIN_MS}ms` }} />
      </span>
    </div>
  )
}
