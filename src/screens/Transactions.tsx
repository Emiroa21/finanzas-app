import { useState } from 'react'
import { MonthPicker } from '../components/MonthPicker'
import { TxRow } from '../components/TxRow'
import type { Transaction, TxType } from '../db'
import { currentMonth, dayLabel, formatMoney } from '../format'
import { monthTotals, type AppData } from '../hooks'

export function Transactions({ data, onEdit }: { data: AppData; onEdit: (tx: Transaction) => void }) {
  const [month, setMonth] = useState(currentMonth())
  const [query, setQuery] = useState('')
  const [accountId, setAccountId] = useState('')
  const [kind, setKind] = useState<TxType | ''>('')
  const totals = monthTotals(data.transactions, month)

  const q = query.trim().toLowerCase()
  const list = data.transactions.filter((t) => {
    if (!t.date.startsWith(month)) return false
    if (kind && t.type !== kind) return false
    if (accountId && t.accountId !== accountId && t.toAccountId !== accountId) return false
    if (!q) return true
    const cat = data.categoryById.get(t.categoryId ?? '')?.name ?? ''
    return t.note.toLowerCase().includes(q) || cat.toLowerCase().includes(q) || String(t.amount / 100).includes(q)
  })

  const groups = new Map<string, Transaction[]>()
  for (const t of list) groups.set(t.date, [...(groups.get(t.date) ?? []), t])

  return (
    <>
      <h1 className="title">Historial</h1>
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

      <div className="seg-chips">
        {(
          [
            ['', 'Todos'],
            ['expense', 'Gastos'],
            ['income', 'Ingresos'],
            ['transfer', 'Transferencias'],
          ] as [TxType | '', string][]
        ).map(([k, label]) => (
          <button key={k} className={k === kind ? 'on' : ''} onClick={() => setKind(k)}>
            {label}
          </button>
        ))}
      </div>

      <section className="card month-card">
        <div>
          <span className="muted">Ingresos</span>
          <strong className="income">{formatMoney(totals.income)}</strong>
        </div>
        <div>
          <span className="muted">Gastos</span>
          <strong className="expense">{formatMoney(totals.expense)}</strong>
        </div>
        <div>
          <span className="muted">Balance</span>
          <strong>{formatMoney(totals.income - totals.expense)}</strong>
        </div>
      </section>

      {list.length === 0 ? (
        <p className="empty">{data.transactions.some((t) => t.date.startsWith(month)) ? 'No hay movimientos con estos filtros.' : 'Sin movimientos este mes. Toca + para registrar uno.'}</p>
      ) : (
        <section className="card list-card day-list">
          {[...groups].map(([date, txs]) => {
            const net = txs.reduce((s, t) => s + (t.type === 'income' ? t.amount : t.type === 'expense' ? -t.amount : 0), 0)
            return (
              <div key={date} className="day-group">
                <div className="day-head">
                  <span>{dayLabel(date)}</span>
                  <span className={net > 0 ? 'income' : ''}>{net > 0 ? '+' : ''}{formatMoney(net)}</span>
                </div>
                {txs.map((t) => (
                  <TxRow key={t.id} tx={t} data={data} onClick={() => onEdit(t)} />
                ))}
              </div>
            )
          })}
        </section>
      )}
    </>
  )
}
