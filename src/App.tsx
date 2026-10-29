import { useEffect, useState, type ReactNode } from 'react'
import { ChartIcon, GaugeIcon, HomeIcon, ListIcon, PlusIcon, WalletIcon } from './components/Icons'
import { TxSheet } from './components/TxSheet'
import { requestPersistence, type Transaction } from './db'
import { useData } from './hooks'
import { Accounts } from './screens/Accounts'
import { Budgets } from './screens/Budgets'
import { Home } from './screens/Home'
import { Reports } from './screens/Reports'
import { Transactions } from './screens/Transactions'

type Tab = 'home' | 'transactions' | 'budgets' | 'reports' | 'accounts'

const TABS: [Tab, string, ReactNode][] = [
  ['home', 'Inicio', <HomeIcon />],
  ['transactions', 'Movimientos', <ListIcon />],
  ['budgets', 'Presupuestos', <GaugeIcon />],
  ['reports', 'Reportes', <ChartIcon />],
  ['accounts', 'Cuentas', <WalletIcon />],
]

export function App() {
  const data = useData()
  const [tab, setTab] = useState<Tab>('home')
  const [sheet, setSheet] = useState<Transaction | 'new' | null>(null)

  useEffect(() => {
    requestPersistence()
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [tab])

  if (!data) return <div className="loading">Cargando…</div>

  const edit = (tx: Transaction) => setSheet(tx)

  return (
    <>
      <main className="screen">
        {tab === 'home' && <Home data={data} onEdit={edit} onSeeAll={() => setTab('transactions')} />}
        {tab === 'transactions' && <Transactions data={data} onEdit={edit} />}
        {tab === 'budgets' && <Budgets data={data} />}
        {tab === 'reports' && <Reports data={data} />}
        {tab === 'accounts' && <Accounts data={data} />}
      </main>

      {tab !== 'accounts' && (
        <button className="fab" aria-label="Agregar movimiento" onClick={() => setSheet('new')}>
          <PlusIcon />
        </button>
      )}

      <nav className="tabbar">
        {TABS.map(([id, label, icon]) => (
          <button key={id} className={id === tab ? 'on' : ''} onClick={() => setTab(id)}>
            {icon}
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {sheet && <TxSheet key={sheet === 'new' ? 'new' : sheet.id} data={data} tx={sheet === 'new' ? undefined : sheet} onClose={() => setSheet(null)} />}
    </>
  )
}
