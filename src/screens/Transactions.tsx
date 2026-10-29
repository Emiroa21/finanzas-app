import { useState } from 'react'
import { MonthPicker } from '../components/MonthPicker'
import { TxRow } from '../components/TxRow'
import type { Transaction } from '../db'
import { currentMonth, dayLabel, formatMoney } from '../format'
import type { AppData } from '../hooks'

export function Transactions({ data, onEdit }: { data: AppData; onEdit: (tx: Transaction) => void }) {
  const [month, setMonth] = useState(currentMonth())
  const [query, setQuery] = useState('')
  const [accountId, setAccountId] = useState('')

  const q = query.trim().toLowerCase()
  const list = data.transactions.filter((t) => {
    if (!t.date.startsWith(month)) return false
    if (accountId && t.accountId !== accountId && t.toAccountId !== accountId) return false
    if (!q) return true
    const cat = data.categoryById.get(t.categoryId ?? '')?.name ?? ''
    return t.note.toLowerCase().includes(q) || cat.toLowerCase().includes(q) || String(t.amount / 100).includes(q)
  })

  const groups = new Map<string, Transaction[]>()
  for (const t of list) groups.set(t.date, [...(groups.get(t.date) ?? []), t])

  return (
    <>
      <h1 className="title">Movimientos</h1>
      <MonthPicker month={month} onChange={setMonth} />
      <div className="filters">
        <input type="search" placeholder="Buscar nota, categoría o monto" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select value={accountId} onChange={(e) => setAccountId(e.target.value)} aria-label="Cuenta">
          <option value="">Todas</option>
          {data.accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      {list.length === 0 && <p className="empty">No hay movimientos con estos filtros.</p>}

      {[...groups].map(([date, txs]) => {
        const net = txs.reduce((s, t) => s + (t.type === 'income' ? t.amount : t.type === 'expense' ? -t.amount : 0), 0)
        return (
          <section key={date} className="card list-card">
            <div className="card-title small">
              <span>{dayLabel(date)}</span>
              <span className="muted">{formatMoney(net)}</span>
            </div>
            {txs.map((t) => (
              <TxRow key={t.id} tx={t} data={data} onClick={() => onEdit(t)} />
            ))}
          </section>
        )
      })}
    </>
  )
}
