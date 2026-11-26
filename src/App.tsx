import { useEffect, useState, type ReactNode } from 'react'
import { ChartIcon, GaugeIcon, HomeIcon, ListIcon, PlusIcon, WalletIcon } from './components/Icons'
import { LockScreen } from './components/LockScreen'
import { TxSheet } from './components/TxSheet'
import { Splash } from './components/Splash'
import { Toast } from './components/Toast'
import { requestPersistence, type Transaction, type TxType } from './db'
import { useData } from './hooks'
import { lockEnabled } from './lock'
import { materializeRecurring } from './recurring'

/** Tiempo en segundo plano tras el cual la app se vuelve a bloquear. */
const RELOCK_MS = 60_000
import { Accounts } from './screens/Accounts'
import { Home } from './screens/Home'
import { Plan } from './screens/Plan'
import { Reports } from './screens/Reports'
import { Transactions } from './screens/Transactions'

type Tab = 'home' | 'transactions' | 'plan' | 'reports' | 'accounts'

const TABS: [Tab, string, ReactNode][] = [
  ['home', 'Inicio', <HomeIcon />],
  ['transactions', 'Historial', <ListIcon />],
  ['plan', 'Planear', <GaugeIcon />],
  ['reports', 'Reportes', <ChartIcon />],
  ['accounts', 'Cuentas', <WalletIcon />],
]

export function App() {
  const data = useData()
  const [tab, setTab] = useState<Tab>('home')
  const [sheet, setSheet] = useState<Transaction | TxType | null>(null)
  const [splash, setSplash] = useState(true)
  const [locked, setLocked] = useState(lockEnabled)

  useEffect(() => {
    let hiddenAt = 0
    const onChange = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now()
      else if (lockEnabled() && hiddenAt && Date.now() - hiddenAt > RELOCK_MS) setLocked(true)
    }
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [])

  useEffect(() => {
    requestPersistence()
    materializeRecurring()
    const onVisible = () => document.visibilityState === 'visible' && materializeRecurring()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [tab])

  // Atajo: abrir la app con ?accion=gasto (o ingreso / transferencia) abre el registro directo.
  useEffect(() => {
    const url = new URL(location.href)
    const action = url.searchParams.get('accion')
    const map: Record<string, TxType> = { gasto: 'expense', ingreso: 'income', transferencia: 'transfer' }
    if (action && map[action]) {
      setSheet(map[action])
      url.searchParams.delete('accion')
      history.replaceState(null, '', url)
    }
  }, [])

  if (splash) return <Splash ready={!!data} onDone={() => setSplash(false)} />
  if (locked) return <LockScreen onUnlock={() => setLocked(false)} />
  if (!data) return <div className="loading">Cargando…</div>

  const edit = (tx: Transaction) => setSheet(tx)

  return (
    <>
      <main className="screen" key={tab}>
        {tab === 'home' && (
          <Home
            data={data}
            onEdit={edit}
            onNew={(t) => setSheet(t)}
            onSeeAll={() => setTab('transactions')}
            onBackup={() => setTab('accounts')}
            onPlan={() => setTab('plan')}
          />
        )}
        {tab === 'transactions' && <Transactions data={data} onEdit={edit} />}
        {tab === 'plan' && <Plan data={data} />}
        {tab === 'reports' && <Reports data={data} />}
        {tab === 'accounts' && <Accounts data={data} />}
      </main>


      <nav className="tabbar">
        {TABS.map(([id, label, icon]) => (
          <button key={id} className={id === tab ? 'on' : ''} aria-label={label} aria-current={id === tab ? 'page' : undefined} onClick={() => setTab(id)}>
            {icon}
            {id === tab && <span>{label}</span>}
          </button>
        ))}
        <button className="tab-add" aria-label="Agregar movimiento" onClick={() => setSheet('expense')}>
          <PlusIcon />
        </button>
      </nav>
      <Toast />

      {sheet && (
        <TxSheet
          key={typeof sheet === 'string' ? sheet : sheet.id}
          data={data}
          tx={typeof sheet === 'string' ? undefined : sheet}
          initialType={typeof sheet === 'string' ? sheet : undefined}
          onClose={() => setSheet(null)}
        />
      )}
    </>
  )
}
