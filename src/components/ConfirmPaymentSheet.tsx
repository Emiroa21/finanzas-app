import { useState } from 'react'
import type { Recurring } from '../db'
import { centsToInput, formatMoney, parseToCents, shortDate, todayISO } from '../format'
import type { AppData } from '../hooks'
import { confirmPayment, skipPayment } from '../recurring'
import { Sheet } from './Sheet'

/** Confirmar que un pago programado ya quedó pagado (o saltarlo). */
export function ConfirmPaymentSheet({ data, rule, onClose }: { data: AppData; rule: Recurring; onClose: () => void }) {
  const [amount, setAmount] = useState(centsToInput(rule.amount))
  const [date, setDate] = useState(todayISO())
  const [accountId, setAccountId] = useState(rule.accountId)
  const target = rule.type === 'transfer' ? data.accountById.get(rule.toAccountId ?? '') : undefined

  const save = async () => {
    const cents = parseToCents(amount)
    if (cents <= 0) return
    await confirmPayment(rule, { amount: cents, date, accountId })
    onClose()
  }

  const skip = async () => {
    if (confirm(`¿Omitir el pago del ${shortDate(rule.nextDate)}? No se registrará nada y pasará al siguiente.`)) {
      await skipPayment(rule)
      onClose()
    }
  }

  return (
    <Sheet
      title="Confirmar pago"
      onClose={onClose}
      action={
        <button className="link bold" onClick={save}>
          Pagado
        </button>
      }
    >
      <div className="confirm-head">
        <strong>{rule.note}</strong>
        <span className="muted">
          Pago del {shortDate(rule.nextDate)} · {formatMoney(rule.amount)}
          {target && ` a ${target.name}`}
        </span>
      </div>
      <div className="form-list">
        <label className="form-row">
          <span>Monto pagado</span>
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label className="form-row">
          <span>Fecha de pago</span>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
        <label className="form-row">
          <span>{rule.type === 'income' ? 'A la cuenta' : 'Desde la cuenta'}</span>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {data.accounts
              .filter((a) => !a.archived && a.id !== rule.toAccountId)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </select>
        </label>
      </div>
      <p className="hint">Al confirmar se registra el movimiento y el plan pasa al siguiente pago.</p>
      <button className="primary-btn confirm-btn" onClick={save}>
        ✓ Ya lo pagué
      </button>
      <button className="danger-btn" onClick={skip}>
        Omitir este pago
      </button>
    </Sheet>
  )
}
