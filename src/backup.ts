import { db, type Account, type Budget, type Category, type Transaction } from './db'
import { todayISO } from './format'

interface BackupFile {
  app: 'finanzas-app'
  version: 1
  exportedAt: string
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
  budgets: Budget[]
}

/** Comparte el archivo (hoja de compartir de iOS) o lo descarga si no se puede. */
async function saveFile(name: string, type: string, content: string) {
  const file = new File([content], name, { type })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name })
      return
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function exportJSON() {
  const data: BackupFile = {
    app: 'finanzas-app',
    version: 1,
    exportedAt: new Date().toISOString(),
    accounts: await db.accounts.toArray(),
    categories: await db.categories.toArray(),
    transactions: await db.transactions.toArray(),
    budgets: await db.budgets.toArray(),
  }
  await saveFile(`finanzas-respaldo-${todayISO()}.json`, 'application/json', JSON.stringify(data, null, 1))
  localStorage.setItem('lastBackup', JSON.stringify(Date.now()))
}

const csvCell = (v: string | number) => {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function exportCSV() {
  const [txs, accounts, categories] = await Promise.all([db.transactions.orderBy('date').toArray(), db.accounts.toArray(), db.categories.toArray()])
  const acc = new Map(accounts.map((a) => [a.id, a.name]))
  const cat = new Map(categories.map((c) => [c.id, c.name]))
  const type = { expense: 'Gasto', income: 'Ingreso', transfer: 'Transferencia' }
  const rows = [['Fecha', 'Tipo', 'Monto (MXN)', 'Cuenta', 'Cuenta destino', 'Categoría', 'Nota']]
  for (const t of txs) {
    const signed = t.type === 'expense' ? -t.amount : t.amount
    rows.push([t.date, type[t.type], (signed / 100).toFixed(2), acc.get(t.accountId) ?? '', acc.get(t.toAccountId ?? '') ?? '', cat.get(t.categoryId ?? '') ?? '', t.note])
  }
  // El BOM hace que Excel lea bien los acentos.
  await saveFile(`finanzas-movimientos-${todayISO()}.csv`, 'text/csv', '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\n'))
}

/** Reemplaza todos los datos con los de un respaldo. Devuelve cuántos movimientos cargó. */
export async function importJSON(file: File): Promise<number> {
  const data = JSON.parse(await file.text()) as BackupFile
  if (data.app !== 'finanzas-app' || !Array.isArray(data.transactions)) throw new Error('El archivo no es un respaldo de esta app.')
  await db.transaction('rw', [db.accounts, db.categories, db.transactions, db.budgets], async () => {
    await Promise.all([db.accounts.clear(), db.categories.clear(), db.transactions.clear(), db.budgets.clear()])
    await db.accounts.bulkAdd(data.accounts)
    await db.categories.bulkAdd(data.categories)
    await db.transactions.bulkAdd(data.transactions)
    await db.budgets.bulkAdd(data.budgets ?? [])
  })
  return data.transactions.length
}
