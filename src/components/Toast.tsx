import { dismissToast, useToast } from '../toast'

export function Toast() {
  const t = useToast()
  if (!t) return null
  return (
    <div className="toast" role="status" key={t.id}>
      <span>{t.text}</span>
      {t.action && (
        <button
          onClick={async () => {
            dismissToast()
            await t.action!.run()
          }}
        >
          {t.action.label}
        </button>
      )}
    </div>
  )
}
