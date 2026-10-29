import type { Transaction } from '../db'
import { formatMoney } from '../format'
import type { AppData } from '../hooks'

export function TxRow({ tx, data, onClick }: { tx: Transaction; data: AppData; onClick: () => void }) {
  const cat = data.categoryById.get(tx.categoryId ?? '')
  const account = data.accountById.get(tx.accountId)
  const isTransfer = tx.type === 'transfer'
  const title = isTransfer ? 'Transferencia' : (cat?.name ?? 'Sin categoría')
  const subtitle = isTransfer ? `${account?.name ?? '?'} → ${data.accountById.get(tx.toAccountId ?? '')?.name ?? '?'}` : [tx.note, account?.name].filter(Boolean).join(' · ')
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
