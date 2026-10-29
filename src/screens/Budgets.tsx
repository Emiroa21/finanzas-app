import { useState } from 'react'
import { MonthPicker } from '../components/MonthPicker'
import { Sheet } from '../components/Sheet'
import { db, newId } from '../db'
import { centsToInput, currentMonth, daysInMonth, formatMoney, parseToCents } from '../format'
import { monthTotals, type AppData } from '../hooks'
import { Progress } from './Home'

export function Budgets({ data }: { data: AppData }) {
  const [month, setMonth] = useState(currentMonth())
  const [editing, setEditing] = useState(false)
  const totals = monthTotals(data.transactions, month)
  const isCurrent = month === currentMonth()
  const daysLeft = daysInMonth(month) - new Date().getDate() + 1

  const rows = data.budgets
    .map((b) => ({ b, cat: data.categoryById.get(b.categoryId), spent: totals.byCategory.get(b.categoryId) ?? 0 }))
    .sort((x, y) => y.spent / y.b.amount - x.spent / x.b.amount)
  const limit = rows.reduce((s, r) => s + r.b.amount, 0)
  const spent = rows.reduce((s, r) => s + r.spent, 0)

  return (
    <>
      <MonthPicker month={month} onChange={setMonth} />

      {rows.length === 0 ? (
        <section className="card">
          <p className="empty">Define cuánto quieres gastar al mes en cada categoría y aquí verás cuánto te queda.</p>
          <button className="primary-btn" onClick={() => setEditing(true)}>
            Crear presupuestos
          </button>
        </section>
      ) : (
        <>
          <section className="card">
            <div className="card-title">
              <span>Total</span>
              <button className="link" onClick={() => setEditing(true)}>
                Editar
              </button>
            </div>
            <div className="card-title small">
              <span />
              <span className="muted">
                {formatMoney(spent)} de {formatMoney(limit)}
              </span>
            </div>
            <Progress value={spent} max={limit} />
            <p className="hint">
              {limit - spent >= 0 ? `Te quedan ${formatMoney(limit - spent)}` : `Te pasaste por ${formatMoney(spent - limit)}`}
              {isCurrent && limit - spent > 0 && ` · ${formatMoney(Math.floor((limit - spent) / daysLeft))} por día`}
            </p>
          </section>

          <section className="card">
            {rows.map(({ b, cat, spent }) => (
              <div key={b.id} className="budget-row">
                <div className="card-title small">
                  <span>
                    {cat?.icon} {cat?.name ?? 'Categoría borrada'}
                  </span>
                  <span className="muted">
                    {formatMoney(spent)} / {formatMoney(b.amount)}
                  </span>
                </div>
                <Progress value={spent} max={b.amount} />
                <p className="hint">{b.amount - spent >= 0 ? `Quedan ${formatMoney(b.amount - spent)}` : `Excedido por ${formatMoney(spent - b.amount)}`}</p>
              </div>
            ))}
          </section>
        </>
      )}

      {editing && <BudgetEditor data={data} onClose={() => setEditing(false)} />}
    </>
  )
}

function BudgetEditor({ data, onClose }: { data: AppData; onClose: () => void }) {
  const byCat = new Map(data.budgets.map((b) => [b.categoryId, b]))
  const expenseCats = data.categories.filter((c) => c.kind === 'expense')
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(expenseCats.map((c) => [c.id, byCat.has(c.id) ? centsToInput(byCat.get(c.id)!.amount) : ''])))

  const save = async () => {
    await db.transaction('rw', db.budgets, async () => {
      for (const c of expenseCats) {
        const cents = parseToCents(values[c.id] ?? '')
        const existing = byCat.get(c.id)
        if (cents > 0) await db.budgets.put({ id: existing?.id ?? newId(), categoryId: c.id, amount: cents })
        else if (existing) await db.budgets.delete(existing.id)
      }
    })
    onClose()
  }

  return (
    <Sheet
      title="Presupuesto mensual"
      onClose={onClose}
      action={
        <button className="link bold" onClick={save}>
          Guardar
        </button>
      }
    >
      <p className="hint">Deja vacío o en 0 para no tener límite en esa categoría.</p>
      <div className="form-list">
        {expenseCats.map((c) => (
          <label key={c.id} className="form-row">
            <span>
              {c.icon} {c.name}
            </span>
            <input inputMode="decimal" placeholder="$0" value={values[c.id] ?? ''} onChange={(e) => setValues({ ...values, [c.id]: e.target.value })} />
          </label>
        ))}
      </div>
    </Sheet>
  )
}
