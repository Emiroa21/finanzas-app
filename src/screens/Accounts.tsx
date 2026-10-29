import { useEffect, useRef, useState } from 'react'
import { exportCSV, exportJSON, importJSON } from '../backup'
import { Sheet } from '../components/Sheet'
import { ACCOUNT_TYPES, COLORS, db, newId, requestPersistence, type Account, type AccountType, type Category, type CategoryKind } from '../db'
import { centsToInput, formatMoney, parseToCents } from '../format'
import { useStoredState, type AppData } from '../hooks'

export function Accounts({ data }: { data: AppData }) {
  const [account, setAccount] = useState<Account | 'new' | null>(null)
  const [category, setCategory] = useState<Category | 'new' | null>(null)
  const active = data.accounts.filter((a) => !a.archived)
  const archived = data.accounts.filter((a) => a.archived)
  const netWorth = active.reduce((s, a) => s + (data.balances.get(a.id) ?? 0), 0)

  return (
    <>
      <h1 className="title">Cuentas</h1>

      <section className="card list-card">
        <div className="card-title">
          <span>Patrimonio neto</span>
          <strong>{formatMoney(netWorth)}</strong>
        </div>
        {active.map((a) => (
          <AccountRow key={a.id} account={a} balance={data.balances.get(a.id) ?? 0} onClick={() => setAccount(a)} />
        ))}
        <button className="row add-row" onClick={() => setAccount('new')}>
          + Agregar cuenta
        </button>
      </section>

      {archived.length > 0 && (
        <section className="card list-card">
          <div className="card-title small">
            <span>Archivadas</span>
          </div>
          {archived.map((a) => (
            <AccountRow key={a.id} account={a} balance={data.balances.get(a.id) ?? 0} onClick={() => setAccount(a)} />
          ))}
        </section>
      )}

      <section className="card list-card">
        <div className="card-title">
          <span>Categorías</span>
          <button className="link" onClick={() => setCategory('new')}>
            Agregar
          </button>
        </div>
        <div className="chips">
          {data.categories.map((c) => (
            <button key={c.id} className="chip" onClick={() => setCategory(c)}>
              <span>{c.icon}</span> {c.name}
              {c.kind === 'income' && <span className="tag">ingreso</span>}
            </button>
          ))}
        </div>
      </section>

      <BackupCard count={data.transactions.length} />

      <p className="footer-note">Tus datos viven solo en este iPhone. Haz un respaldo con frecuencia: si borras la app, se pierden.</p>

      {account && <AccountSheet data={data} account={account === 'new' ? undefined : account} onClose={() => setAccount(null)} />}
      {category && <CategorySheet data={data} category={category === 'new' ? undefined : category} onClose={() => setCategory(null)} />}
    </>
  )
}

function AccountRow({ account, balance, onClick }: { account: Account; balance: number; onClick: () => void }) {
  return (
    <button className="row" onClick={onClick}>
      <span className="row-icon" style={{ background: `${account.color}33`, color: account.color }}>
        {account.name.charAt(0).toUpperCase()}
      </span>
      <span className="row-text">
        <span className="row-title">{account.name}</span>
        <span className="row-sub">{ACCOUNT_TYPES[account.type]}</span>
      </span>
      <span className={`row-amount ${balance < 0 ? 'expense' : ''}`}>{formatMoney(balance)}</span>
    </button>
  )
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="colors">
      {COLORS.map((c) => (
        <button key={c} aria-label={c} className={c === value ? 'on' : ''} style={{ background: c }} onClick={() => onChange(c)} />
      ))}
    </div>
  )
}

