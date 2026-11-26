import type { Transaction } from '../db'
import { formatMoney, toISODate } from '../format'
import type { AppData } from '../hooks'

/** "10:05 a. m. · 15 nov" para listas sin encabezado de día. */
function when(tx: Transaction): string {
  const [y, m, d] = tx.date.split('-').map(Number)
  const date = new Date(y, m - 1, d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }).replace('.', '')
  const created = new Date(tx.createdAt)
  if (toISODate(created) !== tx.date) return date
  return `${created.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })} · ${date}`
}

export function TxRow({ tx, data, onClick, showDate }: { tx: Transaction; data: AppData; onClick: () => void; showDate?: boolean }) {
  const cat = data.categoryById.get(tx.categoryId ?? '')
  const account = data.accountById.get(tx.accountId)
  const isTransfer = tx.type === 'transfer'
  const title = isTransfer ? 'Transferencia' : (cat?.name ?? 'Sin categoría')
  const detail = isTransfer ? `${account?.name ?? '?'} → ${data.accountById.get(tx.toAccountId ?? '')?.name ?? '?'}` : [tx.note, account?.name].filter(Boolean).join(' · ')
  const subtitle = showDate ? [when(tx), detail].filter(Boolean).join(' · ') : detail
  const sign = tx.type === 'expense' ? '−' : tx.type === 'income' ? '+' : ''

  return (
    <button className="row" onClick={onClick}>
      <span className="row-icon" style={{ background: isTransfer ? '#8e8e9333' : `${cat?.color ?? '#8e8e93'}33` }}>
        {isTransfer ? '⇄' : (cat?.icon ?? '•')}
      </span>
      <span className="row-text">
        <span className="row-title">{title}</span>
        {subtitle && <span className="row-sub">{subtitle}</span>}
      </span>
      <span className={`row-amount ${tx.type}`}>
        {sign}
        {formatMoney(tx.amount)}
      </span>
    </button>
  )
}
