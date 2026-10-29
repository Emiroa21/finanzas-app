import { useStoredState, type AppData } from '../hooks'
import { Budgets } from './Budgets'
import { Debts } from './Debts'
import { Goals } from './Goals'

type View = 'budgets' | 'goals' | 'debts'

export function Plan({ data }: { data: AppData }) {
  const [view, setView] = useStoredState<View>('planView', 'budgets')
  return (
    <>
      <h1 className="title">Planear</h1>
      <div className="segmented">
        <button className={view === 'budgets' ? 'on' : ''} onClick={() => setView('budgets')}>
          Presupuestos
        </button>
        <button className={view === 'goals' ? 'on' : ''} onClick={() => setView('goals')}>
          Metas
        </button>
        <button className={view === 'debts' ? 'on' : ''} onClick={() => setView('debts')}>
          Deudas
        </button>
      </div>
      <div className="spacer" />
      {view === 'budgets' && <Budgets data={data} />}
      {view === 'goals' && <Goals data={data} />}
      {view === 'debts' && <Debts data={data} />}
    </>
  )
}