function AccountSheet({ data, account, onClose }: { data: AppData; account?: Account; onClose: () => void }) {
  const [name, setName] = useState(account?.name ?? '')
  const [type, setType] = useState<AccountType>(account?.type ?? 'debit')
  const [initial, setInitial] = useState(account ? centsToInput(Math.abs(account.initialBalance)) : '')
  const [owes, setOwes] = useState(account ? account.initialBalance < 0 : false)
  const [color, setColor] = useState(account?.color ?? COLORS[data.accounts.length % COLORS.length])
  const [archived, setArchived] = useState(account?.archived ?? false)
  const used = account ? data.transactions.some((t) => t.accountId === account.id || t.toAccountId === account.id) : false

  const save = async () => {
    if (!name.trim()) return
    const cents = parseToCents(initial)
    await db.accounts.put({
      id: account?.id ?? newId(),
      name: name.trim(),
      type,
      initialBalance: type === 'credit' || owes ? -cents : cents,
      color,
      archived,
      createdAt: account?.createdAt ?? Date.now(),
    })
    onClose()
  }

  const remove = async () => {
    if (account && confirm(`¿Borrar la cuenta "${account.name}"?`)) {
      await db.accounts.delete(account.id)
      onClose()
    }
  }

  return (
    <Sheet
      title={account ? 'Editar cuenta' : 'Nueva cuenta'}
      onClose={onClose}
      action={
        <button className="link bold" onClick={save}>
          Guardar
        </button>
      }
    >
      <div className="form-list">
        <label className="form-row">
          <span>Nombre</span>
          <input value={name} placeholder="Ej. BBVA débito" onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="form-row">
          <span>Tipo</span>
          <select value={type} onChange={(e) => setType(e.target.value as AccountType)}>
            {Object.entries(ACCOUNT_TYPES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="form-row">
          <span>{type === 'credit' ? 'Deuda inicial' : 'Saldo inicial'}</span>
          <input inputMode="decimal" placeholder="$0" value={initial} onChange={(e) => setInitial(e.target.value)} />
        </label>
        {type !== 'credit' && (
          <label className="form-row">
            <span>El saldo inicial es deuda</span>
            <input type="checkbox" checked={owes} onChange={(e) => setOwes(e.target.checked)} />
          </label>
        )}
        {account && (
          <label className="form-row">
            <span>Archivar</span>
            <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} />
          </label>
        )}
      </div>
      <p className="hint">Color</p>
      <ColorPicker value={color} onChange={setColor} />
      {account &&
        (used ? (
          <p className="hint">Esta cuenta tiene movimientos. Puedes archivarla para ocultarla sin perder el historial.</p>
        ) : (
          <button className="danger-btn" onClick={remove}>
            Borrar cuenta
          </button>
        ))}
    </Sheet>
  )
}

function CategorySheet({ data, category, onClose }: { data: AppData; category?: Category; onClose: () => void }) {
  const [name, setName] = useState(category?.name ?? '')
  const [icon, setIcon] = useState(category?.icon ?? '🏷️')
  const [kind, setKind] = useState<CategoryKind>(category?.kind ?? 'expense')
  const [color, setColor] = useState(category?.color ?? COLORS[data.categories.length % COLORS.length])
  const used = category ? data.transactions.some((t) => t.categoryId === category.id) : false

  const save = async () => {
    if (!name.trim()) return
    await db.categories.put({
      id: category?.id ?? newId(),
      name: name.trim(),
      icon: [...icon.trim()].slice(0, 2).join('') || '🏷️',
      kind,
      color,
      order: category?.order ?? data.categories.length,
    })
    onClose()
  }

  const remove = async () => {
    if (category && confirm(`¿Borrar la categoría "${category.name}"?`)) {
      await db.transaction('rw', db.categories, db.budgets, async () => {
        await db.categories.delete(category.id)
        await db.budgets.where('categoryId').equals(category.id).delete()
      })
      onClose()
    }
  }

  return (
    <Sheet
      title={category ? 'Editar categoría' : 'Nueva categoría'}
      onClose={onClose}
      action={
        <button className="link bold" onClick={save}>
          Guardar
        </button>
      }
    >
      <div className="form-list">
        <label className="form-row">
          <span>Nombre</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="form-row">
          <span>Emoji</span>
          <input value={icon} onChange={(e) => setIcon(e.target.value)} className="emoji-input" />
        </label>
        <label className="form-row">
          <span>Tipo</span>
          <select value={kind} disabled={used} onChange={(e) => setKind(e.target.value as CategoryKind)}>
            <option value="expense">Gasto</option>
            <option value="income">Ingreso</option>
          </select>
        </label>
      </div>
      <p className="hint">Color</p>
      <ColorPicker value={color} onChange={setColor} />
      {category &&
        (used ? (
          <p className="hint">Esta categoría tiene movimientos, así que no se puede borrar.</p>
        ) : (
          <button className="danger-btn" onClick={remove}>
            Borrar categoría
          </button>
        ))}
    </Sheet>
  )
}

function BackupCard({ count }: { count: number }) {
  const [lastBackup] = useStoredState<number | null>('lastBackup', null)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [message, setMessage] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    requestPersistence().then(setPersisted)
  }, [])

  const onImport = async (file?: File) => {
    if (!file) return
    if (!confirm('Esto reemplaza todos tus datos actuales con los del respaldo. ¿Continuar?')) return
    try {
      const n = await importJSON(file)
      setMessage(`Respaldo cargado: ${n} movimientos.`)
    } catch (e) {
      setMessage((e as Error).message || 'No se pudo leer el archivo.')
    }
  }

  return (
    <section className="card">
      <div className="card-title">
        <span>Respaldo</span>
        <span className="muted">{count} movimientos</span>
      </div>
      <p className="hint">
        Último respaldo: {lastBackup ? new Date(lastBackup).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : 'nunca'}
        {persisted === false && ' · El almacenamiento aún no es permanente; instala la app en tu pantalla de inicio.'}
      </p>
      <div className="btn-grid">
        <button className="primary-btn" onClick={() => exportJSON().catch(() => setMessage('No se pudo exportar.'))}>
          Guardar respaldo
        </button>
        <button className="secondary-btn" onClick={() => exportCSV()}>
          Exportar CSV
        </button>
        <button className="secondary-btn" onClick={() => fileRef.current?.click()}>
          Restaurar respaldo
        </button>
      </div>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => onImport(e.target.files?.[0]).finally(() => (e.target.value = ''))} />
      {message && <p className="hint">{message}</p>}
    </section>
  )
}
