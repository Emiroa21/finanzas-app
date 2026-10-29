import { useState } from 'react'
import { guessColumns, mapRows, parseCSV, type ColumnMap } from '../csvImport'
import { db, newId, type Transaction } from '../db'
import { dayLabel, formatMoney } from '../format'
import type { AppData } from '../hooks'
import { guessCategory } from '../receipt'
import { Sheet } from './Sheet'

export function ImportSheet({ data, onClose }: { data: AppData; onClose: () => void }) {
  const accounts = data.accounts.filter((a) => !a.archived)
  const [rows, setRows] = useState<string[][] | null>(null)
  const [map, setMap] = useState<ColumnMap | null>(null)
  const [accountId, setAccountId] = useState(accounts.find((a) => a.type === 'debit')?.id ?? accounts[0]?.id ?? '')
  const [invert, setInvert] = useState(false)
  const [message, setMessage] = useState('')

  const onFile = async (file?: File) => {
    if (!file) return
    const parsed = parseCSV(await file.text())
    if (parsed.length < 2) return setMessage('El archivo no tiene movimientos.')
    setRows(parsed)
    setMap(guessColumns(parsed[0]))
    setMessage('')
  }

  const headers = rows?.[0] ?? []
  const parsed = rows && map ? mapRows(rows.slice(1), map, invert) : []
  const key = (date: string, amount: number) => `${date}|${amount}`
  const existing = new Set(data.transactions.filter((t) => t.accountId === accountId && t.type !== 'transfer').map((t) => key(t.date, t.type === 'income' ? t.amount : -t.amount)))
  const fresh = parsed.filter((r) => !existing.has(key(r.date, r.amount)))
  const otherExpense = data.categories.find((c) => c.kind === 'expense' && /otros/i.test(c.name)) ?? data.categories.find((c) => c.kind === 'expense')
  const otherIncome = data.categories.find((c) => c.kind === 'income' && /otros/i.test(c.name)) ?? data.categories.find((c) => c.kind === 'income')

  const doImport = async () => {
    const now = Date.now()
    const txs: Transaction[] = fresh.map((r, i) => {
      const income = r.amount > 0
      const guessed = !income && guessCategory(r.description)
      const cat = (guessed && data.categories.find((c) => c.kind === 'expense' && c.name === guessed)) || (income ? otherIncome : otherExpense)
      return { id: newId(), type: income ? 'income' : 'expense', amount: Math.abs(r.amount), accountId, categoryId: cat?.id, date: r.date, note: r.description.slice(0, 80), createdAt: now + i }
    })
    await db.transactions.bulkAdd(txs)
    onClose()
  }

  const column = (label: string, field: keyof ColumnMap, optional = true) =>
    map && (
      <label className="form-row">
        <span>{label}</span>
        <select value={map[field]} onChange={(e) => setMap({ ...map, [field]: Number(e.target.value) })}>
          {optional && <option value={-1}>—</option>}
          {headers.map((h, i) => (
            <option key={i} value={i}>
              {h || `Columna ${i + 1}`}
            </option>
          ))}
        </select>
      </label>
    )

  return (
    <Sheet
      title="Importar estado de cuenta"
      onClose={onClose}
      action={
        fresh.length > 0 && (
          <button className="link bold" onClick={doImport}>
            Importar
          </button>
        )
      }
    >
      {!rows ? (
        <>
          <p className="hint">Descarga tus movimientos desde la app o portal de tu banco en formato CSV (o abre el Excel y guárdalo como CSV), y elígelo aquí.</p>
          <label className="primary-btn file-btn">
            Elegir archivo CSV
            <input type="file" accept=".csv,text/csv,text/plain" hidden onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
        </>
      ) : (
        <>
          <div className="form-list">
            <label className="form-row">
              <span>Cuenta</span>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            {column('Fecha', 'date', false)}
            {column('Descripción', 'description')}
            {column('Monto (con signo)', 'amount')}
            {map && map.amount < 0 && column('Cargos', 'charge')}
            {map && map.amount < 0 && column('Abonos', 'credit')}
            <label className="form-row">
              <span>Invertir signo</span>
              <input type="checkbox" checked={invert} onChange={(e) => setInvert(e.target.checked)} />
            </label>
          </div>
          <p className="hint">
            {parsed.length} movimientos leídos · {fresh.length} nuevos{parsed.length > fresh.length && ` · ${parsed.length - fresh.length} ya estaban registrados`}. Revisa que los gastos salgan en negativo; si no, activa "Invertir signo".
          </p>
          <div className="form-list preview">
            {fresh.slice(0, 8).map((r, i) => (
              <div key={i} className="form-row">
                <span className="preview-text">
                  <span>{r.description || 'Sin descripción'}</span>
                  <span className="muted">{dayLabel(r.date)}</span>
                </span>
                <span className={r.amount < 0 ? 'expense' : 'income'}>{formatMoney(r.amount)}</span>
              </div>
            ))}
          </div>
        </>
      )}
      {message && <p className="error">{message}</p>}
    </Sheet>
  )
}
