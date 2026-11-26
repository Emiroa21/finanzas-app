import { useEffect, useRef, useState } from 'react'
import { db, newId, type Transaction } from '../db'
import { formatMoney, toISODate, todayISO } from '../format'
import type { AppData } from '../hooks'
import { toast } from '../toast'

/** "10:05 a. m. · 15 nov" para listas sin encabezado de día. */
function when(tx: Transaction): string {
  const [y, m, d] = tx.date.split('-').map(Number)
  const date = new Date(y, m - 1, d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }).replace('.', '')
  const created = new Date(tx.createdAt)
  if (toISODate(created) !== tx.date) return date
  return `${created.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })} · ${date}`
}

const OPEN = -152
/** Solo una fila abierta a la vez. */
const OPEN_EVENT = 'txrow-open'

async function removeTx(tx: Transaction) {
  await db.transactions.delete(tx.id)
  toast('Movimiento borrado', { label: 'Deshacer', run: () => db.transactions.put(tx).then(() => undefined) })
}

async function duplicateTx(tx: Transaction) {
  const copy: Transaction = { ...tx, id: newId(), date: todayISO(), createdAt: Date.now(), recurringId: undefined, dueDate: undefined }
  await db.transactions.add(copy)
  toast(`Duplicado para hoy · ${formatMoney(tx.amount)}`, { label: 'Deshacer', run: () => db.transactions.delete(copy.id) })
}

export function TxRow({ tx, data, onClick, showDate }: { tx: Transaction; data: AppData; onClick: () => void; showDate?: boolean }) {
  const cat = data.categoryById.get(tx.categoryId ?? '')
  const account = data.accountById.get(tx.accountId)
  const isTransfer = tx.type === 'transfer'
  const title = isTransfer ? 'Transferencia' : (cat?.name ?? 'Sin categoría')
  const detail = isTransfer ? `${account?.name ?? '?'} → ${data.accountById.get(tx.toAccountId ?? '')?.name ?? '?'}` : [tx.note, account?.name].filter(Boolean).join(' · ')
  const subtitle = showDate ? [when(tx), detail].filter(Boolean).join(' · ') : detail
  const sign = tx.type === 'expense' ? '−' : tx.type === 'income' ? '+' : ''

  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const start = useRef<{ x: number; y: number; base: number; horizontal: boolean | null } | null>(null)
  const moved = useRef(false)

  useEffect(() => {
    const close = (e: Event) => (e as CustomEvent).detail !== tx.id && setDx(0)
    window.addEventListener(OPEN_EVENT, close)
    return () => window.removeEventListener(OPEN_EVENT, close)
  }, [tx.id])

  const onDown = (e: React.PointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY, base: dx, horizontal: null }
    moved.current = false
  }
  const onMove = (e: React.PointerEvent) => {
    const s = start.current
    if (!s) return
    const ddx = e.clientX - s.x
    const ddy = e.clientY - s.y
    if (s.horizontal === null && Math.abs(ddx) + Math.abs(ddy) > 8) {
      s.horizontal = Math.abs(ddx) > Math.abs(ddy)
      if (s.horizontal) (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    }
    if (!s.horizontal) return
    moved.current = true
    setDragging(true)
    setDx(Math.max(OPEN - 40, Math.min(0, s.base + ddx)))
  }
  const onUp = () => {
    const s = start.current
    start.current = null
    setDragging(false)
    if (!s?.horizontal) return
    const open = dx < OPEN / 2.5
    setDx(open ? OPEN : 0)
    if (open) window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: tx.id }))
  }

  return (
    <div className="swipe">
      <div className="swipe-actions" aria-hidden={dx === 0}>
        <button className="swipe-dup" tabIndex={dx === 0 ? -1 : 0} onClick={() => (setDx(0), duplicateTx(tx))}>
          ⧉<span>Duplicar</span>
        </button>
        <button className="swipe-del" tabIndex={dx === 0 ? -1 : 0} onClick={() => removeTx(tx)}>
          🗑<span>Borrar</span>
        </button>
      </div>
      <button
        className={`row swipe-front ${dragging ? 'dragging' : ''}`}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onClick={() => {
          if (moved.current) return
          if (dx !== 0) return setDx(0)
          onClick()
        }}
      >
        <span className="row-icon" style={{ background: isTransfer ? '#8e8e9333' : `${cat?.color ?? '#8e8e93'}33` }}>
          {isTransfer ? '⇄' : (cat?.icon ?? '•')}
        </span>
        <span className="row-text">
          <span className="row-title">
            {title}
            {tx.photo && <span className="row-clip" aria-label="Con foto"> 📎</span>}
          </span>
          {subtitle && <span className="row-sub">{subtitle}</span>}
          {tx.tags && tx.tags.length > 0 && (
            <span className="row-tags">
              {tx.tags.map((t) => (
                <span key={t} className="tag">
                  #{t}
                </span>
              ))}
            </span>
          )}
        </span>
        <span className={`row-amount ${tx.type}`}>
          {sign}
          {formatMoney(tx.amount)}
        </span>
      </button>
    </div>
  )
}
