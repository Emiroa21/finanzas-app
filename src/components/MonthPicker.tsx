import { monthLabel, shiftMonth } from '../format'

export function MonthPicker({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  return (
    <div className="month-picker">
      <button className="icon-btn" aria-label="Mes anterior" onClick={() => onChange(shiftMonth(month, -1))}>
        ‹
      </button>
      <span>{monthLabel(month)}</span>
      <button className="icon-btn" aria-label="Mes siguiente" onClick={() => onChange(shiftMonth(month, 1))}>
        ›
      </button>
    </div>
  )
}
