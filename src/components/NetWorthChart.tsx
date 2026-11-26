import { useState } from 'react'
import { daysInMonth, formatMoney, monthLabel, shiftMonth } from '../format'
import type { AppData } from '../hooks'

/** Patrimonio (suma de saldos de todas las cuentas) al cierre de cada mes. */
export function netWorthSeries(data: AppData, lastMonth: string, count = 12): { m: string; value: number }[] {
  const months = Array.from({ length: count }, (_, i) => shiftMonth(lastMonth, i - (count - 1)))
  const ends = months.map((m) => `${m}-${String(daysInMonth(m)).padStart(2, '0')}`)
  const base = data.accounts.reduce((s, a) => s + a.initialBalance, 0)
  const known = new Set(data.accounts.map((a) => a.id))
  const values = ends.map(() => base)
  for (const t of data.transactions) {
    let delta = 0
    if (t.type === 'income') delta = known.has(t.accountId) ? t.amount : 0
    else if (t.type === 'expense') delta = known.has(t.accountId) ? -t.amount : 0
    else delta = (known.has(t.toAccountId ?? '') ? t.amount : 0) - (known.has(t.accountId) ? t.amount : 0)
    if (!delta) continue
    for (let i = 0; i < ends.length; i++) if (t.date <= ends[i]) values[i] += delta
  }
  return months.map((m, i) => ({ m, value: values[i] }))
}

const W = 340
const H = 150
const PAD = { l: 8, r: 8, t: 14, b: 22 }

export function NetWorthChart({ data, month }: { data: AppData; month: string }) {
  const series = netWorthSeries(data, month)
  const [hover, setHover] = useState<number | null>(null)
  const values = series.map((p) => p.value)
  let min = Math.min(...values)
  let max = Math.max(...values)
  if (min === max) {
    min -= 100_00
    max += 100_00
  }
  const span = max - min
  min -= span * 0.08
  max += span * 0.08
  const x = (i: number) => PAD.l + (i / (series.length - 1)) * (W - PAD.l - PAD.r)
  const y = (v: number) => PAD.t + (1 - (v - min) / (max - min)) * (H - PAD.t - PAD.b)
  const line = series.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const area = `${line} L${x(series.length - 1)},${H - PAD.b} L${x(0)},${H - PAD.b} Z`
  const last = series[series.length - 1]
  const prev = series[series.length - 2]
  const change = last.value - prev.value
  const shown = hover ?? series.length - 1
  const grid = [0.25, 0.5, 0.75].map((f) => PAD.t + f * (H - PAD.t - PAD.b))

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    const i = Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * (series.length - 1))
    setHover(Math.max(0, Math.min(series.length - 1, i)))
  }

  return (
    <section className="card">
      <div className="card-title">
        <span>Patrimonio</span>
        <span className="muted">últimos 12 meses</span>
      </div>
      <div className="nw-head">
        <strong>{formatMoney(series[shown].value)}</strong>
        {hover === null ? (
          <span className={change >= 0 ? 'income' : 'expense'}>
            {change >= 0 ? '▲' : '▼'} {formatMoney(Math.abs(change))} vs. {monthLabel(prev.m, true).toLowerCase()}
          </span>
        ) : (
          <span className="muted">al cierre de {monthLabel(series[shown].m).toLowerCase()}</span>
        )}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="nw-chart"
        role="img"
        aria-label={`Patrimonio de ${monthLabel(series[0].m)} a ${monthLabel(last.m)}: de ${formatMoney(series[0].value)} a ${formatMoney(last.value)}`}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="nw-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.22" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {grid.map((gy) => (
          <line key={gy} x1={PAD.l} x2={W - PAD.r} y1={gy} y2={gy} className="nw-grid" />
        ))}
        <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} className="nw-axis" />
        <path d={area} fill="url(#nw-fill)" />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.t - 6} y2={H - PAD.b} className="nw-cross" />}
        <circle cx={x(shown)} cy={y(series[shown].value)} r="5" fill="var(--accent)" stroke="var(--card)" strokeWidth="2" />
        {series.map((p, i) =>
          i % 2 === (series.length - 1) % 2 ? (
            <text key={p.m} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === series.length - 1 ? 'end' : 'middle'} className={`nw-label ${i === shown ? 'on' : ''}`}>
              {monthLabel(p.m, true).replace('.', '')}
            </text>
          ) : null,
        )}
      </svg>
      <p className="hint">Suma de los saldos de todas tus cuentas al cierre de cada mes; las tarjetas de crédito restan. Toca la gráfica para ver cada mes.</p>
    </section>
  )
}
